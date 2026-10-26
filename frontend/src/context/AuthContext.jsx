import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/cliente.js';

const AuthContext = createContext(null);

// Estado de sesión de la aplicación: usuario actual, login y logout.
export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Al iniciar: intento recuperar la sesión vigente (cookie JWT).
  // Si /auth/me falla (sin sesión, o el endpoint todavía no existe),
  // queda como "sin sesión" sin romper la app.
  useEffect(() => {
    let activo = true;
    api
      .get('/auth/me')
      .then(({ data }) => {
        if (activo) setUsuario(data);
      })
      .catch(() => {
        if (activo) setUsuario(null);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  async function login(datos) {
    await api.post('/auth/login', datos);
    const { data } = await api.get('/auth/me');
    setUsuario(data);
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      setUsuario(null);
    }
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
