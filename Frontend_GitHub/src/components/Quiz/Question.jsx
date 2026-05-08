import { useState } from 'react';
import PropTypes from 'prop-types';
import { llmService } from '../../services/llmService';
import MermaidChart from '../Shared/MermaidChart';

function Question({ question, onSubmit }) {
    const [selected, setSelected] = useState(null);
    const [submitted, setSubmitted] = useState(false);
    const [explanation, setExplanation] = useState('');
    const [diagramCode, setDiagramCode] = useState('');
    const [loadingDiagram, setLoadingDiagram] = useState(false);

    const handleVisualize = async () => {
        setLoadingDiagram(true);
        try {
            const data = await llmService.visualizeExplanation(explanation);
            if (data && data.mermaidCode) {
                const cleanedCode = data.mermaidCode.replace(/```mermaid/gi, "").replace(/```/g, "").trim();
                setDiagramCode(cleanedCode);
            }
        } catch (err) {
            console.error("Diagram error", err);
        }
        setLoadingDiagram(false);
    };

    const handleSubmit = async () => {
        setSubmitted(true);
        const result = await onSubmit(selected);
        if (result && result.explanation) {
            setExplanation(result.explanation);
        }
    };

    if (!question) return null;

    return (
        <div className="question-container" style={{ background: 'var(--surface-color)', padding: '40px', borderRadius: '24px', border: '1px solid var(--border-color)', boxShadow: '0 10px 40px rgba(0,0,0,0.04)' }}>
            <h2 style={{ fontSize: '1.6rem', color: 'var(--text-main)', margin: '0 0 35px 0', lineHeight: '1.5' }}>{question.text}</h2>

            <div className="options-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {question.options.map((option, index) => {
                    const isSelected = selected === option;
                    const isCorrectOption = submitted && option === question.correctAnswer;
                    const isWrongSelection = submitted && isSelected && option !== question.correctAnswer;
                    
                    let bg = 'var(--bg-color)';
                    let border = '1px solid var(--border-color)';
                    let color = 'var(--text-main)';
                    let opacity = 1;
                    
                    if (isSelected && !submitted) {
                        bg = 'rgba(124, 58, 237, 0.05)';
                        border = '1px solid var(--primary)';
                    } else if (isCorrectOption) {
                        bg = 'rgba(16, 185, 129, 0.1)';
                        border = '1px solid #10b981';
                        color = '#059669';
                    } else if (isWrongSelection) {
                        bg = 'rgba(239, 68, 68, 0.1)';
                        border = '1px solid #ef4444';
                        color = '#dc2626';
                    } else if (submitted) {
                        opacity = 0.5;
                    }

                    return (
                        <button
                            key={index}
                            onClick={() => !submitted && setSelected(option)}
                            style={{
                                padding: '18px 24px',
                                background: bg,
                                border: border,
                                color: color,
                                borderRadius: '16px',
                                fontSize: '1.1rem',
                                textAlign: 'left',
                                cursor: submitted ? 'default' : 'pointer',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                opacity: opacity,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '18px'
                            }}
                            onMouseOver={(e) => {
                                if (!submitted && !isSelected) {
                                    e.currentTarget.style.borderColor = 'var(--primary-light)';
                                    e.currentTarget.style.transform = 'translateX(4px)';
                                }
                            }}
                            onMouseOut={(e) => {
                                if (!submitted && !isSelected) {
                                    e.currentTarget.style.borderColor = 'var(--border-color)';
                                    e.currentTarget.style.transform = 'translateX(0)';
                                }
                            }}
                            disabled={submitted}
                        >
                            <div style={{ 
                                width: '32px', height: '32px', borderRadius: '50%', 
                                border: isSelected || isCorrectOption || isWrongSelection ? 'none' : '2px solid var(--border-color)',
                                background: isCorrectOption ? '#10b981' : isWrongSelection ? '#ef4444' : isSelected ? 'var(--primary)' : 'transparent',
                                color: isSelected || isCorrectOption || isWrongSelection ? 'white' : 'var(--text-muted)', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0,
                                fontWeight: 'bold'
                            }}>
                                {isCorrectOption ? '✓' : isWrongSelection ? '×' : String.fromCharCode(65 + index)}
                            </div>
                            <span style={{ lineHeight: '1.4' }}>{option}</span>
                        </button>
                    )
                })}
            </div>

            {!submitted ? (
                <div style={{ marginTop: '35px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={handleSubmit}
                        disabled={!selected}
                        style={{
                            padding: '16px 40px',
                            background: selected ? 'linear-gradient(135deg, var(--primary), var(--secondary))' : 'var(--bg-color)',
                            color: selected ? 'white' : 'var(--text-muted)',
                            border: selected ? 'none' : '1px solid var(--border-color)',
                            borderRadius: '16px',
                            fontSize: '1.15rem',
                            fontWeight: 'bold',
                            cursor: selected ? 'pointer' : 'not-allowed',
                            transition: 'all 0.3s',
                            boxShadow: selected ? '0 4px 15px rgba(124, 58, 237, 0.3)' : 'none'
                        }}
                    >
                        Submit Answer
                    </button>
                </div>
            ) : (
                <div className="explanation-panel" style={{ marginTop: '35px', padding: '30px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <h3 style={{ margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '10px', color: '#2563eb', fontSize: '1.4rem' }}>
                        <span>💡</span> AI Explanation
                    </h3>
                    <p style={{ margin: 0, lineHeight: '1.7', color: 'var(--text-main)', fontSize: '1.1rem' }}>{explanation}</p>
                    
                    {explanation && !diagramCode && (
                        <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button 
                                onClick={handleVisualize} 
                                disabled={loadingDiagram} 
                                style={{
                                    padding: '12px 24px', 
                                    background: 'white', 
                                    color: '#2563eb', 
                                    border: '1px solid rgba(59, 130, 246, 0.3)', 
                                    borderRadius: '12px', 
                                    cursor: loadingDiagram ? 'wait' : 'pointer', 
                                    fontWeight: 'bold', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '10px', 
                                    transition: 'all 0.2s',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                                }}
                                onMouseOver={e => !loadingDiagram && (e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)')}
                                onMouseOut={e => !loadingDiagram && (e.currentTarget.style.background = 'white')}
                            >
                                {loadingDiagram ? (
                                    <><div className="spinner" style={{width: '18px', height: '18px', borderWidth: '2px', borderColor: '#2563eb', borderTopColor: 'transparent'}}></div> Generating Visualization...</>
                                ) : (
                                    <><span>📊</span> Visualize this Explanation</>
                                )}
                            </button>
                        </div>
                    )}
                    
                    {diagramCode && (
                        <div style={{marginTop: '25px', background: 'white', padding: '25px', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.2)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                            <h4 style={{ margin: '0 0 20px 0', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>📈</span> Concept Visualization
                            </h4>
                            <div style={{ overflowX: 'auto' }}>
                                <MermaidChart chartCode={diagramCode} />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

Question.propTypes = {
    question: PropTypes.shape({
        text: PropTypes.string.isRequired,
        options: PropTypes.arrayOf(PropTypes.string).isRequired,
        correctAnswer: PropTypes.string,
        explanation: PropTypes.string,
    }).isRequired,
    onSubmit: PropTypes.func.isRequired,
};

export default Question;
