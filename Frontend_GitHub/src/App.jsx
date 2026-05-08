import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import MilestoneDetail from './pages/MilestoneDetail';
import QuizPage from './pages/QuizPage';
import CreatePath from './pages/CreatePath';
import './styles/global.css';

import { LearningPathProvider } from './context/LearningPathContext';

import ProtectedRoute from './components/Shared/ProtectedRoute';

function App() {
  return (
    <LearningPathProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/dashboard" element={
              <ProtectedRoute><Dashboard /></ProtectedRoute>
            } />
            <Route path="/create-path" element={
              <ProtectedRoute><CreatePath /></ProtectedRoute>
            } />
            <Route path="/milestone/:id" element={
              <ProtectedRoute><MilestoneDetail /></ProtectedRoute>
            } />
            <Route path="/quiz/:milestoneId/:type" element={
              <ProtectedRoute><QuizPage /></ProtectedRoute>
            } />
          </Routes>
        </div>
      </Router>
    </LearningPathProvider>
  );
}

export default App;
