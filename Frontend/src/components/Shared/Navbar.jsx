import { Link, useNavigate } from 'react-router-dom';
import { useLearningPath } from '../../context/LearningPathContext';

function Navbar() {
    const { selectedProvider, changeProvider } = useLearningPath();
    const navigate = useNavigate();
    const token = localStorage.getItem('auth_token');

    const handleLogout = () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    return (
        <nav className="navbar" style={{ padding: '1rem 2rem', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <div className="logo">
                <Link to="/" style={{ fontSize: '1.8rem', fontWeight: '800', fontFamily: 'Outfit', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textDecoration: 'none' }}>EduAgent</Link>
            </div>
            <div className="nav-controls" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <ul className="nav-links" style={{ listStyle: 'none', display: 'flex', gap: '20px', margin: 0, padding: 0, alignItems: 'center' }}>
                    <li><Link to="/" style={{ textDecoration: 'none', color: 'var(--text-main)', fontWeight: '500' }}>Home</Link></li>
                    {token && <li><Link to="/dashboard" style={{ textDecoration: 'none', color: 'var(--text-main)', fontWeight: '500' }}>Dashboard</Link></li>}
                    
                    {!token ? (
                        <>
                            <li><Link to="/login" style={{ marginLeft: '10px', padding: '8px 16px', background: 'var(--surface-color)', color: 'var(--primary)', border: '1px solid var(--primary-light)', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', transition: 'all 0.2s' }}>Log In</Link></li>
                            <li><Link to="/signup" style={{ padding: '8px 16px', background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))', color: 'white', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', boxShadow: '0 2px 4px rgba(79,70,229,0.3)', transition: 'all 0.2s' }}>Sign Up</Link></li>
                        </>
                    ) : (
                        <li><button onClick={handleLogout} style={{ padding: '8px 16px', background: 'var(--error-light)', color: 'var(--error)', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}>Log Out</button></li>
                    )}
                </ul>
                <div className="provider-selector">
                    <select
                        value={selectedProvider}
                        onChange={(e) => changeProvider(e.target.value)}
                        className="provider-select"
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface-color)', color: 'var(--text-main)', fontFamily: 'Inter', outline: 'none', cursor: 'pointer' }}
                    >
                        <option value="gemini">Google Gemini</option>
                        <option value="openai">OpenAI (GPT-4o)</option>
                        <option value="deepseek">Deepseek V3</option>
                    </select>
                </div>
            </div>
        </nav>
    );
}

export default Navbar;
