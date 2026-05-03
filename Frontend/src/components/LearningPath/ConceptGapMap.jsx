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
        <div className="concept-gap-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.5rem' }}>🎯</span> Concept Gap Map
                </h2>
                <div style={{ display: 'flex', gap: '15px', fontSize: '12px', fontWeight: 'bold' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }}></div> Mastered</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }}></div> Learning</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }}></div> Gap</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#e2e8f0' }}></div> Locked</div>
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
                padding: '24px', 
                background: 'var(--glass-bg)', 
                backdropFilter: 'blur(12px)', 
                borderRadius: '16px', 
                border: '1px solid var(--glass-border)',
                display: 'flex',
                gap: '20px',
                alignItems: 'flex-start'
            }}>
                <div style={{ 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: '50%', 
                    background: 'var(--primary-light)', 
                    color: 'var(--primary)', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    fontSize: '20px',
                    flexShrink: 0
                }}>
                    💡
                </div>
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '20px' }}>
                        <h3 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-main)' }}>AI Root-Cause Analysis</h3>
                        <button onClick={handleAnalyze} disabled={loadingRca} style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '6px', cursor: loadingRca ? 'wait' : 'pointer' }}>
                            {loadingRca ? 'Analyzing Map...' : 'Generate Analysis'}
                        </button>
                    </div>
                    
                    {rca ? (
                        <>
                            <p style={{ color: 'var(--text-main)', marginBottom: '12px', fontWeight: '500' }} dangerouslySetInnerHTML={{ __html: rca.insight }}></p>
                            <p style={{ color: 'var(--text-muted)' }}>
                                <strong style={{ color: 'var(--primary)' }}>Recommended path:</strong> <span dangerouslySetInnerHTML={{ __html: rca.recommendation }}></span>
                            </p>
                        </>
                    ) : (
                        <p style={{ color: 'var(--text-muted)' }}>
                            Click "Generate Analysis" to have the AI analyze your current Concept Map and find the hidden root causes of your knowledge gaps!
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
