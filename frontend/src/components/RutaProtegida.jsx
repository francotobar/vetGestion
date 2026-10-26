import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Protege rutas según rol. Mientras carga la sesión no redirige;
// sin sesión va a /login; con un rol no permitido, a la home de su rol.
export default function RutaProtegida({ roles, children }) {
  const { usuario, cargando } = useAuth();

  if (cargando) return <p className="aviso">Cargando sesión…</p>;
  if (!usuario) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(usuario.rol)) {
    return <Navigate to={usuario.rol === 'admin' ? '/admin/agenda' : '/turnos'} replace />;
  }
  return children;
}
