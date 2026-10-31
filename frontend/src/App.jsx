import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import RutaProtegida from './components/RutaProtegida.jsx';
import PaginaEnConstruccion from './components/PaginaEnConstruccion.jsx';
import Login from './pages/publicas/Login.jsx';
import Registro from './pages/publicas/Registro.jsx';
import Recuperar from './pages/publicas/Recuperar.jsx';
import Restablecer from './pages/publicas/Restablecer.jsx';
import Mascotas from './pages/cliente/Mascotas.jsx';
import MascotaNueva from './pages/cliente/MascotaNueva.jsx';
import MascotaFicha from './pages/cliente/MascotaFicha.jsx';
import ReservarTurno from './pages/cliente/ReservarTurno.jsx';
import MisTurnos from './pages/cliente/MisTurnos.jsx';
import Agenda from './pages/admin/Agenda.jsx';
import TurnoManual from './pages/admin/TurnoManual.jsx';
import Clientes from './pages/admin/Clientes.jsx';
import ClienteAlta from './pages/admin/ClienteAlta.jsx';
import ClienteFicha from './pages/admin/ClienteFicha.jsx';
import Servicios from './pages/admin/Servicios.jsx';
import Feriados from './pages/admin/Feriados.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Públicas */}
        <Route path="/" element={<PaginaEnConstruccion titulo="Inicio" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/recuperar" element={<Recuperar />} />
        <Route path="/restablecer" element={<Restablecer />} />

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
        <Route
          path="/admin/clientes"
          element={
            <RutaProtegida roles={['admin']}>
              <Clientes />
            </RutaProtegida>
          }
        />
        <Route
          path="/admin/clientes/nuevo"
          element={
            <RutaProtegida roles={['admin']}>
              <ClienteAlta />
            </RutaProtegida>
          }
        />
        <Route
          path="/admin/clientes/:id"
          element={
            <RutaProtegida roles={['admin']}>
              <ClienteFicha />
            </RutaProtegida>
          }
        />
        <Route
          path="/admin/servicios"
          element={
            <RutaProtegida roles={['admin']}>
              <Servicios />
            </RutaProtegida>
          }
        />
        <Route
          path="/admin/feriados"
          element={
            <RutaProtegida roles={['admin']}>
              <Feriados />
            </RutaProtegida>
          }
        />

        <Route path="*" element={<PaginaEnConstruccion titulo="Página no encontrada" />} />
      </Route>
    </Routes>
  );
}
