import { useState, useRef } from 'react';
import { llmService } from '../../services/llmService';
import { llamaParseService } from '../../services/llamaParseService';

function PathInput({ onPathGenerated }) {
    const [input, setInput] = useState('');
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() && !file) return;

        setLoading(true);
        setError(null);

        let finalQuery = input;

        try {
            if (file) {
                const parsedMarkdown = await llamaParseService.parseFile(file);
                finalQuery = `
The user has provided a TEXT REQUEST and an ATTACHED DOCUMENT.

TEXT REQUEST: "${input || 'Analyze and create a comprehensive learning path based entirely on the attached document.'}"

ATTACHED DOCUMENT CONTENT:
"""
${parsedMarkdown}
"""

CRITICAL INSTRUCTION: You MUST generate a learning path that directly addresses the TEXT REQUEST while explicitly factoring in the specific information, topics, and data found within the ATTACHED DOCUMENT CONTENT. Both inputs must be synthesized together to form the milestones.
`;
            }

            const data = await llmService.generateLearningPath(finalQuery);
            if (data && data.milestones) {
                onPathGenerated(data.milestones, input || "Path from Document", data.graphData);
            }
        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to generate learning path. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div 
            className="path-input-container" 
            style={{ 
                background: 'var(--surface-color)', 
                padding: '40px', 
                borderRadius: '24px', 
                border: '1px solid var(--border-color)', 
                boxShadow: '0 20px 40px rgba(0,0,0,0.06)',
                textAlign: 'left'
            }}
        >
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                
                <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '15px' }}>
                        <span>🎯</span> Learning Objective
                    </label>
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="e.g., I want to master full-stack web development using React and Node.js..."
                        rows="5"
                        disabled={loading}
                        style={{ 
                            width: '100%', 
                            padding: '20px', 
                            borderRadius: '16px', 
                            border: '1px solid var(--border-color)', 
                            background: 'var(--bg-color)', 
                            color: 'var(--text-main)', 
                            fontSize: '1.05rem', 
                            resize: 'vertical',
                            fontFamily: 'inherit',
                            transition: 'border-color 0.2s',
                            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                        }}
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                        onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                    />
                </div>
                
                <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '15px' }}>
                        <span>📄</span> Attach Context Document <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>(Optional)</span>
                    </label>
                    
                    <div 
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => !loading && fileInputRef.current?.click()}
                        style={{
                            border: `2px dashed ${dragActive ? 'var(--primary)' : 'var(--border-color)'}`,
                            borderRadius: '16px',
                            padding: '30px 20px',
                            textAlign: 'center',
                            background: dragActive ? 'rgba(124, 58, 237, 0.05)' : 'var(--bg-color)',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px'
                        }}
                    >
                        <input 
                            ref={fileInputRef}
                            type="file" 
                            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.csv,.html,.epub"
                            onChange={handleFileChange}
                            disabled={loading}
                            style={{ display: 'none' }}
                        />
                        
                        {file ? (
                            <>
                                <div style={{ fontSize: '2.5rem', color: 'var(--primary)' }}>📄</div>
                                <div style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{file.name}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                                <button 
                                    type="button" 
                                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                    style={{ marginTop: '10px', padding: '6px 12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
                                >
                                    Remove File
                                </button>
                            </>
                        ) : (
                            <>
                                <div style={{ fontSize: '2.5rem', color: 'var(--text-muted)' }}>☁️</div>
                                <div style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>Click to upload or drag and drop</div>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>PDF, DOCX, TXT, CSV, Images (powered by LlamaParse)</div>
                            </>
                        )}
                    </div>
                </div>

                {error && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '15px 20px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
                        <span>⚠️</span> {error}
                    </div>
                )}
                
                <button 
                    type="submit" 
                    disabled={(!input.trim() && !file) || loading}
                    style={{ 
                        marginTop: '10px',
                        padding: '18px 30px', 
                        background: (!input.trim() && !file) || loading ? 'var(--surface-color)' : 'linear-gradient(135deg, var(--primary), var(--secondary))', 
                        color: (!input.trim() && !file) || loading ? 'var(--text-muted)' : 'white', 
                        border: (!input.trim() && !file) || loading ? '1px solid var(--border-color)' : 'none', 
                        borderRadius: '16px', 
                        fontSize: '1.2rem', 
                        fontWeight: 'bold', 
                        cursor: (!input.trim() && !file) || loading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s',
                        boxShadow: (!input.trim() && !file) || loading ? 'none' : '0 10px 25px rgba(124, 58, 237, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px'
                    }}
                    onMouseOver={e => {
                        if (!((!input.trim() && !file) || loading)) e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseOut={e => {
                        if (!((!input.trim() && !file) || loading)) e.currentTarget.style.transform = 'translateY(0)';
                    }}
                >
                    {loading ? (
                        <>
                            <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '3px', borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }}></div>
                            {file ? 'Parsing File & Generating Path...' : 'Generating Curriculum...'}
                        </>
                    ) : (
                        <>
                            <span>✨</span> Generate Learning Path
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}

export default PathInput;
