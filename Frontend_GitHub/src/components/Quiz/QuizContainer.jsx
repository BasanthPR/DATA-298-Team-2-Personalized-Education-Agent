import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useLearningPath } from '../../context/LearningPathContext';
import { llmService } from '../../services/llmService';
import Question from './Question';

function QuizContainer({ milestoneContext, type }) {
    const navigate = useNavigate();
    const { completeMilestone, milestones, updateGraphNodeScore } = useLearningPath();
    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [loading, setLoading] = useState(false); // Initially false, waiting for start
    const [error, setError] = useState(null);
    const [quizCompleted, setQuizCompleted] = useState(false);
    
    // New state for Inline Personalization
    const [quizInstruction, setQuizInstruction] = useState('');
    const [showPersonalization, setShowPersonalization] = useState(false);

    const fetchNextQuestion = async (history) => {
        setLoading(true);
        setError(null);
        try {
            const data = await llmService.generateNextQuizQuestion(milestoneContext, type, history, quizInstruction);
            if (data && data.question) {
                setQuestions(prev => [...prev, data.question]);
                setCurrentIndex(history.length);
            }
        } catch (err) {
            console.error('Error fetching question:', err);
            setError(err.message || 'Failed to generate question. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const [pastHistory, setPastHistory] = useState([]);
    const [isAnswered, setIsAnswered] = useState(false);
    const hasFetchedInitial = React.useRef(false);

    // Auto-fetch the first question
    useEffect(() => {
        if (milestoneContext && !hasFetchedInitial.current) {
            hasFetchedInitial.current = true;
            fetchNextQuestion([]);
        }
    }, [milestoneContext, type]);

    const handleSubmitAnswer = async (answer) => {
        try {
            const currentQuestion = questions[currentIndex];
            const isCorrect = answer === currentQuestion.correctAnswer;

            if (isCorrect) {
                setScore(prev => prev + 1);
            }
            
            if (currentQuestion.targetConceptId && updateGraphNodeScore) {
                updateGraphNodeScore(currentQuestion.targetConceptId, isCorrect);
            }

            // Save to history so LLM knows what we already answered, and we can display it later
            setPastHistory(prev => [
                ...prev, 
                { text: currentQuestion.text, userAnswer: answer, correctAnswer: currentQuestion.correctAnswer, isCorrect }
            ]);
            
            setIsAnswered(true);

            return {
                correct: isCorrect,
                explanation: currentQuestion.explanation
            };
        } catch (err) {
            console.error('Error scoring answer:', err);
            return { explanation: "Error checking answer." };
        }
    };

    const handleNext = () => {
        setIsAnswered(false);
        fetchNextQuestion(pastHistory);
    };

    const handleCompleteEarly = async () => {
        setQuizCompleted(true);
        try {
            await completeMilestone(milestoneContext.id);
        } catch (e) {
            console.log("Error marking milestone complete:", e);
        }
    };
    
    // -------------------------------------------------------------
    // RENDER: Loading & Error States
    // -------------------------------------------------------------
    if (loading && questions.length === 0) return (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--surface-color)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            <div className="spinner" style={{ width: '40px', height: '40px', marginBottom: '20px' }}></div>
            <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Generating personalized question...</h3>
            <p style={{ color: 'var(--text-muted)', marginTop: '10px' }}>Analyzing your learning path to find the best concept to test.</p>
        </div>
    );
    
    if (error && questions.length === 0) return (
        <div className="error" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '20px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', textAlign: 'center' }}>
            <span style={{ fontSize: '2rem', display: 'block', marginBottom: '10px' }}>⚠️</span>
            {error}
        </div>
    );
    
    // -------------------------------------------------------------
    // RENDER: Quiz Summary & History
    // -------------------------------------------------------------
    if (quizCompleted) {
        const currentMilestoneIndex = milestones.findIndex(m => String(m.id) === String(milestoneContext.id));
        const nextMilestone = milestones[currentMilestoneIndex + 1];
        const accuracy = Math.round((score / questions.length) * 100) || 0;

        return (
            <div className="quiz-summary-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                <div className="quiz-summary" style={{ background: 'var(--surface-color)', padding: '50px 30px', borderRadius: '24px', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.08)', textAlign: 'center' }}>
                    <div style={{ fontSize: '5rem', marginBottom: '10px', animation: 'bounce 2s infinite' }}>🎉</div>
                    <h2 style={{ fontSize: '2.2rem', margin: '0 0 10px 0', color: 'var(--text-main)' }}>Quiz Completed!</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '40px' }}>Great job completing this assessment.</p>
                    
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', margin: '30px 0', flexWrap: 'wrap' }}>
                        <div style={{ background: 'var(--bg-color)', padding: '25px 35px', borderRadius: '16px', border: '1px solid var(--border-color)', minWidth: '140px' }}>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', fontWeight: 'bold' }}>Questions</div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{questions.length}</div>
                        </div>
                        <div style={{ background: 'var(--bg-color)', padding: '25px 35px', borderRadius: '16px', border: '1px solid var(--border-color)', minWidth: '140px' }}>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', fontWeight: 'bold' }}>Correct</div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#10b981' }}>{score}</div>
                        </div>
                        <div style={{ background: 'var(--bg-color)', padding: '25px 35px', borderRadius: '16px', border: '1px solid var(--border-color)', minWidth: '140px' }}>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', fontWeight: 'bold' }}>Accuracy</div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: accuracy >= 70 ? 'var(--primary)' : '#f59e0b' }}>{accuracy}%</div>
                        </div>
                    </div>

                    <div className="summary-actions" style={{ marginTop: '50px', display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button 
                            onClick={() => navigate(`/milestone/${milestoneContext.id}`)} 
                            style={{ padding: '14px 28px', background: 'transparent', color: 'var(--text-main)', border: '2px solid var(--border-color)', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.05rem', transition: 'all 0.2s' }}
                            onMouseOver={e => e.currentTarget.style.borderColor = 'var(--text-muted)'}
                            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                        >
                            Review Material
                        </button>

                        {nextMilestone && (
                            <button
                                onClick={() => navigate(`/milestone/${nextMilestone.id}`)}
                                style={{ padding: '14px 28px', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.05rem', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)', transition: 'transform 0.2s' }}
                                onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                Start Next: {nextMilestone.title}
                            </button>
                        )}

                        <button 
                            onClick={() => navigate('/dashboard')} 
                            style={{ padding: '14px 28px', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.05rem', boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)', transition: 'transform 0.2s' }}
                            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            Course Dashboard
                        </button>
                    </div>
                </div>

                {/* Quiz History Section */}
                {pastHistory.length > 0 && (
                    <div className="quiz-history" style={{ background: 'var(--surface-color)', padding: '40px', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ fontSize: '1.8rem', color: 'var(--text-main)', margin: '0 0 25px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span>📝</span> Quiz History
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {pastHistory.map((item, idx) => (
                                <div key={idx} style={{ 
                                    padding: '20px', 
                                    background: 'var(--bg-color)', 
                                    borderRadius: '16px', 
                                    border: '1px solid', 
                                    borderColor: item.isCorrect ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                                    borderLeft: `6px solid ${item.isCorrect ? '#10b981' : '#ef4444'}`
                                }}>
                                    <h4 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
                                        <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>Q{idx + 1}:</span>
                                        {item.text}
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                            <strong style={{ color: 'var(--text-muted)', minWidth: '100px' }}>Your Answer:</strong>
                                            <span style={{ color: item.isCorrect ? '#10b981' : '#ef4444', fontWeight: '500' }}>
                                                {item.userAnswer} {item.isCorrect ? '✓' : '×'}
                                            </span>
                                        </div>
                                        {!item.isCorrect && (
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                                <strong style={{ color: 'var(--text-muted)', minWidth: '100px' }}>Correct Answer:</strong>
                                                <span style={{ color: '#10b981', fontWeight: '500' }}>{item.correctAnswer} ✓</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // -------------------------------------------------------------
    // RENDER: Active Quiz Loop
    // -------------------------------------------------------------
    return (
        <div className="quiz-container">
            <div className="quiz-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', padding: '15px 25px', background: 'var(--glass-bg)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: '1px solid var(--glass-border)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '0.9rem', letterSpacing: '1px', textTransform: 'uppercase' }}>Question {currentIndex + 1}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>Score</span>
                    <span style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))', color: 'white', padding: '6px 16px', borderRadius: '20px', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)' }}>
                        {Math.max(0, score)} <span style={{opacity: 0.7, fontSize: '0.9rem'}}>/ {questions.length}</span>
                    </span>
                </div>
            </div>

            {questions[currentIndex] && (
                <Question
                    key={currentIndex}
                    question={questions[currentIndex]}
                    onSubmit={handleSubmitAnswer}
                />
            )}

            {loading && currentIndex >= questions.length && (
                <div style={{ marginTop: '30px', textAlign: 'center', padding: '30px', background: 'var(--surface-color)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <div className="spinner" style={{ marginBottom: '15px' }}></div>
                    <p style={{ margin: 0, color: 'var(--text-main)', fontWeight: 'bold' }}>Analyzing your answer...</p>
                    <p style={{ marginTop: '5px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Generating the perfect next question for you.</p>
                </div>
            )}

            {!loading && isAnswered && questions.length > 0 && (
                <div style={{ marginTop: '30px', background: 'var(--surface-color)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <div 
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: 'var(--text-main)', fontWeight: 'bold' }}
                        onClick={() => setShowPersonalization(!showPersonalization)}
                    >
                        <span style={{ fontSize: '1.2rem', transition: 'transform 0.2s', transform: showPersonalization ? 'rotate(90deg)' : 'rotate(0)' }}>▶</span>
                        ⚙️ Want to personalize the next question?
                    </div>
                    
                    {showPersonalization && (
                        <div style={{ marginTop: '15px' }}>
                            <textarea 
                                value={quizInstruction}
                                onChange={(e) => setQuizInstruction(e.target.value)}
                                placeholder="e.g., 'Make it harder', 'Use Python examples', 'Test me on real-world scenarios'"
                                style={{ width: '100%', height: '80px', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '1rem', resize: 'vertical', fontFamily: 'inherit' }}
                            />
                        </div>
                    )}
                </div>
            )}

            <div style={{ marginTop: '20px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {!loading && isAnswered && questions[currentIndex] && (
                    <button 
                        onClick={handleNext} 
                        className="next-button" 
                        style={{ flex: 1, padding: '16px', background: 'var(--surface-color)', color: 'var(--text-main)', border: '2px solid var(--border-color)', borderRadius: '12px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', transition: 'all 0.2s', minWidth: '200px' }}
                        onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                        onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-main)'; }}
                    >
                        Generate Next Question
                    </button>
                )}
                {!loading && isAnswered && questions.length > 0 && (
                    <button 
                        onClick={handleCompleteEarly} 
                        className="finish-button" 
                        style={{ flex: 1, padding: '16px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)', transition: 'transform 0.2s', minWidth: '200px' }}
                        onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        Finish Quiz & View Summary
                    </button>
                )}
            </div>
            {error && <div className="error" style={{ marginTop: '20px', padding: '15px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px' }}>{error}</div>}
        </div>
    );
}

QuizContainer.propTypes = {
    milestoneContext: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        title: PropTypes.string,
        topics: PropTypes.arrayOf(PropTypes.string),
        content: PropTypes.string,
    }).isRequired,
    type: PropTypes.string.isRequired,
};

export default QuizContainer;
