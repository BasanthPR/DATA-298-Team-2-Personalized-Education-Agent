import React, { useEffect, useRef, useState } from 'react';

let mermaidPromise = null;

export default function MermaidChart({ chartCode }) {
    const containerRef = useRef(null);
    const [error, setError] = useState('');
    const [zoom, setZoom] = useState(1);

    useEffect(() => {
        if (!chartCode) return;

        const renderChart = async () => {
            setError('');
            const id = 'mermaid-' + Math.random().toString(36).substring(7);
            try {
                if (!window.mermaid) {
                    if (!mermaidPromise) {
                        mermaidPromise = new Promise((resolve, reject) => {
                            const script = document.createElement('script');
                            script.src = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
                            script.onload = () => resolve(window.mermaid);
                            script.onerror = reject;
                            document.body.appendChild(script);
                        });
                    }
                    await mermaidPromise;
                }
                
                const mermaid = window.mermaid;
                if(mermaid) mermaid.initialize({ startOnLoad: false, theme: 'default', suppressErrorRendering: true });
                
                const { svg } = await mermaid.render(id, chartCode);
                if (containerRef.current) {
                    containerRef.current.innerHTML = svg;
                }
            } catch (err) {
                console.error("Mermaid error:", err);
                setError(err.message || 'Syntax error in Mermaid chart.');
                
                // Mermaid v10 leaves the error SVG bomb attached to the document body when it throws
                try {
                    const errorSvg = document.getElementById('d' + id);
                    if (errorSvg) {
                        errorSvg.remove();
                    }
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        };

        renderChart();
    }, [chartCode]);

    return (
        <div style={{ position: 'relative', border: '1px solid #eee', borderRadius: '8px', background: '#f8f9fa', marginTop: '10px' }}>
            <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10, display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.9)', padding: '4px', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <button onClick={() => setZoom(z => z + 0.25)} style={{ color: '#333', padding: '4px 10px', border: '1px solid #ddd', borderRadius: '4px', background: 'white', cursor: 'pointer', fontWeight: 'bold' }} title="Zoom In">+</button>
                <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} style={{ color: '#333', padding: '4px 10px', border: '1px solid #ddd', borderRadius: '4px', background: 'white', cursor: 'pointer', fontWeight: 'bold' }} title="Zoom Out">-</button>
                <button onClick={() => setZoom(1)} style={{ color: '#333', padding: '4px 8px', border: '1px solid #ddd', borderRadius: '4px', background: 'white', cursor: 'pointer', fontSize: '12px' }} title="Reset Zoom">Reset</button>
            </div>
            <div style={{ width: '100%', maxHeight: '650px', overflow: 'auto', padding: '30px' }}>
                {error ? (
                     <p style={{color:'red'}}>Error rendering diagram: {error}</p>
                ) : (
                     <div style={{
                         transform: `scale(${zoom})`,
                         transformOrigin: 'top left',
                         transition: 'transform 0.2s ease-in-out',
                         width: 'max-content',
                         minWidth: '100%'
                     }}>
                         <div ref={containerRef} style={{ display: 'flex', justifyContent: 'center' }} />
                     </div>
                )}
            </div>
        </div>
    );
}
