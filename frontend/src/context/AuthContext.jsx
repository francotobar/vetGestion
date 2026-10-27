import { createContext, useContext, useEffect, useState } from 'react';
import { cerrarSesion, iniciarSesion, usuarioActual } from '../api/auth.js';

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
    usuarioActual()
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

  // Devuelve el usuario logueado para que la pantalla pueda redirigir
  // según el rol (admin → /admin/agenda, cliente → /turnos; FE-02).
  async function login(datos) {
    await iniciarSesion(datos);
    const { data } = await usuarioActual();
    setUsuario(data);
    return data;
  }

  async function logout() {
    try {
      await cerrarSesion();
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
