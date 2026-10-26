import { Outlet } from 'react-router-dom';
import NavBar from './NavBar.jsx';

// Estructura común de todas las pantallas: barra, contenido y pie.
export default function Layout() {
  return (
    <div className="layout">
      <NavBar />
      <main className="contenido">
        <Outlet />
      </main>
      <footer className="pie">
        vetGestión · Sistema de turnos · Datos protegidos por la Ley 25.326
      </footer>
    </div>
  );
}
