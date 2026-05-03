import { Link } from 'react-router-dom';
import Navbar from '../components/Shared/Navbar';

function Home() {
    const token = localStorage.getItem('auth_token');

    return (
        <div className="home-page" style={{ 
            minHeight: '100vh', 
            background: 'var(--bg-color)',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <Navbar />
            
            {/* Hero Section */}
            <main style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                padding: '40px 20px',
                textAlign: 'center'
            }}>
                <div style={{
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid var(--glass-border)',
                    padding: '60px 40px',
                    borderRadius: '24px',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)',
                    maxWidth: '800px',
                    width: '100%'
                }}>
                    <h1 style={{ 
                        fontSize: '3.5rem', 
                        marginBottom: '20px',
                        background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        lineHeight: '1.2'
                    }}>
                        Your AI-Powered Personalized Learning Journey
                    </h1>
                    
                    <p style={{ 
                        fontSize: '1.25rem', 
                        color: 'var(--text-muted)', 
                        marginBottom: '40px',
                        lineHeight: '1.6'
                    }}>
                        EduAgent dynamically generates interactive, context-aware courses tailored specifically to your goals. Upload documents or just type what you want to learn, and let AI build your perfect syllabus.
                    </p>
                    
                    <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                        {token ? (
                            <Link to="/dashboard" style={{ textDecoration: 'none' }}>
                                <button style={{ 
                                    padding: '16px 32px', 
                                    fontSize: '1.1rem', 
                                    borderRadius: '12px',
                                    background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                                    boxShadow: '0 10px 20px -5px rgba(79, 70, 229, 0.4)'
                                }}>
                                    Go to Dashboard →
                                </button>
                            </Link>
                        ) : (
                            <>
                                <Link to="/signup" style={{ textDecoration: 'none' }}>
                                    <button style={{ 
                                        padding: '16px 32px', 
                                        fontSize: '1.1rem', 
                                        borderRadius: '12px',
                                        background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                                        boxShadow: '0 10px 20px -5px rgba(79, 70, 229, 0.4)'
                                    }}>
                                        Start Learning for Free
                                    </button>
                                </Link>
                                <Link to="/login" style={{ textDecoration: 'none' }}>
                                    <button style={{ 
                                        padding: '16px 32px', 
                                        fontSize: '1.1rem', 
                                        borderRadius: '12px',
                                        background: 'var(--surface-color)',
                                        color: 'var(--primary)',
                                        border: '2px solid var(--primary-light)',
                                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                                    }}>
                                        Log In
                                    </button>
                                </Link>
                            </>
                        )}
                    </div>
                </div>

                {/* Features Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '30px',
                    width: '100%',
                    maxWidth: '1200px',
                    marginTop: '60px'
                }}>
                    <div style={{ padding: '30px', background: 'var(--glass-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '15px', color: 'var(--primary)' }}>🧠 Context-Aware AI</h3>
                        <p style={{ color: 'var(--text-muted)' }}>Upload PDFs, Docs, or Data. EduAgent reads your files and builds a curriculum precisely around your material.</p>
                    </div>
                    <div style={{ padding: '30px', background: 'var(--glass-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '15px', color: 'var(--secondary)' }}>📊 Dynamic Visuals</h3>
                        <p style={{ color: 'var(--text-muted)' }}>Stuck on a concept? Highlight text and instantly generate interactive architectural diagrams and flowcharts.</p>
                    </div>
                    <div style={{ padding: '30px', background: 'var(--glass-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '15px', color: 'var(--success)' }}>💬 Specialized Memory</h3>
                        <p style={{ color: 'var(--text-muted)' }}>A dedicated AI tutor panel that remembers exactly what lesson you're on, ready to answer questions instantly.</p>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default Home;
