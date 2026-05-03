import { useNavigate } from 'react-router-dom';
import PathInput from '../components/LearningPath/PathInput';
import Navbar from '../components/Shared/Navbar';
import { useLearningPath } from '../context/LearningPathContext';

function CreatePath() {
    const navigate = useNavigate();
    const { createNewPath } = useLearningPath();

    const handlePathGenerated = (milestones, query, graphData) => {
        createNewPath(query, milestones, graphData);
        navigate('/dashboard');
    };

    return (
        <div className="create-path-page">
            <Navbar />
            <div className="hero-section" style={{ marginTop: '50px' }}>
                <PathInput onPathGenerated={handlePathGenerated} />
            </div>
        </div>
    );
}

export default CreatePath;
