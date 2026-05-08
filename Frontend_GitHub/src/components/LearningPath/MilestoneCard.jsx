import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';

function MilestoneCard({ milestone, index, isActive, isLocked }) {
    if (!milestone) return null;

    return (
        <div 
            className={`milestone-card ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
            style={{
                background: isActive ? 'var(--glass-bg)' : 'var(--surface-color)',
                border: isActive ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '25px',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                boxShadow: isActive ? '0 10px 25px rgba(124, 58, 237, 0.15)' : '0 4px 10px rgba(0,0,0,0.02)',
                opacity: isLocked ? 0.6 : 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '15px'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div 
                        className="milestone-number"
                        style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: isActive ? 'linear-gradient(135deg, var(--primary), var(--secondary))' : 'var(--bg-color)',
                            color: isActive ? 'white' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            fontSize: '1.2rem',
                            boxShadow: isActive ? '0 4px 10px rgba(124, 58, 237, 0.3)' : 'inset 0 2px 4px rgba(0,0,0,0.05)'
                        }}
                    >
                        {isLocked ? '🔒' : index + 1}
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.4rem', color: isActive ? 'var(--primary-hover)' : 'var(--text-main)' }}>
                        {milestone.title}
                    </h3>
                </div>
                
                <div style={{ display: 'flex', gap: '10px' }}>
                    {milestone.completed && (
                        <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            ✅ Completed
                        </span>
                    )}
                    {milestone.hasFinetuning && (
                        <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            ✨ Personalized
                        </span>
                    )}
                </div>
            </div>

            <ul style={{ margin: '10px 0 0 55px', padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {milestone.topics && milestone.topics.map((topic, i) => (
                    <li key={i} style={{ background: 'var(--bg-color)', color: 'var(--text-muted)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', border: '1px solid var(--border-color)' }}>
                        {topic}
                    </li>
                ))}
            </ul>

            {!isLocked && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <Link to={`/milestone/${milestone.id}`} style={{ textDecoration: 'none' }}>
                        <button style={{ 
                            padding: '10px 24px', 
                            background: milestone.completed ? 'var(--surface-color)' : 'linear-gradient(135deg, var(--primary), var(--primary-hover))', 
                            color: milestone.completed ? 'var(--primary)' : 'white', 
                            border: milestone.completed ? '1px solid var(--primary-light)' : 'none', 
                            borderRadius: '10px', 
                            fontWeight: 'bold', 
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: milestone.completed ? 'none' : '0 4px 12px rgba(124, 58, 237, 0.25)'
                        }}>
                            {milestone.completed ? 'Review Content' : 'Start Learning →'}
                        </button>
                    </Link>
                </div>
            )}
        </div>
    );
}

MilestoneCard.propTypes = {
    milestone: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        title: PropTypes.string.isRequired,
        topics: PropTypes.arrayOf(PropTypes.string),
        progress: PropTypes.number,
        hasFinetuning: PropTypes.bool,
        completed: PropTypes.bool
    }).isRequired,
    index: PropTypes.number.isRequired,
    isActive: PropTypes.bool,
    isLocked: PropTypes.bool,
};

export default MilestoneCard;
