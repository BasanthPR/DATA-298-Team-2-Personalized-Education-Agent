import React from 'react';
import { Handle, Position } from 'reactflow';

export default function ConceptNode({ data }) {
    let bgColor = '#e2e8f0'; // default grey
    let textColor = '#64748b';
    
    if (data.status === 'locked') {
        bgColor = '#e2e8f0';
        textColor = '#94a3b8';
    } else if (data.score >= 80) {
        bgColor = '#10b981'; // green
        textColor = '#fff';
    } else if (data.score >= 40) {
        bgColor = '#f59e0b'; // orange
        textColor = '#fff';
    } else {
        bgColor = '#ef4444'; // red
        textColor = '#fff';
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '120px' }}>
            <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
            <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: bgColor,
                color: textColor,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontWeight: 'bold',
                fontSize: '14px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                border: '3px solid white',
                zIndex: 10
            }}>
                {data.status === 'locked' ? '-' : `${data.score}%`}
            </div>
            <div style={{
                marginTop: '8px',
                fontSize: '12px',
                fontWeight: '600',
                textAlign: 'center',
                color: 'var(--text-main)'
            }}>
                {data.label}
            </div>
            <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
            <Handle type="source" position={Position.Right} id="r" style={{ opacity: 0 }} />
            <Handle type="target" position={Position.Left} id="l" style={{ opacity: 0 }} />
        </div>
    );
}
