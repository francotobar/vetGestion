import axios from 'axios';

// Cliente HTTP del backend. La sesión viaja en cookie httpOnly (JWT), por eso
// withCredentials: true; el backend acepta por CORS solo el origen del frontend.
// Override opcional con VITE_API_URL (por ejemplo en tests con otro puerto).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  withCredentials: true,
});

// El backend responde los errores como { codigo, mensaje } (sección 0.7 del
// plan). Esta función extrae el mensaje para mostrarlo (409, 423, 401, 400…)
// y si la respuesta no llegó (servidor caído) usa uno genérico.
export function mensajeDeError(error, mensajePorDefecto) {
  return error?.response?.data?.mensaje || mensajePorDefecto;
}

export default api;
