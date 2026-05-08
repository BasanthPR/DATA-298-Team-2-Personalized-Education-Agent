import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Shared/Navbar';
import QuizContainer from '../components/Quiz/QuizContainer';
import { useLearningPath } from '../context/LearningPathContext';

function QuizPage() {
    const { milestoneId, type } = useParams();
    const { getMilestoneById, learningPaths, currentPathId } = useLearningPath();
    const [milestone, setMilestone] = useState(null);
    const currentPath = learningPaths.find(p => String(p.id) === String(currentPathId));

    useEffect(() => {
        // Fetch the milestone details to pass as context
        const found = getMilestoneById(milestoneId);
        setMilestone(found);
    }, [milestoneId, getMilestoneById]);

    if (!milestone) return (
        <div className="quiz-page" style={{ minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-main)' }}>
            <Navbar />
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <div className="spinner"></div>
            </div>
        </div>
    );

    // Prepare context object with defaults if specific fields are missing
    const milestoneContext = {
        id: milestone.id,
        title: milestone.title,
        topics: milestone.topics || [],
        content: milestone.detailedContent || milestone.content || "General knowledge",
        graphData: currentPath?.graphData,
    };

    return (
        <div className="quiz-page" style={{ minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-main)', paddingBottom: '60px' }}>
            <Navbar />
            <div className="quiz-content-wrapper" style={{ maxWidth: '900px', margin: '40px auto', padding: '0 20px' }}>
                <div className="quiz-header-section" style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <h1 style={{ fontSize: '2.5rem', margin: '0 0 10px 0', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        {type === 'initial' ? 'Initial Assessment' : 'Knowledge Check'}
                    </h1>
                    <h3 className="subtitle" style={{ color: 'var(--text-muted)', margin: '0 0 25px 0', fontSize: '1.2rem', fontWeight: 'normal' }}>
                        Topic: <span style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>{milestone.title}</span>
                    </h3>
                    <Link 
                        to={`/milestone/${milestoneId}`} 
                        style={{ display: 'inline-block', padding: '10px 20px', background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '20px', color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.95rem', transition: 'all 0.2s', fontWeight: 'bold' }}
                        onMouseOver={e => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
                        onMouseOut={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                    >
                        ← Return to Milestone
                    </Link>
                </div>

                <QuizContainer milestoneContext={milestoneContext} type={type} />
            </div>
        </div>
    );
}

export default QuizPage;
