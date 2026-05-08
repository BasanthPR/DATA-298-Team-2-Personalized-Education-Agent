import { useNavigate } from 'react-router-dom';
import PathInput from '../components/LearningPath/PathInput';
import Navbar from '../components/Shared/Navbar';
import { useLearningPath } from '../context/LearningPathContext';

function CreatePath() {
    const navigate = useNavigate();
    const { createNewPath } = useLearningPath();

    const handlePathGenerated = async (milestones, query, graphData) => {
        await createNewPath(query, milestones, graphData);
        navigate('/dashboard');
    };

    return (
        <div className="create-path-page" style={{ minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-main)', paddingBottom: '60px' }}>
            <Navbar />
            <div className="hero-section" style={{ maxWidth: '900px', margin: '40px auto', padding: '0 20px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '3rem', margin: '0 0 15px 0', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: '1.2' }}>
                    Design Your Learning Journey
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', marginBottom: '40px', maxWidth: '600px', margin: '0 auto 40px auto', lineHeight: '1.6' }}>
                    Tell Tutor AI exactly what you want to master. Attach syllabus documents or just type your goals, and we'll dynamically build your curriculum.
                </p>
                
                <PathInput onPathGenerated={handlePathGenerated} />
            </div>
        </div>
    );
}

export default CreatePath;
