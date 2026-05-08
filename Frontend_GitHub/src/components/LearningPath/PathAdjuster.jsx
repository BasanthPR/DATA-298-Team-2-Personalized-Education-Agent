import { useState, useRef } from 'react';
import { useLearningPath } from '../../context/LearningPathContext';
import { llmService } from '../../services/llmService';
import { llamaParseService } from '../../services/llamaParseService';

function PathAdjuster({ compact = false }) {
    const { milestones, setMilestones } = useLearningPath();
    const [input, setInput] = useState('');
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);

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

    const handleAdjust = async (e) => {
        e.preventDefault();
        if (!input.trim() && !file) return;

        setLoading(true);
        setError(null);

        let finalQuery = input;

        try {
            if (file) {
                const parsedMarkdown = await llamaParseService.parseFile(file);
                finalQuery = `
The user has provided a TEXT ADJUSTMENT REQUEST and an ATTACHED DOCUMENT.

TEXT ADJUSTMENT REQUEST: "${input || 'Adjust the path based heavily on the contents of the attached document'}"

ATTACHED DOCUMENT CONTENT:
"""
${parsedMarkdown}
"""

CRITICAL INSTRUCTION: You MUST adjust the existing learning path by satisfying the TEXT ADJUSTMENT REQUEST while explicitly factoring in the newly provided ATTACHED DOCUMENT CONTENT. Both inputs must be treated with equal weight and synthesized seamlessly into the modifications.
`;
            }

            const data = await llmService.adjustLearningPath(milestones, finalQuery);
            if (data && data.milestones) {
                setMilestones(data.milestones);
                setInput('');
                setFile(null);
            }
        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to adjust learning path. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (!milestones || milestones.length === 0) return null;

    return (
        <div className="path-adjuster" style={{ margin: compact ? '0' : '20px 0', padding: compact ? '0' : '30px', background: compact ? 'transparent' : 'var(--glass-bg)', backdropFilter: compact ? 'none' : 'blur(12px)', borderRadius: compact ? '0' : '16px', border: compact ? 'none' : '1px solid var(--glass-border)', boxShadow: compact ? 'none' : '0 4px 20px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px', flexDirection: compact ? 'column' : 'row', textAlign: compact ? 'center' : 'left' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', fontSize: '1.2rem', flexShrink: 0 }}>
                    🔧
                </div>
                <div>
                    <h3 style={{ margin: '0 0 5px 0', fontSize: compact ? '1.1rem' : '1.4rem', color: 'var(--text-main)' }}>Adjust Your Learning Path</h3>
                    <p style={{ margin: 0, fontSize: compact ? '0.85rem' : '0.95rem', color: 'var(--text-muted)' }}>Want to change direction? Tell Tutor AI what to focus on or skip.</p>
                </div>
            </div>

            <form onSubmit={handleAdjust} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="e.g., Skip the basics and add a module on advanced state management..."
                    disabled={loading}
                    rows="3"
                    style={{ 
                        width: '100%', 
                        padding: '15px', 
                        borderRadius: '12px', 
                        border: '1px solid var(--border-color)', 
                        background: 'var(--bg-color)', 
                        color: 'var(--text-main)',
                        resize: 'vertical', 
                        fontFamily: 'inherit', 
                        fontSize: '1rem',
                        transition: 'border-color 0.2s',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
                    onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                />
                
                <div 
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => !loading && fileInputRef.current?.click()}
                    style={{
                        border: `2px dashed ${dragActive ? '#3b82f6' : 'var(--border-color)'}`,
                        borderRadius: '12px',
                        padding: file ? '15px' : '20px 15px',
                        textAlign: 'center',
                        background: dragActive ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-color)',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                    }}
                >
                    <input 
                        ref={fileInputRef}
                        type="file" 
                        accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.csv,.html,.epub"
                        onChange={(e) => {
                            if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
                        }}
                        disabled={loading}
                        style={{ display: 'none' }}
                    />
                    
                    {file ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', justifyContent: 'space-between', padding: '0 10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                                <span style={{ fontSize: '1.5rem', color: '#3b82f6' }}>📄</span>
                                <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                                    <div style={{ fontWeight: 'bold', color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '250px' }}>{file.name}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                style={{ padding: '6px 12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', flexShrink: 0 }}
                            >
                                Remove
                            </button>
                        </div>
                    ) : (
                        <>
                            <div style={{ fontSize: compact ? '1.2rem' : '1.8rem', color: 'var(--text-muted)' }}>☁️</div>
                            <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: compact ? '0.85rem' : '0.95rem' }}>Click or drag a file to attach context</div>
                            <div style={{ fontSize: compact ? '0.7rem' : '0.8rem', color: 'var(--text-muted)' }}>PDF, DOCX, Images (Optional)</div>
                        </>
                    )}
                </div>

                <button 
                    type="submit" 
                    disabled={(!input && !file) || loading} 
                    style={{ 
                        width: '100%', 
                        padding: compact ? '10px' : '14px', 
                        borderRadius: '12px', 
                        fontSize: compact ? '0.95rem' : '1.05rem',
                        fontWeight: 'bold',
                        background: (!input && !file) || loading ? 'var(--surface-color)' : '#3b82f6',
                        color: (!input && !file) || loading ? 'var(--text-muted)' : 'white',
                        border: (!input && !file) || loading ? '1px solid var(--border-color)' : 'none',
                        cursor: (!input && !file) || loading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px'
                    }}
                >
                    {loading ? (
                        <>
                            <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px', borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }}></div>
                            {file ? 'Parsing & Adjusting...' : 'Updating Path...'}
                        </>
                    ) : (
                        <>
                            <span>⚡</span> Update Path
                        </>
                    )}
                </button>
            </form>
            {error && (
                <div style={{ marginTop: '15px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px 15px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.95rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>⚠️</span> {error}
                </div>
            )}
        </div>
    );
}

export default PathAdjuster;
