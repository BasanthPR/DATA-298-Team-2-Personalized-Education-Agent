import MilestoneCard from './MilestoneCard';
import PropTypes from 'prop-types';

function MilestoneList({ milestones, currentMilestone }) {
    if (!milestones || milestones.length === 0) return null;

    const currentIndex = milestones.findIndex(m => String(m.id) === String(currentMilestone));

    return (
        <div className="milestone-list">
            <div className="milestones-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {milestones.map((milestone, index) => (
                    <MilestoneCard
                        key={milestone.id}
                        milestone={milestone}
                        index={index}
                        isActive={String(milestone.id) === String(currentMilestone)}
                        isLocked={index > 0 && !milestones[index - 1].completed}
                    />
                ))}
            </div>
        </div>
    );
}

MilestoneList.propTypes = {
    milestones: PropTypes.arrayOf(PropTypes.object).isRequired,
    currentMilestone: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default MilestoneList;
