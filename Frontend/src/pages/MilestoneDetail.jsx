import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Shared/Navbar';
import DoubtChat from '../components/AI/DoubtChat';
import { useLearningPath } from '../context/LearningPathContext';
import { llmService } from '../services/llmService';
import { llamaParseService } from '../services/llamaParseService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PathAdjuster from '../components/LearningPath/PathAdjuster';
import MermaidChart from '../components/Shared/MermaidChart';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';

function MilestoneDetail() {
    const { id } = useParams();
    const { getMilestoneById, updateMilestone } = useLearningPath();
    const [milestone, setMilestone] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generatingContent, setGeneratingContent] = useState(false);

    const [selection, setSelection] = useState({ text: '', x: 0, y: 0 });
    const [actionState, setActionState] = useState({ type: null, loading: false, result: '', chatHistory: [], error: '', threads: {}, activeThreadId: null }); 
    const [actionInput, setActionInput] = useState('');
    const [actionFile, setActionFile] = useState(null);
    const preVoiceInputRef = useRef('');
    
    // Scroll management for chat
    const chatContainerRef = useRef(null);
    const [showScrollButton, setShowScrollButton] = useState(false);

    const handleModalScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollHeight - scrollTop - clientHeight > 150) {
            setShowScrollButton(true);
        } else {
            setShowScrollButton(false);
        }
    };

    const scrollToBottom = () => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
        }
    };

    const { isListening: isListeningModal, startListening: startListeningModal, stopListening: stopListeningModal } = useVoiceAssistant((transcript, isFinal) => {
        if (isFinal) {
            setActionInput(preVoiceInputRef.current + (preVoiceInputRef.current ? ' ' : '') + transcript);
            stopListeningModal();
        } else {
            setActionInput(preVoiceInputRef.current + (preVoiceInputRef.current ? ' ' : '') + transcript);
        }
    }, false); // No auto-restart

    useEffect(() => {
        const found = getMilestoneById(id);
        setMilestone(found);
        setLoading(false);

        if (found && !found.detailedContent && !generatingContent) {
            generateContent(found);
        }
    }, [id, getMilestoneById, generatingContent]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.selection-toolbar') && !e.target.closest('.action-modal-overlay')) {
                if (window.getSelection().isCollapsed) {
                    setSelection({ text: '', x: 0, y: 0 });
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const generateContent = async (m) => {
        setGeneratingContent(true);
        // Start with an empty string so the UI can mount ReactMarkdown immediately
        setMilestone(prev => ({ ...prev, detailedContent: " " }));

        let streamedContent = "";
        try {
            const prompt = `
      You are an expert tutor creating detailed educational content for a specific milestone.
      Milestone Title: "${m.title}"
      Topics to cover: ${JSON.stringify(m.topics)}
      
      Generate a comprehensive, explanatory tutorial for this milestone.
      This content should be educational and explain the concepts clearly. It should be suitable for a student to learn from directly.
      Output ONLY raw markdown text. Do not wrap in JSON.
            `.trim();

            let buffer = "";
            let displayContent = "";
            let isStreamDone = false;

            const stream = llmService.streamGenericContent(prompt);

            // Network Loop
            (async () => {
                try {
                    for await (const chunk of stream) { buffer += chunk; }
                } catch (e) { console.error("Stream disrupted:", e); }
                finally { isStreamDone = true; }
            })();

            // UI Typewriter Loop (Smooth framerate)
            while (!isStreamDone || displayContent.length < buffer.length) {
                if (displayContent.length < buffer.length) {
                    // Add characters progressively
                    const stepText = buffer.slice(displayContent.length, displayContent.length + 4);
                    displayContent += stepText;
                    setMilestone(prev => ({ ...prev, detailedContent: displayContent }));
                }
                await new Promise(r => setTimeout(r, 15));
            }

            // Persist the permanently completed content to database
            if (displayContent) {
                updateMilestone(m.id, { detailedContent: displayContent });
            }
        } catch (err) {
            console.error("Failed to stream detailed content", err);
            setMilestone(prev => ({ ...prev, detailedContent: "Failed to load content. Please refresh." }));
        } finally {
            setGeneratingContent(false);
        }
    };

    const handleMouseUp = () => {
        const sel = window.getSelection();
        if (sel && sel.toString().trim().length > 0) {
            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            setSelection({
                text: sel.toString().trim(),
                x: rect.left + window.scrollX + rect.width / 2,
                y: rect.top + window.scrollY - 10
            });
        }
    };

    const handlePersonalize = async () => {
        if (!actionInput.trim() && !actionFile) return;
        setActionState(prev => ({ ...prev, loading: true, error: '' }));

        let promptText = actionInput;
        try {
            if (actionFile) {
                const parsedMarkdown = await llamaParseService.parseFile(actionFile);
                promptText += `\n\nAttached Context Document:\n${parsedMarkdown}`;
                setActionFile(null);
            }

            let prompt = `
You are an expert tutor. The student selected this text from their lesson:
"${selection.text}"

Here is the full lesson context:
"${milestone.detailedContent}"

Student's instruction to change the selected text:
"${promptText}"

Please rewrite ONLY the selected text according to the student's instruction. 
Output ONLY raw markdown of the final NEW replacement text. Do not wrap in quotes or JSON.
            `.trim();

            let targetText = selection.text;
            let currentContentSnapshot = milestone.detailedContent;
            const exactMatchFound = currentContentSnapshot.includes(targetText);

            let buffer = "";
            let displayContent = "";
            let isStreamDone = false;

            const stream = llmService.streamGenericContent(prompt);

            (async () => {
                try {
                    for await (const chunk of stream) { buffer += chunk; }
                } catch (e) { console.error(e); }
                finally { isStreamDone = true; }
            })();

            while (!isStreamDone || displayContent.length < buffer.length) {
                if (displayContent.length < buffer.length) {
                    const stepText = buffer.slice(displayContent.length, displayContent.length + 4);
                    displayContent += stepText;

                    let updatedUI = currentContentSnapshot;
                    if (exactMatchFound) {
                        updatedUI = currentContentSnapshot.replace(targetText, `**⏳ Personalizing:**\n*${displayContent}*`);
                    } else {
                        updatedUI += `\n\n### ⏳ Personalizing Selection...\n*${displayContent}*`;
                    }
                    setMilestone(prev => ({ ...prev, detailedContent: updatedUI }));
                }
                await new Promise(r => setTimeout(r, 15));
            }

            // Finalize the replacement without glowing wrappers
            let finalContent = currentContentSnapshot;
            if (exactMatchFound) {
                finalContent = currentContentSnapshot.replace(targetText, displayContent);
            } else {
                finalContent += `\n\n### Personalized Addition\n${displayContent}`;
            }

            updateMilestone(id, { detailedContent: finalContent });
            setMilestone(prev => ({ ...prev, detailedContent: finalContent }));
            closeModals();

        } catch (err) {
            console.error("Personalization Stream Error", err);
            setActionState(prev => ({ ...prev, loading: false, error: 'Failed to personalize content.' }));
        }
    };

    const handleAsk = async () => {
        if (!actionInput.trim()) return;

        const questionText = actionInput;
        setActionInput('');

        // Ensure we have a thread ID
        const threadIdToUse = actionState.activeThreadId || `${id}_selection_${Date.now()}`;

        setActionState(prev => ({
            ...prev,
            loading: true,
            error: '',
            activeThreadId: threadIdToUse,
            chatHistory: [...prev.chatHistory, { role: 'user', content: questionText }]
        }));

        try {
            // Add empty AI message placeholder for streaming
            setActionState(prev => ({
                ...prev,
                chatHistory: [...prev.chatHistory, { role: 'ai', content: '' }]
            }));

            let buffer = "";
            let displayContent = "";
            let isStreamDone = false;

            const syntheticPrompt = `Regarding this exact snippet: "${selection.text}"\n\nStudent asks: ${questionText}`;
            console.log(`[AskModal] Sending synthetic prompt to stream API:\n${syntheticPrompt}`);

            const stream = llmService.streamDoubtAnswer(syntheticPrompt);

            (async () => {
                try {
                    for await (const chunk of stream) { buffer += chunk; }
                } catch (e) { console.error(e); }
                finally { isStreamDone = true; }
            })();

            while (!isStreamDone || displayContent.length < buffer.length) {
                if (displayContent.length < buffer.length) {
                    const stepText = buffer.slice(displayContent.length, displayContent.length + 4);
                    displayContent += stepText;
                    setActionState(prev => {
                        const newHistory = [...prev.chatHistory];
                        const lastIndex = newHistory.length - 1;
                        newHistory[lastIndex] = { ...newHistory[lastIndex], content: displayContent };
                        return { ...prev, chatHistory: newHistory };
                    });
                }
                await new Promise(r => setTimeout(r, 15));
            }

            console.log(`[AskModal] Stream generation completed successfully. Total length: ${displayContent.length} chars.`);

            setActionState(prev => ({ ...prev, loading: false }));

            // Save messages to backend once complete
            saveChatToBackend('user', questionText, threadIdToUse);
            saveChatToBackend('ai', displayContent, threadIdToUse);

        } catch (err) {
            setActionState(prev => ({ ...prev, loading: false, error: 'Failed to get answer.' }));
        }
    };

    const handleOpenAskHistory = async () => {
        setActionState({ type: 'ask', loading: true, result: '', chatHistory: [], error: '', activeThreadId: null, threads: {} });
        setSelection({ text: '', x: 0, y: 0 });
        try {
            const token = localStorage.getItem('auth_token');
            if (token) {
                const res = await fetch(`/api/chats/${id}/threads`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const threadsData = await res.json();
                    const nextActiveId = Object.keys(threadsData)[0] || null;
                    setActionState(prev => ({
                        ...prev,
                        loading: false,
                        threads: threadsData,
                        activeThreadId: nextActiveId,
                        chatHistory: nextActiveId ? threadsData[nextActiveId] : []
                    }));
                }
            }
        } catch (e) {
            console.error("Failed to load chat history", e);
            setActionState(prev => ({ ...prev, loading: false }));
        }
    };

    const handleOpenVisualHistory = async () => {
        setActionState({ type: 'visualize', loading: true, result: '', chatHistory: [], error: '', activeThreadId: null, threads: {} });
        setSelection({ text: '', x: 0, y: 0 });
        try {
            const token = localStorage.getItem('auth_token');
            if (token) {
                const res = await fetch(`/api/chats/${id}/visualize-threads`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const threadsData = await res.json();
                    const nextActiveId = Object.keys(threadsData)[0] || null;
                    const defaultHistory = nextActiveId ? threadsData[nextActiveId] : [];
                    setActionState(prev => ({
                        ...prev,
                        loading: false,
                        threads: threadsData,
                        activeThreadId: nextActiveId,
                        chatHistory: defaultHistory,
                        result: defaultHistory.find(m => m.role === 'ai')?.content || ''
                    }));
                }
            }
        } catch (e) {
            console.error("Visualize history fetch error", e);
            setActionState(prev => ({ ...prev, loading: false }));
        }
    };

    const saveChatToBackend = async (role, content, threadId) => {
        const token = localStorage.getItem('auth_token');
        if (!token) return;

        // Also update local thread state so it immediately appears in sidebar if new
        setActionState(prev => {
            const updatedThreads = { ...prev.threads };
            if (!updatedThreads[threadId]) updatedThreads[threadId] = [];
            updatedThreads[threadId] = [...updatedThreads[threadId], { role, content }];
            return { ...prev, threads: updatedThreads };
        });

        await fetch('/api/chats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ role, content, contextRef: threadId })
        });
    };

    const handleVisualizeHighlight = async () => {
        const newThreadId = `${id}_visualize_${Date.now()}`;
        const instructionToUse = actionInput;
        setActionInput('');
        setActionState(prev => ({ ...prev, loading: true, result: '', error: '', activeThreadId: newThreadId }));

        try {
            const token = localStorage.getItem('auth_token');
            if (token) {
                const res = await fetch(`/api/chats/${id}/visualize-threads`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const threadsData = await res.json();
                    setActionState(prev => ({ ...prev, threads: threadsData }));
                }
            }
        } catch (e) {
            console.error("Visualize history fetch error", e);
        }

        try {
            const data = await llmService.visualizeExplanation(selection.text, instructionToUse);
            if (data && data.mermaidCode) {
                const cleanedCode = data.mermaidCode.replace(/```mermaid/gi, "").replace(/```/g, "").trim();

                const userPrompt = instructionToUse ? `Instruction: ${instructionToUse}\n\nContext: ${selection.text}` : selection.text;
                // Fire and forget saves
                saveChatToBackend('user', userPrompt, newThreadId);
                saveChatToBackend('ai', cleanedCode, newThreadId);

                setActionState(prev => ({
                    ...prev, loading: false, result: cleanedCode, chatHistory: [
                        { role: 'user', content: userPrompt },
                        { role: 'ai', content: cleanedCode }
                    ]
                }));
            } else {
                setActionState(prev => ({ ...prev, loading: false }));
            }
        } catch (err) {
            console.error("Visualize Error", err);
            setActionState(prev => ({ ...prev, loading: false, error: 'Failed to visualize content.' }));
        }
    };

    const closeModals = () => {
        setActionState({ type: null, loading: false, result: '', chatHistory: [], error: '' });
        setActionInput('');
        setActionFile(null);
        setSelection({ text: '', x: 0, y: 0 });
        window.getSelection().removeAllRanges();
    };

    if (loading) return <div>Loading milestone...</div>;
    if (!milestone) return (
        <div className="error-page">
            <Navbar />
            <div className="content">
                <p>Milestone not found. Please return to the dashboard.</p>
                <Link to="/dashboard">Back to Dashboard</Link>
            </div>
        </div>
    );

    return (
        <div className="milestone-detail-page">
            <Navbar />
            <div className="content-container" style={{
                display: 'grid',
                gridTemplateColumns: '240px minmax(0, 1fr) 300px',
                gap: '30px',
                maxWidth: '100%',
                margin: '0 auto',
                padding: '0 2%',
                alignItems: 'start'
            }}>

                {/* Left Sidebar */}
                <div className="left-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'sticky', top: '20px', height: 'calc(100vh - 40px)', overflowY: 'auto', paddingBottom: '10px' }}>
                    <div style={{ padding: '24px', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', borderRadius: '16px', border: '1px solid var(--glass-border)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                        <Link to="/dashboard" className="back-link" style={{ margin: 0, display: 'inline-block', marginBottom: '20px', color: 'var(--primary)', textDecoration: 'none', fontWeight: '600' }}>← Back to Dashboard</Link>

                        <h3 style={{ fontSize: '1.2rem', marginBottom: '12px', borderBottom: '2px solid var(--border-color)', paddingBottom: '8px' }}>Topics Covered</h3>
                        <ul style={{ paddingLeft: '20px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {milestone.topics && milestone.topics.map((topic, i) => (
                                <li key={i} style={{ fontSize: '0.95rem' }}>{topic}</li>
                            ))}
                        </ul>
                    </div>

                    <div style={{ padding: '24px', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', borderRadius: '16px', border: '1px solid var(--glass-border)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', borderBottom: '2px solid var(--border-color)', paddingBottom: '8px' }}>Learning Path</h3>
                        <PathAdjuster />
                    </div>
                </div>

                {/* Main Content */}
                <div className="main-content" style={{ background: 'var(--surface-color)', padding: '40px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
                    <h1 style={{
                        marginTop: 0,
                        marginBottom: '30px',
                        fontSize: '2.5rem',
                        background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        {milestone.title}
                    </h1>

                    <div className="milestone-content">
                        {generatingContent && !milestone.detailedContent && (
                            <div className="loading-content" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px', background: 'var(--primary-light)', borderRadius: '8px', color: 'var(--primary)' }}>
                                <div className="spinner" style={{ width: '24px', height: '24px', borderWidth: '3px' }}></div>
                                <strong>Generating detailed lesson... This may take a few seconds.</strong>
                            </div>
                        )}

                        <div
                            className="content-text markdown-body"
                            style={{ margin: '1rem 0', lineHeight: '1.8', position: 'relative', fontSize: '1.05rem', color: 'var(--text-main)' }}
                            onMouseUp={handleMouseUp}
                        >
                            {milestone.detailedContent ? (
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        code({ node, inline, className, children, ...props }) {
                                            const match = /language-(\w+)/.exec(className || '');
                                            if (!inline && match && match[1] === 'mermaid') {
                                                return <MermaidChart chartCode={String(children).replace(/\n$/, '')} />;
                                            }
                                            return <code className={className} {...props}>{children}</code>;
                                        }
                                    }}
                                >
                                    {milestone.detailedContent}
                                </ReactMarkdown>
                            ) : (
                                <p>{milestone.content || "Content is being prepared..."}</p>
                            )}
                        </div>

                        {/* Floating Selection Toolbar */}
                        {selection.text && actionState.type === null && (
                            <div
                                className="selection-toolbar"
                                style={{
                                    position: 'absolute',
                                    top: `${selection.y}px`,
                                    left: `${selection.x}px`,
                                    transform: 'translate(-50%, -100%)',
                                    background: 'rgba(15, 23, 42, 0.95)',
                                    backdropFilter: 'blur(8px)',
                                    color: 'white',
                                    padding: '6px',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    gap: '4px',
                                    zIndex: 1000,
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }}
                            >
                                <button
                                    onClick={async () => {
                                        const newThreadId = `${id}_selection_${Date.now()}`;
                                        setActionState({ type: 'ask', loading: true, result: '', chatHistory: [], error: '', activeThreadId: newThreadId, threads: {} });
                                        try {
                                            const token = localStorage.getItem('auth_token');
                                            if (token) {
                                                const res = await fetch(`/api/chats/${id}/threads`, {
                                                    headers: { 'Authorization': `Bearer ${token}` }
                                                });
                                                if (res.ok) {
                                                    const threadsData = await res.json();
                                                    setActionState(prev => ({
                                                        ...prev,
                                                        loading: false,
                                                        threads: threadsData
                                                    }));
                                                    return;
                                                }
                                            }
                                        } catch (e) {
                                            console.error("Failed to load modal chat history", e);
                                        }
                                        setActionState(prev => ({ ...prev, loading: false }));
                                    }}
                                    style={{ background: 'transparent', color: 'white', border: 'none', padding: '8px 12px', cursor: 'pointer', borderRadius: '8px', fontSize: '0.9rem' }}
                                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    Ask Question
                                </button>
                                <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '4px 0' }}></div>
                                <button
                                    onClick={() => setActionState({ type: 'personalize', loading: false, result: '', chatHistory: [], error: '' })}
                                    style={{ background: 'transparent', color: 'white', border: 'none', padding: '8px 12px', cursor: 'pointer', borderRadius: '8px', fontSize: '0.9rem' }}
                                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    Personalize Content
                                </button>
                                <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '4px 0' }}></div>
                                <button
                                    onClick={() => setActionState({ type: 'visualize', loading: false, result: '', chatHistory: [], error: '' })}
                                    style={{ background: 'transparent', color: 'white', border: 'none', padding: '8px 12px', cursor: 'pointer', borderRadius: '8px', fontSize: '0.9rem' }}
                                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    Visualize It
                                </button>
                            </div>
                        )}

                        {/* Action Modal (Ask or Personalize) - OVERLAY */}
                        {actionState.type !== null && (
                            <div className="action-modal-overlay" style={{
                                position: 'fixed',
                                top: 0, left: 0, right: 0, bottom: 0,
                                backgroundColor: 'rgba(15, 23, 42, 0.7)',
                                backdropFilter: 'blur(4px)',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                zIndex: 2000
                            }}>
                                <div className="action-modal" style={{
                                    background: 'var(--surface-color)',
                                    borderRadius: '16px',
                                    width: '90%',
                                    maxWidth: '1000px',
                                    height: '85vh',
                                    display: 'flex',
                                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    {/* Sidebar for Past Threads */}
                                    {(actionState.type === 'ask' || actionState.type === 'visualize') && (
                                        <div style={{ width: '300px', background: 'var(--bg-color)', borderRight: '1px solid var(--border-color)', padding: '20px', overflowY: 'auto' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{actionState.type === 'ask' ? 'Chat History' : 'Visual History'}</h3>
                                                {actionState.type === 'ask' && (
                                                    <button
                                                        onClick={() => {
                                                            const newThreadId = `${id}_selection_${Date.now()}`;
                                                            setActionState(prev => ({
                                                                ...prev,
                                                                activeThreadId: newThreadId,
                                                                chatHistory: [] // Blank slate
                                                            }));
                                                        }}
                                                        style={{ padding: '8px 12px', background: 'var(--success)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                    >
                                                        + New Chat
                                                    </button>
                                                )}
                                            </div>

                                            {Object.keys(actionState.threads || {}).length === 0 ? (
                                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', marginTop: '40px' }}>No past {actionState.type === 'ask' ? 'chats' : 'visualizations'} found.</p>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    {Object.entries(actionState.threads || {}).map(([threadId, messages]) => {
                                                        const isActive = actionState.activeThreadId === threadId;
                                                        const firstMsg = messages.find(m => m.role === 'user')?.content || "Empty chat";
                                                        const isVoiceThread = threadId === id;
                                                        const title = isVoiceThread ? "Voice AI History" : new Date(parseInt(threadId.split('_').pop()) || Date.now()).toLocaleDateString();
                                                        return (
                                                            <div
                                                                key={threadId}
                                                                onClick={() => {
                                                                    setActionState(prev => ({
                                                                        ...prev,
                                                                        activeThreadId: threadId,
                                                                        chatHistory: messages,
                                                                        result: prev.type === 'visualize' ? (messages.find(m => m.role === 'ai')?.content || '') : prev.result
                                                                    }));
                                                                }}
                                                                style={{
                                                                    padding: '12px',
                                                                    borderRadius: '8px',
                                                                    background: isActive ? 'var(--primary-light)' : 'white',
                                                                    border: isActive ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                                                    cursor: 'pointer',
                                                                    fontSize: '0.9rem',
                                                                    whiteSpace: 'nowrap',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                            >
                                                                <strong style={{ color: isActive ? 'var(--primary-hover)' : 'var(--text-main)' }}>{title}:</strong> <span style={{ color: 'var(--text-muted)' }}>{firstMsg}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Main Chat Area */}
                                    <div 
                                        ref={chatContainerRef}
                                        onScroll={handleModalScroll}
                                        style={{ flex: 1, padding: '30px', display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'var(--surface-color)' }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', position: 'sticky', top: '-30px', paddingTop: '30px', paddingBottom: '10px', background: 'var(--surface-color)', zIndex: 10, borderBottom: '1px solid var(--border-color)' }}>
                                            <h3 style={{ margin: 0, fontSize: '1.4rem' }}>
                                                {actionState.type === 'ask' ? 'Ask a Question about Highlighted Text' :
                                                    actionState.type === 'visualize' ? 'Visualize Highlighted Concept' : 'Personalize Content'}
                                            </h3>
                                            <button
                                                onClick={closeModals}
                                                style={{ background: 'var(--bg-color)', border: '1px solid var(--border-color)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                                            >
                                                ×
                                            </button>
                                        </div>

                                        {(actionState.chatHistory.find(m => m.role === 'user')?.content || selection.text) && (
                                            <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', marginBottom: '24px', padding: '16px', background: 'var(--bg-color)', borderRadius: '8px', borderLeft: '4px solid var(--primary)' }}>
                                                <strong>Context:</strong> "{(actionState.chatHistory.find(m => m.role === 'user')?.content || selection.text).substring(0, 150)}{(actionState.chatHistory.find(m => m.role === 'user')?.content || selection.text).length > 150 ? '...' : ''}"
                                            </p>
                                        )}

                                        {actionState.type === 'visualize' && (
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                                {actionState.loading ? (
                                                    <div className="spinner" style={{ marginBottom: '10px' }}></div>
                                                ) : actionState.result ? (
                                                    <div style={{ width: '100%', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', background: 'var(--bg-color)' }}>
                                                        <MermaidChart chartCode={actionState.result} />
                                                    </div>
                                                ) : null}
                                            </div>
                                        )}

                                        {actionState.type === 'ask' && actionState.chatHistory.length > 0 && (
                                            <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
                                                {actionState.chatHistory.map((msg, i) => (
                                                    <div key={i} style={{
                                                        background: msg.role === 'ai' ? 'white' : 'var(--primary-light)',
                                                        padding: '20px',
                                                        borderRadius: '12px',
                                                        border: msg.role === 'ai' ? '1px solid var(--border-color)' : 'none',
                                                        boxShadow: msg.role === 'ai' ? '0 2px 4px rgba(0,0,0,0.02)' : 'none'
                                                    }}>
                                                        <strong style={{ color: msg.role === 'ai' ? 'var(--primary)' : 'var(--primary-hover)', display: 'block', marginBottom: '10px' }}>{msg.role === 'ai' ? 'Tutor AI:' : 'You:'}</strong>
                                                        <div style={{ lineHeight: '1.6', color: 'var(--text-main)' }} className="markdown-body">
                                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {showScrollButton && (actionState.type === 'ask' || actionState.type === 'visualize') && (
                                            <div style={{ position: 'sticky', bottom: '15px', display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 100, marginTop: '-40px', marginBottom: '15px' }}>
                                                <button 
                                                    onClick={scrollToBottom}
                                                    style={{ pointerEvents: 'auto', padding: '10px 20px', borderRadius: '30px', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                >
                                                    ↓ Scroll to Bottom
                                                </button>
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', gap: '15px', flexDirection: 'column', marginTop: 'auto', background: 'var(--bg-color)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                                <button
                                                    onClick={() => {
                                                        if (isListeningModal) {
                                                            stopListeningModal();
                                                        } else {
                                                            preVoiceInputRef.current = actionInput.trim();
                                                            startListeningModal();
                                                        }
                                                    }}
                                                    style={{
                                                        padding: '12px',
                                                        background: isListeningModal ? '#ef4444' : 'var(--surface-color)',
                                                        color: isListeningModal ? 'white' : 'var(--text-main)',
                                                        border: '1px solid var(--border-color)',
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '1.2rem',
                                                        transition: 'all 0.2s',
                                                        flexShrink: 0
                                                    }}
                                                    title={isListeningModal ? "Stop Listening" : "Voice Input"}
                                                >
                                                    {isListeningModal ? '🛑' : '🎤'}
                                                </button>
                                                <textarea
                                                    value={actionInput}
                                                    onChange={(e) => setActionInput(e.target.value)}
                                                    placeholder={actionState.type === 'ask' ? "Type or speak your question here..." : actionState.type === 'visualize' ? "Optional: Describe how you want it visualized (e.g., 'Make it a mindmap')..." : "e.g., Explain this using an analogy?"}
                                                    rows="3"
                                                    style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', width: '100%', resize: 'vertical', fontFamily: 'Inter', fontSize: '1rem' }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            if (actionState.type === 'visualize') {
                                                                handleVisualizeHighlight();
                                                            } else if (actionInput.trim() && !actionState.loading) {
                                                                actionState.type === 'ask' ? handleAsk() : handlePersonalize();
                                                            }
                                                        }
                                                    }}
                                                />
                                            </div>

                                            <button
                                                onClick={actionState.type === 'visualize' ? handleVisualizeHighlight : (actionState.type === 'ask' ? handleAsk : handlePersonalize)}
                                                disabled={actionState.loading}
                                                style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}
                                            >
                                                {actionState.loading ? 'Processing...' : (actionState.type === 'ask' ? 'Send Question' : actionState.type === 'visualize' ? 'Generate Visualization' : 'Replace & Personalize')}
                                            </button>
                                        </div>

                                        {actionState.error && <p style={{ color: 'var(--error)', marginTop: '15px', textAlign: 'center', fontWeight: '500' }}>{actionState.error}</p>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Sidebar */}
                <div className="right-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'sticky', top: '20px', height: 'calc(100vh - 40px)' }}>
                    <div style={{ padding: '24px', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', borderRadius: '16px', border: '1px solid var(--glass-border)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', borderBottom: '2px solid var(--border-color)', paddingBottom: '8px' }}>Quick Actions</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button
                                onClick={handleOpenAskHistory}
                                style={{ width: '100%', padding: '12px', background: 'var(--bg-color)', color: 'var(--primary)', border: '1px solid var(--primary-light)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '600' }}
                            >
                                💬 View Q&A History
                            </button>
                            <button
                                onClick={handleOpenVisualHistory}
                                style={{ width: '100%', padding: '12px', background: 'var(--bg-color)', color: 'var(--secondary)', border: '1px solid #fce7f3', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '600' }}
                            >
                                📊 View Visualizations
                            </button>

                            {milestone.detailedContent && (
                                <Link to={`/quiz/${id}/initial`} style={{ textDecoration: 'none', marginTop: '10px' }}>
                                    <button style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, var(--success), #059669)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)' }}>
                                        🎯 Take Initial Quiz
                                    </button>
                                </Link>
                            )}
                        </div>
                    </div>

                    <div style={{ padding: '20px', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', borderRadius: '16px', border: '1px solid var(--glass-border)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', flex: 1, minHeight: '300px' }}>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', borderBottom: '2px solid var(--border-color)', paddingBottom: '8px', flexShrink: 0 }}>Need Help?</h3>
                        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                            <DoubtChat milestoneId={id} />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

export default MilestoneDetail;
