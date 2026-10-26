import axios from 'axios';

// Cliente HTTP del backend. La sesión viaja en cookie httpOnly (JWT), por eso
// withCredentials: true; el backend acepta por CORS solo el origen del frontend.
// Override opcional con VITE_API_URL (por ejemplo en tests con otro puerto).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  withCredentials: true,
});

export default api;
