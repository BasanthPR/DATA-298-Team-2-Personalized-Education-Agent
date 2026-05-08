import { useState } from 'react';
import { llmService } from '../../services/llmService';
import { llamaParseService } from '../../services/llamaParseService';


function PathInput({ onPathGenerated }) {
    const [input, setInput] = useState('');
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
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
                // If there's an attachment, parse it with LlamaParse first
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
        <div className="path-input-container">
            <h1>What would you like to learn?</h1>
            <form onSubmit={handleSubmit}>
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="e.g., I want to learn about fine-tuning LLMs"
                    rows="4"
                    disabled={loading}
                />
                
                <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                    <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px', fontWeight: 'bold' }}>
                        Attach Context Document (Optional, LlamaParse):
                    </label>
                    <input 
                        type="file" 
                        accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.csv,.html,.epub"
                        onChange={handleFileChange}
                        disabled={loading}
                    />
                </div>

                {error && <div className="error-message">{error}</div>}
                <button type="submit" disabled={(!input && !file) || loading}>
                    {loading ? (file ? 'Parsing file & Generating...' : 'Generating...') : 'Create Learning Path'}
                </button>
            </form>
        </div>
    );
}

export default PathInput;
