import { useState } from 'react';
import { useLearningPath } from '../../context/LearningPathContext';
import { llmService } from '../../services/llmService';
import { llamaParseService } from '../../services/llamaParseService';

function PathAdjuster() {
    const { milestones, setMilestones } = useLearningPath();
    const [input, setInput] = useState('');
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

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
        <div className="path-adjuster" style={{ margin: '20px 0', padding: '15px', background: '#e3f2fd', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>Adjust Your Learning Path</h3>
            <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem' }}>Want to change direction? Tell me what you'd like to focus on or skip.</p>
            <form onSubmit={handleAdjust} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="e.g., Skip the basics..."
                        disabled={loading}
                        rows="2"
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', resize: 'vertical', fontFamily: 'Inter', fontSize: '0.9rem' }}
                    />
                    
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <label style={{ fontWeight: '600', color: 'var(--text-main)' }}>Attach File (Optional):</label>
                        <input 
                            type="file" 
                            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.csv,.html,.epub"
                            onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                    setFile(e.target.files[0]);
                                }
                            }}
                            disabled={loading}
                            style={{ width: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        />
                    </div>

                    <button type="submit" disabled={(!input && !file) || loading} style={{ width: '100%', marginTop: '5px', padding: '10px', borderRadius: '8px', fontSize: '0.95rem' }}>
                        {loading ? (file ? 'Parsing & Adjusting...' : 'Adjusting...') : 'Update Path'}
                    </button>
                </div>
            </form>
            {error && <div className="error-message" style={{ marginTop: '10px', color: '#d32f2f' }}>{error}</div>}
        </div>
    );
}

export default PathAdjuster;
