import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import RutaProtegida from './components/RutaProtegida.jsx';
import PaginaEnConstruccion from './components/PaginaEnConstruccion.jsx';
import Login from './pages/publicas/Login.jsx';
import Registro from './pages/publicas/Registro.jsx';
import Mascotas from './pages/cliente/Mascotas.jsx';
import MascotaNueva from './pages/cliente/MascotaNueva.jsx';
import MascotaFicha from './pages/cliente/MascotaFicha.jsx';
import ReservarTurno from './pages/cliente/ReservarTurno.jsx';
import MisTurnos from './pages/cliente/MisTurnos.jsx';
import Agenda from './pages/admin/Agenda.jsx';
import TurnoManual from './pages/admin/TurnoManual.jsx';

// Las rutas P0 de admin restantes (sección 8 del plan) muestran una página
// provisoria hasta que su tarea (FE-08 en adelante) las implemente.
const rutasAdmin = [
  { path: '/admin/clientes', titulo: 'Clientes' },
  { path: '/admin/clientes/nuevo', titulo: 'Nuevo cliente' },
  { path: '/admin/clientes/:id', titulo: 'Ficha del cliente' },
  { path: '/admin/servicios', titulo: 'Servicios' },
  { path: '/admin/feriados', titulo: 'Feriados' },
];

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Públicas */}
        <Route path="/" element={<PaginaEnConstruccion titulo="Inicio" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />

        {/* Cliente */}
        <Route
          path="/mascotas"
          element={
            <RutaProtegida roles={['cliente']}>
              <Mascotas />
            </RutaProtegida>
          }
        />
        <Route
          path="/mascotas/nueva"
          element={
            <RutaProtegida roles={['cliente']}>
              <MascotaNueva />
            </RutaProtegida>
          }
        />
        <Route
          path="/mascotas/:id"
          element={
            <RutaProtegida roles={['cliente']}>
              <MascotaFicha />
            </RutaProtegida>
          }
        />
        <Route
          path="/turnos"
          element={
            <RutaProtegida roles={['cliente']}>
              <MisTurnos />
            </RutaProtegida>
          }
        />
        <Route
          path="/turnos/nuevo"
          element={
            <RutaProtegida roles={['cliente']}>
              <ReservarTurno />
            </RutaProtegida>
          }
        />

        {/* Admin */}
        <Route
          path="/admin/agenda"
          element={
            <RutaProtegida roles={['admin']}>
              <Agenda />
            </RutaProtegida>
          }
        />
        <Route
          path="/admin/turnos/nuevo"
          element={
            <RutaProtegida roles={['admin']}>
              <TurnoManual />
            </RutaProtegida>
          }
        />
        {rutasAdmin.map(({ path, titulo }) => (
          <Route
            key={path}
            path={path}
            element={
              <RutaProtegida roles={['admin']}>
                <PaginaEnConstruccion titulo={titulo} />
              </RutaProtegida>
            }
          />
        ))}

        <Route path="*" element={<PaginaEnConstruccion titulo="Página no encontrada" />} />
      </Route>
    </Routes>
  );
}
