import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import { llmService } from '../../services/llmService';
import { useVoiceAssistant } from '../../hooks/useVoiceAssistant';

function DoubtChat({ milestoneId }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const autoTTS = true; // Always read aloud in Voice Mode
    const abortControllerRef = useRef(null);

    const { isListening, isSpeaking, startListening, stopListening, speak } = useVoiceAssistant((transcript, isFinal) => {
        if (isFinal) {
            setInput(''); // Clear input box since we submitted
            handleAsk(transcript); // Instantly submit!
        } else {
            setInput(transcript); // Replace, don't append, because interim transcripts contain the full phrase
            
            // If the user starts talking, abort any currently generating AI stream!
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        }
    });

    const handleStopAll = () => {
        stopListening();
        window.speechSynthesis.cancel();
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setLoading(false);
        setInput('');
    };

    // Load historical chats on mount
    useEffect(() => {
        const fetchHistory = async () => {
            const token = localStorage.getItem('auth_token');
            if (!token || !milestoneId) return;

            try {
                const res = await fetch(`/api/chats/${milestoneId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setMessages(data.map(c => ({ role: c.role, content: c.content })));
                }
            } catch (err) {
                console.error("Failed to fetch chat history:", err);
            }
        };
        fetchHistory();
    }, [milestoneId]);

    const saveMessage = async (role, content) => {
        const token = localStorage.getItem('auth_token');
        if (!token) return;

        await fetch('/api/chats', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ role, content, contextRef: milestoneId })
        }).catch(err => console.error("Failed to save chat message:", err));
    };

    const handleAsk = async (forcedInput) => {
        const currentInput = typeof forcedInput === 'string' ? forcedInput : input;
        if (!currentInput.trim() && !file) return;

        // Stop the previous generation if user interrupts
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        const currentAbort = abortControllerRef.current;

        const userMessage = { role: 'user', content: currentInput };
        
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setFile(null);
        setLoading(true);

        // Optimistically save user message
        saveMessage('user', currentInput);

        try {
            // Add empty AI message placeholder for streaming
            setMessages(prev => [...prev, { role: 'ai', content: '' }]);

            let buffer = "";
            let displayContent = "";
            let spokenLength = 0; // Track what has been sent to TTS
            let isStreamDone = false;

            const stream = llmService.streamDoubtAnswer(currentInput);
            
            (async () => {
                try {
                    for await (const chunk of stream) { buffer += chunk; }
                } catch(e) { console.error(e); } 
                finally { isStreamDone = true; }
            })();
            
            while (!isStreamDone || displayContent.length < buffer.length) {
                if (currentAbort.signal.aborted) {
                    console.log("Stream interrupted by user.");
                    break;
                }
                
                if (displayContent.length < buffer.length) {
                    const stepText = buffer.slice(displayContent.length, displayContent.length + 4);
                    displayContent += stepText;
                    setMessages(prev => {
                        const newMessages = [...prev];
                        const lastIndex = newMessages.length - 1;
                        newMessages[lastIndex] = { ...newMessages[lastIndex], content: displayContent };
                        return newMessages;
                    });
                }
                
                // Stream audio chunk by chunk (sentence by sentence)
                if (autoTTS && !currentAbort.signal.aborted) {
                    const currentUnspoken = displayContent.slice(spokenLength);
                    // Match a full sentence ending in . ? or !
                    const match = currentUnspoken.match(/^.*?[.!?]+(?=\s|$)/);
                    if (match) {
                        const sentence = match[0];
                        speak(sentence, null, false); // false = don't clear queue, just append
                        spokenLength += sentence.length;
                    }
                }

                await new Promise(r => setTimeout(r, 15));
            }

            // Speak any remaining text at the end
            if (!currentAbort.signal.aborted && autoTTS && spokenLength < displayContent.length) {
                const remainder = displayContent.slice(spokenLength);
                if (remainder.trim()) {
                    speak(remainder, null, false);
                }
            }

            if (!currentAbort.signal.aborted) {
                saveMessage('ai', displayContent);
            }
        } catch (err) {
            console.error('Error asking question:', err);
            const errorMessage = { role: 'ai', content: err.message || 'Connection error. Please try again later.' };
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = errorMessage; // Replace empty stream placeholder
                return newMessages;
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="doubt-chat" style={{ display: 'flex', flexDirection: 'column', height: '100%', margin: 0, border: 'none', boxShadow: 'none', background: 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '20px' }}>
                
                <h3 style={{ margin: '0 0 20px 0', color: 'var(--text-main)', fontSize: '1.4rem' }}>
                    Hands-Free AI Tutor
                </h3>

                <button 
                    onClick={(isListening || loading || isSpeaking) ? handleStopAll : startListening}
                    style={{ 
                        padding: '12px 28px',
                        borderRadius: '30px',
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        background: (isListening || loading || isSpeaking) ? 'rgba(239, 68, 68, 0.1)' : 'var(--primary)',
                        color: (isListening || loading || isSpeaking) ? '#ef4444' : 'white',
                        border: (isListening || loading || isSpeaking) ? '2px solid #ef4444' : '2px solid var(--primary)',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: (isListening || loading || isSpeaking) ? '0 0 20px rgba(239, 68, 68, 0.2)' : '0 4px 10px rgba(0,0,0,0.1)',
                        zIndex: 2
                    }}
                >
                    <span style={{ fontSize: '1.4rem' }}>{(isListening || loading || isSpeaking) ? '⏹️' : '🎙️'}</span>
                    {(isListening || loading || isSpeaking) ? 'Deactivate Voice Mode' : 'Activate Voice Mode'}
                </button>

                <div style={{ marginTop: '30px', minHeight: '100px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {(isListening || loading || isSpeaking) ? (
                        <>
                            <div style={{ 
                                fontSize: '2.5rem', 
                                marginBottom: '10px',
                                animation: (isListening || loading) ? 'pulse 1.5s infinite' : 'none',
                                filter: isListening ? 'drop-shadow(0 0 10px rgba(239,68,68,0.5))' : 'none'
                            }}>
                                {isListening ? '👂' : (isSpeaking ? '🗣️' : '🧠')}
                            </div>
                            <h4 style={{ margin: '0 0 8px 0', color: isListening ? '#ef4444' : 'var(--primary)' }}>
                                {isListening ? 'Listening...' : (isSpeaking ? 'Speaking...' : 'Processing...')}
                            </h4>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '240px', margin: '0', fontStyle: 'italic', lineHeight: '1.4' }}>
                                {input ? `"${input}"` : (isListening ? "Speak naturally to ask a question..." : "")}
                            </p>
                        </>
                    ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '240px', margin: '0', lineHeight: '1.5' }}>
                            Click to activate hands-free continuous conversation.
                        </p>
                    )}
                </div>

            </div>
            
            <style>{`
                @keyframes pulse {
                    0% { transform: scale(0.95); opacity: 1; }
                    100% { transform: scale(1.3); opacity: 0; }
                }
            `}</style>
        </div>
    );
}

DoubtChat.propTypes = {
    milestoneId: PropTypes.string.isRequired,
};

export default DoubtChat;
