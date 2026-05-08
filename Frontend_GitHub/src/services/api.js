import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const learningPathAPI = {
    generate: (query) => api.post('/learning-path', { query }),
    get: (pathId) => api.get(`/learning-path/${pathId}`),
};

export const milestoneAPI = {
    get: (id) => api.get(`/milestone/${id}`),
    complete: (id) => api.put(`/milestone/${id}/complete`),
};

export const quizAPI = {
    getInitial: (milestoneId) => api.get(`/quiz/${milestoneId}/initial`),
    getFollowUp: (milestoneId) => api.get(`/quiz/${milestoneId}/followup`),
    submit: (questionId, answer) => api.post('/quiz/submit', { questionId, answer }),
};

export const doubtAPI = {
    ask: (question, context) => api.post('/doubt/ask', { question, context }),
};

export default api;
