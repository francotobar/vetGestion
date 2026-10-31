import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { mensajeDeError } from '../../api/cliente.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Campo from '../../components/Campo.jsx';

// Pantalla pública de acceso (RF02): documento + contraseña.
// Redirige según el rol: admin → /admin/agenda, cliente → /turnos (FE-02).
export default function Login() {
  const { usuario, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Aviso de éxito que deja la pantalla de Registro tras crear la cuenta.
  const avisoRegistro = location.state?.mensaje;

  const [documento, setDocumento] = useState('');
  const [password, setPassword] = useState('');
  const [errores, setErrores] = useState({});
  const [errorApi, setErrorApi] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Si ya hay sesión vigente, no tiene sentido mostrar el formulario.
  if (usuario) return <Navigate to={usuario.rol === 'admin' ? '/admin/agenda' : '/turnos'} replace />;

  function validar() {
    const nuevosErrores = {};
    if (!documento.trim()) nuevosErrores.documento = 'El documento es obligatorio.';
    if (!password) nuevosErrores.password = 'La contraseña es obligatoria.';
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function manejarSubmit(evento) {
    evento.preventDefault();
    setErrorApi('');
    if (!validar()) return;

    setEnviando(true);
    try {
      const u = await login({ documento: documento.trim(), password });
      navigate(u?.rol === 'admin' ? '/admin/agenda' : '/turnos', { replace: true });
    } catch (error) {
      const status = error.response?.status;
      if (status === 423) {
        // Cuenta bloqueada (5 intentos fallidos). El backend informa si la
        // cuenta tiene email (puede desbloquearla sola) o no (solo el admin).
        setErrorApi(mensajeDeError(error, 'Tu cuenta está bloqueada. Contactá a la veterinaria.'));
      } else if (status === 401) {
        setErrorApi(mensajeDeError(error, 'Documento o contraseña incorrectos.'));
      } else if (!error.response) {
        setErrorApi('No se pudo conectar con el servidor. Intentá nuevamente.');
      } else {
        setErrorApi(mensajeDeError(error, 'No se pudo iniciar sesión. Intentá nuevamente.'));
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="pagina formulario">
      <h1>Iniciar sesión</h1>

      {avisoRegistro && (
        <p className="aviso aviso--ok" role="status">
          {avisoRegistro}
        </p>
      )}

      {errorApi && (
        <p className="error error--caja" role="alert">
          {errorApi}
        </p>
      )}

      <form onSubmit={manejarSubmit} noValidate>
        <Campo
          id="documento"
          etiqueta="Documento"
          valor={documento}
          onChange={setDocumento}
          error={errores.documento}
          obligatorio
          autoComplete="username"
        />
        <Campo
          id="password"
          etiqueta="Contraseña"
          tipo="password"
          valor={password}
          onChange={setPassword}
          error={errores.password}
          obligatorio
          autoComplete="current-password"
        />
        <button type="submit" className="boton" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>

      <p className="aviso">
        ¿No tenés cuenta? <Link to="/registro">Registrate</Link>
      </p>

      <p className="aviso">
        <Link to="/recuperar">Olvidé mi contraseña</Link>
      </p>
    </section>
  );
}
