import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Barra de navegación con links según el rol de la sesión activa.
export default function NavBar() {
  const { usuario, cargando, logout } = useAuth();

  return (
    <header className="navbar">
      <NavLink to="/" className="navbar__marca">
        vetGestión
      </NavLink>
      <nav className="navbar__links">
        {!cargando && !usuario && (
          <>
            <NavLink to="/login">Iniciar sesión</NavLink>
            <NavLink to="/registro">Registrarse</NavLink>
          </>
        )}
        {usuario?.rol === 'cliente' && (
          <>
            <NavLink to="/turnos">Mis turnos</NavLink>
            <NavLink to="/mascotas">Mis mascotas</NavLink>
          </>
        )}
        {usuario?.rol === 'admin' && (
          <>
            <NavLink to="/admin/agenda">Agenda</NavLink>
            <NavLink to="/admin/clientes">Clientes</NavLink>
            <NavLink to="/admin/servicios">Servicios</NavLink>
            <NavLink to="/admin/feriados">Feriados</NavLink>
          </>
        )}
        {usuario && (
          <button type="button" className="navbar__salir" onClick={logout}>
            Cerrar sesión
          </button>
        )}
      </nav>
    </header>
  );
}
