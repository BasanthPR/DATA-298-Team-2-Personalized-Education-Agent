import { createContext, useContext, useState, useEffect } from "react";
import { llmService } from "../services/llmService";

const LearningPathContext = createContext();

export const LearningPathProvider = ({ children }) => {
    const [learningPaths, setLearningPaths] = useState([]);
    const [currentPathId, setCurrentPathId] = useState(null);
    const [selectedProvider, setSelectedProvider] = useState(() => localStorage.getItem("llm_provider") || 'gemini');

    // Fetch paths from backend on mount
    useEffect(() => {
        const fetchPaths = async () => {
            const token = localStorage.getItem('auth_token');
            if (!token) return;

            try {
                const res = await fetch('/api/paths', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setLearningPaths(data);
                    if (data.length > 0 && !currentPathId) {
                        setCurrentPathId(data[0].id);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch paths:", err);
            }
        };
        fetchPaths();
    }, []); // Only on mount. A real app might re-trigger on login.

    // Derived state for current path's milestones
    const currentPath = learningPaths.find(p => String(p.id) === String(currentPathId));
    const milestones = currentPath ? currentPath.milestones : [];

    const currentMilestoneId = milestones.find(m => !m.completed && !m.locked)?.id || (milestones.length > 0 ? milestones[milestones.length - 1].id : null);

    useEffect(() => {
        llmService.setProvider(selectedProvider);
    }, [selectedProvider]);

    const changeProvider = (provider) => {
        setSelectedProvider(provider);
        localStorage.setItem("llm_provider", provider);
        llmService.setProvider(provider);
    };

    const createNewPath = async (title, newMilestones, graphData) => {
        const token = localStorage.getItem('auth_token');
        if (!token) return;

        try {
            const res = await fetch('/api/paths', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ topic: title || "New Learning Path", milestones: newMilestones, graphData: graphData ? JSON.stringify(graphData) : null })
            });

            if (res.ok) {
                const newPath = await res.json();
                setLearningPaths(prev => [newPath, ...prev]);
                setCurrentPathId(newPath.id);
            }
        } catch (err) {
            console.error("Failed to create path:", err);
        }
    };

    const switchPath = (id) => {
        if (learningPaths.some(p => String(p.id) === String(id))) {
            setCurrentPathId(id);
        }
    };

    const updateMilestone = async (id, updatedData) => {
        if (!currentPathId) return;

        // Optimistic UI Update
        const updatedMilestones = milestones.map((m) =>
            (String(m.id) === String(id) ? { ...m, ...updatedData } : m)
        );
        setLearningPaths(prev => prev.map(path => {
            if (String(path.id) === String(currentPathId)) {
                return { ...path, milestones: updatedMilestones };
            }
            return path;
        }));

        // Backend sync
        const token = localStorage.getItem('auth_token');
        if (token) {
            await fetch(`/api/paths/milestone/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updatedData)
            }).catch(err => console.error("Failed to update milestone on server", err));
        }
    };

    const setMilestonesWrapper = (newMilestones) => {
        // In full stack, updating the entire path's milestones requires a bit more logic.
        // For simplicity, we just create a new path if new milestones are generated to replace the old.
        createNewPath("Adjusted Learning Path", newMilestones, null);
    };

    const getMilestoneById = (id) => {
        return milestones.find((m) => String(m.id) === String(id));
    };

    const completeMilestone = (id) => {
        updateMilestone(id, { completed: true, progress: 100 });
        
        // Find next milestone and visually unlock it locally
        const index = milestones.findIndex((m) => String(m.id) === String(id));
        if (index !== -1 && index < milestones.length - 1) {
            const nextId = milestones[index + 1].id;
            updateMilestone(nextId, { locked: false });
        }
    };

    const deletePath = async (id) => {
        const token = localStorage.getItem('auth_token');
        if (!token) return;

        try {
            const res = await fetch(`/api/paths/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const refreshedPaths = learningPaths.filter(p => String(p.id) !== String(id));
                setLearningPaths(refreshedPaths);
                if (String(currentPathId) === String(id)) {
                    setCurrentPathId(refreshedPaths.length > 0 ? refreshedPaths[0].id : null);
                }
            }
        } catch (err) {
            console.error("Failed to delete path:", err);
        }
    };

    const updateGraphNodeScore = async (conceptNodeId, isCorrect) => {
        console.log("updateGraphNodeScore called with:", conceptNodeId);
        if (!currentPathId) {
            console.log("No currentPathId");
            return;
        }
        const currentPath = learningPaths.find(p => String(p.id) === String(currentPathId));
        if (!currentPath || !currentPath.graphData) {
            console.log("No currentPath or graphData");
            return;
        }
        
        let graphDataObj;
        try {
            graphDataObj = typeof currentPath.graphData === 'string' ? JSON.parse(currentPath.graphData) : currentPath.graphData;
        } catch (e) { 
            console.error("Failed to parse graph data in context", e);
            return; 
        }
        
        const nodeIndex = graphDataObj.nodes.findIndex(n => String(n.id) === String(conceptNodeId) || String(n.data.label).toLowerCase() === String(conceptNodeId).toLowerCase());
        console.log("Found Node Index:", nodeIndex);
        
        if (nodeIndex !== -1) {
            let currentScore = graphDataObj.nodes[nodeIndex].data.score || 50;
            if (isCorrect) currentScore = Math.min(100, currentScore + 20);
            else currentScore = Math.max(0, currentScore - 15);
            
            console.log("Updating score for", graphDataObj.nodes[nodeIndex].data.label, "from", graphDataObj.nodes[nodeIndex].data.score, "to", currentScore);
            graphDataObj.nodes[nodeIndex].data.score = currentScore;
            graphDataObj.nodes[nodeIndex].data.status = 'unlocked'; // Ensure it's not locked anymore so it renders the score!
            
            // local state update
            setLearningPaths(prev => prev.map(path => {
                if (String(path.id) === String(currentPathId)) {
                    return { ...path, graphData: JSON.stringify(graphDataObj) };
                }
                return path;
            }));
            
            // remote update
            const token = localStorage.getItem('auth_token');
            if (token) {
                await fetch(`/api/paths/${currentPathId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ graphData: JSON.stringify(graphDataObj) })
                });
            }
        }
    };

    return (
        <LearningPathContext.Provider
            value={{
                milestones,
                learningPaths,
                currentPathId,
                createNewPath,
                switchPath,
                deletePath,
                setMilestones: setMilestonesWrapper,
                updateMilestone,
                currentMilestoneId,
                completeMilestone,
                getMilestoneById,
                selectedProvider,
                changeProvider,
                updateGraphNodeScore,
            }}
        >
            {children}
        </LearningPathContext.Provider>
    );
};

export const useLearningPath = () => {
    const context = useContext(LearningPathContext);
    if (!context) {
        throw new Error("useLearningPath must be used within a LearningPathProvider");
    }
    return context;
};
