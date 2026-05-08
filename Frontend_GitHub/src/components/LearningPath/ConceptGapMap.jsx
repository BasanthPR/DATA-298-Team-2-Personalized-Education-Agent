import React, { useEffect, useState } from 'react';
import ReactFlow, { Background, Controls, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import ConceptNode from './ConceptNode';
import { llmService } from '../../services/llmService';

const nodeTypes = {
  concept: ConceptNode,
};

const initialNodes = [
  { id: '1', type: 'concept', position: { x: 50, y: 150 }, data: { label: 'Linear Algebra', score: 92 } },
  { id: '2', type: 'concept', position: { x: 50, y: 300 }, data: { label: 'Loss Functions', score: 91 } },
  { id: '3', type: 'concept', position: { x: 250, y: 50 }, data: { label: 'Basic Derivatives', score: 85 } },
  { id: '4', type: 'concept', position: { x: 400, y: 0 }, data: { label: 'Product Rule', score: 89 } },
  { id: '5', type: 'concept', position: { x: 300, y: 350 }, data: { label: 'Partial Deriv.', score: 52 } },
  { id: '6', type: 'concept', position: { x: 450, y: 150 }, data: { label: 'Chain Rule', score: 28 } },
  { id: '7', type: 'concept', position: { x: 550, y: 380 }, data: { label: 'Matrix Calculus', score: 35 } },
  { id: '8', type: 'concept', position: { x: 600, y: 50 }, data: { label: 'Gradient Descent', score: 78 } },
  { id: '9', type: 'concept', position: { x: 700, y: 200 }, data: { label: 'Backpropagation', score: 48 } },
  { id: '10', type: 'concept', position: { x: 750, y: 450 }, data: { label: 'Regularization', score: 60 } },
  { id: '11', type: 'concept', position: { x: 850, y: 100 }, data: { label: 'NN Architecture', score: 65 } },
  { id: '12', type: 'concept', position: { x: 950, y: 20 }, data: { label: 'CNNs', status: 'locked' } },
  { id: '13', type: 'concept', position: { x: 1000, y: 150 }, data: { label: 'RNNs', status: 'locked' } },
  { id: '14', type: 'concept', position: { x: 1000, y: 300 }, data: { label: 'Transformers', status: 'locked' } },
  { id: '15', type: 'concept', position: { x: 900, y: 380 }, data: { label: 'Attention', status: 'locked' } },
];

const initialEdges = [
  { id: 'e1-3', source: '1', target: '3', animated: true },
  { id: 'e3-4', source: '3', target: '4', animated: true },
  { id: 'e3-5', source: '3', target: '5', animated: true },
  { id: 'e4-6', source: '4', target: '6', animated: true },
  { id: 'e5-6', source: '5', target: '6', animated: true },
  { id: 'e2-5', source: '2', target: '5', animated: true },
  { id: 'e1-7', source: '1', target: '7', animated: true },
  { id: 'e5-7', source: '5', target: '7', animated: true },
  { id: 'e6-9', source: '6', target: '9', animated: true },
  { id: 'e7-9', source: '7', target: '9', animated: true },
  { id: 'e8-9', source: '8', target: '9', animated: true },
  { id: 'e9-11', source: '9', target: '11', animated: true },
  { id: 'e2-10', source: '2', target: '10', animated: true },
  { id: 'e10-11', source: '10', target: '11', animated: true },
  { id: 'e11-12', source: '11', target: '12', style: { strokeDasharray: '5 5', stroke: '#94a3b8' } },
  { id: 'e11-13', source: '11', target: '13', style: { strokeDasharray: '5 5', stroke: '#94a3b8' } },
  { id: 'e11-14', source: '11', target: '14', style: { strokeDasharray: '5 5', stroke: '#94a3b8' } },
  { id: 'e14-15', source: '14', target: '15', style: { strokeDasharray: '5 5', stroke: '#94a3b8' } },
];

export default function ConceptGapMap({ graphData }) {
    let parsedData = { nodes: initialNodes, edges: initialEdges };
    if (graphData) {
        try {
            const data = typeof graphData === 'string' ? JSON.parse(graphData) : graphData;
            if (data.nodes && data.nodes.length > 0) parsedData.nodes = data.nodes;
            if (data.edges && data.edges.length > 0) parsedData.edges = data.edges;
        } catch (e) {
            console.error("Failed to parse graphData", e);
        }
    }

    const [nodes, setNodes, onNodesChange] = useNodesState(parsedData.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(parsedData.edges);

    useEffect(() => {
        if (graphData) {
            try {
                const data = typeof graphData === 'string' ? JSON.parse(graphData) : graphData;
                if (data.nodes && data.nodes.length > 0) setNodes(data.nodes);
                if (data.edges && data.edges.length > 0) setEdges(data.edges);
            } catch (e) {}
        }
    }, [graphData, setNodes, setEdges]);

    const [rca, setRca] = useState(null);
    const [loadingRca, setLoadingRca] = useState(false);

    const handleAnalyze = async () => {
        setLoadingRca(true);
        try {
            const result = await llmService.generateRCA({ nodes, edges });
            setRca(result);
        } catch(e) {
            console.error("RCA Error:", e);
        } finally {
            setLoadingRca(false);
        }
    };

    return (
        <div className="concept-gap-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '15px', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px rgba(16,185,129,0.4)' }}></div> Mastered</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 8px rgba(245,158,11,0.4)' }}></div> Learning</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px rgba(239,68,68,0.4)' }}></div> Gap</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 12, height: 12, borderRadius: '50%', background: '#e2e8f0' }}></div> Locked</div>
                </div>
            </div>

            <div style={{ 
                height: '500px', 
                background: 'white', 
                borderRadius: '16px', 
                border: '1px solid var(--border-color)', 
                boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                overflow: 'hidden'
            }}>
                <ReactFlow 
                    nodes={nodes} 
                    edges={edges} 
                    onNodesChange={onNodesChange} 
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    fitView
                    attributionPosition="bottom-right"
                >
                    <Background color="#f1f5f9" gap={16} />
                    <Controls />
                </ReactFlow>
            </div>

            <div style={{ 
                padding: '25px', 
                background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.05), rgba(59, 130, 246, 0.05))', 
                borderRadius: '16px', 
                border: '1px solid rgba(124, 58, 237, 0.2)',
                display: 'flex',
                gap: '20px',
                alignItems: 'flex-start',
                marginTop: '10px'
            }}>
                <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '14px', 
                    background: 'linear-gradient(135deg, var(--primary), var(--secondary))', 
                    color: 'white', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    fontSize: '1.5rem',
                    flexShrink: 0,
                    boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)'
                }}>
                    💡
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
                        <div>
                            <h3 style={{ fontSize: '1.3rem', margin: '0 0 5px 0', color: 'var(--text-main)' }}>AI Root-Cause Analysis</h3>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Identify exactly why you are stuck on certain concepts.</p>
                        </div>
                        <button 
                            onClick={handleAnalyze} 
                            disabled={loadingRca} 
                            style={{ 
                                padding: '10px 20px', 
                                fontSize: '0.95rem', 
                                borderRadius: '10px', 
                                background: loadingRca ? 'var(--surface-color)' : 'white',
                                color: loadingRca ? 'var(--text-muted)' : 'var(--primary)',
                                border: '1px solid var(--primary-light)',
                                fontWeight: 'bold',
                                cursor: loadingRca ? 'wait' : 'pointer',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.2s'
                            }}
                        >
                            {loadingRca ? (
                                <>
                                    <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }}></div>
                                    Analyzing Map...
                                </>
                            ) : (
                                <>
                                    <span>✨</span> Generate Analysis
                                </>
                            )}
                        </button>
                    </div>
                    
                    <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', minHeight: '80px' }}>
                        {rca ? (
                            <>
                                <div style={{ color: 'var(--text-main)', marginBottom: '15px', fontWeight: '500', lineHeight: '1.6' }} dangerouslySetInnerHTML={{ __html: rca.insight }}></div>
                                <div style={{ color: 'var(--text-main)', background: 'rgba(59, 130, 246, 0.05)', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #3b82f6', lineHeight: '1.6' }}>
                                    <strong style={{ color: '#3b82f6', display: 'block', marginBottom: '5px' }}>Recommended Path:</strong> 
                                    <span dangerouslySetInnerHTML={{ __html: rca.recommendation }}></span>
                                </div>
                            </>
                        ) : (
                            <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontStyle: 'italic' }}>
                                Click "Generate Analysis" to have the AI analyze your current Concept Map and find the hidden root causes of your knowledge gaps!
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
