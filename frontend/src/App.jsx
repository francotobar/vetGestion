import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import RutaProtegida from './components/RutaProtegida.jsx';
import PaginaEnConstruccion from './components/PaginaEnConstruccion.jsx';
import Login from './pages/publicas/Login.jsx';
import Registro from './pages/publicas/Registro.jsx';
import Mascotas from './pages/cliente/Mascotas.jsx';
import MascotaNueva from './pages/cliente/MascotaNueva.jsx';
import MascotaFicha from './pages/cliente/MascotaFicha.jsx';

// Tabla de rutas P0 (sección 8 del plan). Cada una muestra una página
// provisoria hasta que su tarea (FE-04 en adelante) la implemente.
const rutasCliente = [
  { path: '/turnos', titulo: 'Mis turnos' },
  { path: '/turnos/nuevo', titulo: 'Reservar turno' },
];

const rutasAdmin = [
  { path: '/admin/agenda', titulo: 'Agenda' },
  { path: '/admin/turnos/nuevo', titulo: 'Turno manual' },
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
        {rutasCliente.map(({ path, titulo }) => (
          <Route
            key={path}
            path={path}
            element={
              <RutaProtegida roles={['cliente']}>
                <PaginaEnConstruccion titulo={titulo} />
              </RutaProtegida>
            }
          />
        ))}

        {/* Admin */}
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
