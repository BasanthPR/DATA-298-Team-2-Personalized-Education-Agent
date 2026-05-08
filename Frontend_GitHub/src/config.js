// In dev: Vite proxy handles /api/* → localhost:4000, so base is empty.
// In production on Render: VITE_BACKEND_URL = https://piab-backend.onrender.com
export const API_BASE = import.meta.env.VITE_BACKEND_URL || '';
