import { Link } from 'react-router-dom';
import Navbar from '../components/Shared/Navbar';
import MilestoneList from '../components/LearningPath/MilestoneList';
import PathAdjuster from '../components/LearningPath/PathAdjuster';
import ConceptGapMap from '../components/LearningPath/ConceptGapMap';
import { useLearningPath } from '../context/LearningPathContext';

function Dashboard() {
    const { milestones, currentMilestoneId, learningPaths, currentPathId, switchPath, deletePath } = useLearningPath();
    const currentPath = learningPaths.find(p => String(p.id) === String(currentPathId));

    return (
        <div className="dashboard-page" style={{ minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-main)', paddingBottom: '60px' }}>
            <Navbar />
            <div className="main-content" style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
                
                {/* Header Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap', gap: '20px' }}>
                    <div>
                        <h1 style={{ fontSize: '2.5rem', margin: '0 0 10px 0', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Your Dashboard
                        </h1>
                        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '1.1rem' }}>Manage your learning paths and track your mastery progress.</p>
                    </div>
                    <Link to="/create-path" style={{ textDecoration: 'none' }}>
                        <button style={{ 
                            padding: '12px 24px', 
                            background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '12px', 
                            fontSize: '1rem', 
                            fontWeight: 'bold', 
                            cursor: 'pointer', 
                            boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <span>✨</span> Create New Path
                        </button>
                    </Link>
                </div>

                {/* Quick Stats Grid */}
                {milestones.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                        <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '10px' }}>Overall Progress</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '10px' }}>
                                {Math.round(milestones.reduce((acc, m) => acc + (m.progress || 0), 0) / milestones.length)}%
                            </div>
                            <div className="progress-bar" style={{ margin: 0, height: '6px' }}>
                                <div className="progress-fill" style={{ width: `${milestones.reduce((acc, m) => acc + (m.progress || 0), 0) / milestones.length}%` }}></div>
                            </div>
                        </div>
                        <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '10px' }}>Milestones Done</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                                {milestones.filter(m => m.completed).length} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>/ {milestones.length}</span>
                            </div>
                            <div style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--success)', fontWeight: '600' }}>
                                🏆 {milestones.filter(m => m.completed).length === milestones.length ? 'Curriculum Finished!' : 'Keep going!'}
                            </div>
                        </div>
                        <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '10px' }}>Learning Streak</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                                {learningPaths.length} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>Paths Active</span>
                            </div>
                            <div style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '600' }}>
                                🔥 Consistent Learner
                            </div>
                        </div>
                    </div>
                )}

                {/* Path Selector Card */}
                {learningPaths && learningPaths.length > 0 && (
                    <div className="path-selector" style={{ 
                        display: 'flex', 
                        gap: '20px', 
                        alignItems: 'center', 
                        marginBottom: '40px', 
                        padding: '25px', 
                        background: 'var(--glass-bg)', 
                        backdropFilter: 'blur(12px)',
                        borderRadius: '16px', 
                        border: '1px solid var(--glass-border)',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                        flexWrap: 'wrap'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1, minWidth: '300px' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(124, 58, 237, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: 'var(--primary)', flexShrink: 0 }}>
                                🧭
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Current Active Path</label>
                                <select
                                    value={currentPathId || ''}
                                    onChange={(e) => switchPath(e.target.value)}
                                    style={{ 
                                        width: '100%',
                                        padding: '12px 16px', 
                                        borderRadius: '10px', 
                                        border: '1px solid var(--border-color)', 
                                        background: 'var(--surface-color)',
                                        color: 'var(--text-main)',
                                        fontSize: '1.05rem',
                                        fontFamily: 'Inter',
                                        cursor: 'pointer',
                                        outline: 'none',
                                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                                    }}
                                >
                                    {learningPaths.map(path => (
                                        <option key={path.id} value={path.id}>
                                            {path.topic || path.title || "Untitled Path"} • Created {new Date(path.createdAt).toLocaleDateString()}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <button 
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if(window.confirm('Are you sure you want to delete this learning path? This action cannot be undone.')) {
                                    deletePath(currentPathId);
                                }
                            }}
                            style={{ 
                                padding: '14px 20px', 
                                background: 'rgba(239, 68, 68, 0.08)', 
                                color: '#ef4444', 
                                border: '1px solid rgba(239, 68, 68, 0.2)', 
                                borderRadius: '10px', 
                                cursor: 'pointer',
                                fontWeight: '600',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '0.95rem'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; e.currentTarget.style.color = '#ef4444'; }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            Delete Path
                        </button>
                    </div>
                )}

                <div style={{ marginBottom: '50px' }}>
                    <PathAdjuster />
                </div>

                {milestones.length > 0 ? (
                    <div style={{ display: 'grid', gap: '60px' }}>
                        {/* Concept Map Section */}
                        <section>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.4rem', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)' }}>
                                    🗺️
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--text-main)' }}>Concept Knowledge Map</h2>
                                    <p style={{ margin: '5px 0 0 0', color: 'var(--text-muted)', fontSize: '0.95rem' }}>Visual dependency graph of topics generated for your goal.</p>
                                </div>
                            </div>
                            <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
                                <ConceptGapMap graphData={currentPath?.graphData} />
                            </div>
                        </section>
                        
                        {/* Syllabus Section */}
                        <section>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.4rem', boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)' }}>
                                    📚
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--text-main)' }}>Linear Syllabus</h2>
                                    <p style={{ margin: '5px 0 0 0', color: 'var(--text-muted)', fontSize: '0.95rem' }}>Step-by-step milestones curated by the AI.</p>
                                </div>
                            </div>
                            <MilestoneList milestones={milestones} currentMilestone={currentMilestoneId} />
                        </section>
                    </div>
                ) : (
                    <div className="empty-state" style={{ textAlign: 'center', padding: '80px 20px', background: 'var(--glass-bg)', borderRadius: '24px', border: '2px dashed var(--border-color)' }}>
                        <div style={{ fontSize: '5rem', marginBottom: '20px', textShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>🚀</div>
                        <h2 style={{ margin: '0 0 15px 0', fontSize: '2rem', color: 'var(--text-main)' }}>Ready to start learning?</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '35px', fontSize: '1.1rem', maxWidth: '500px', margin: '0 auto 35px auto', lineHeight: '1.6' }}>
                            You haven't generated any learning paths yet. Tell the AI what you want to learn, and it will build a personalized curriculum for you.
                        </p>
                        <Link to="/create-path" style={{ textDecoration: 'none' }}>
                            <button style={{ padding: '16px 36px', background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))', color: 'white', border: 'none', borderRadius: '30px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 10px 25px rgba(124, 58, 237, 0.4)', transition: 'transform 0.2s', display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                                <span>✨</span> Create Your First Path
                            </button>
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Dashboard;
