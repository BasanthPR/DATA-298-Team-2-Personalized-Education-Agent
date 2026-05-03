import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
        // Redirect to login if no token is found
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default ProtectedRoute;
