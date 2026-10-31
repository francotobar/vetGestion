import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { mensajeDeError } from '../../api/cliente.js';
import { restablecer } from '../../api/auth.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Campo from '../../components/Campo.jsx';

// Misma regla que el backend (sección 5): ≥ 6 caracteres y ≥ 2 dígitos.
const REGEX_PASSWORD = /^(?=(?:.*\d){2,}).{6,}$/;

// Pantalla pública que fija la contraseña nueva con el token del enlace de
// recuperación, que llega por query string (/restablecer?token=...).
// La regla de contraseña se valida en el cliente antes de enviar (FE-11);
// un 400 TOKEN_INVALIDO/TOKEN_VENCIDO muestra el mensaje real del backend
// (BE-16: el token vence a la hora y es de un solo uso).
export default function Restablecer() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [parametros] = useSearchParams();
  const token = (parametros.get('token') || '').trim();

  const [password, setPassword] = useState('');
  const [repeticion, setRepeticion] = useState('');
  const [errores, setErrores] = useState({});
  const [errorApi, setErrorApi] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to={usuario.rol === 'admin' ? '/admin/agenda' : '/turnos'} replace />;

  function validar() {
    const nuevosErrores = {};
    if (!REGEX_PASSWORD.test(password)) {
      nuevosErrores.password = 'La contraseña debe tener al menos 6 caracteres y 2 números.';
    }
    if (repeticion !== password) {
      nuevosErrores.repeticion = 'Las contraseñas no coinciden.';
    }
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function manejarSubmit(evento) {
    evento.preventDefault();
    setErrorApi('');
    if (!validar()) return;

    setEnviando(true);
    try {
      const { data } = await restablecer(token, password);
      // Igual que en Registro (FE-02): el aviso de éxito viaja en location.state.
      navigate('/login', { state: { mensaje: data.mensaje } });
    } catch (error) {
      const status = error.response?.status;
      if (status === 400) {
        // TOKEN_INVALIDO o TOKEN_VENCIDO: el enlace ya no sirve.
        setErrorApi(mensajeDeError(error, 'El enlace de recuperación no es válido o venció. Pedí uno nuevo.'));
      } else if (!error.response) {
        setErrorApi('No se pudo conectar con el servidor. Intentá nuevamente.');
      } else {
        setErrorApi(mensajeDeError(error, 'No se pudo restablecer la contraseña. Intentá nuevamente.'));
      }
    } finally {
      setEnviando(false);
    }
  }

  // Sin token en la URL el enlace está incompleto: se pide uno nuevo.
  if (!token) {
    return (
      <section className="pagina formulario">
        <h1>Restablecer contraseña</h1>
        <p className="error error--caja" role="alert">
          El enlace de recuperación no es válido o está incompleto. Pedí uno nuevo para continuar.
        </p>
        <p className="aviso">
          <Link to="/recuperar">Pedir un enlace nuevo</Link>
        </p>
      </section>
    );
  }

  return (
    <section className="pagina formulario">
      <h1>Restablecer contraseña</h1>

      <p className="aviso">Elegí una contraseña nueva para tu cuenta.</p>

      {errorApi && (
        <p className="error error--caja" role="alert">
          {errorApi}
        </p>
      )}

      <form onSubmit={manejarSubmit} noValidate>
        <Campo
          id="password"
          etiqueta="Contraseña nueva"
          tipo="password"
          valor={password}
          onChange={(v) => {
            setPassword(v);
            if (!v || REGEX_PASSWORD.test(v)) setErrores((e) => ({ ...e, password: '' }));
          }}
          error={errores.password}
          ayuda="Mínimo 6 caracteres y al menos 2 números."
          obligatorio
          autoComplete="new-password"
        />
        <Campo
          id="repeticion"
          etiqueta="Repetir contraseña"
          tipo="password"
          valor={repeticion}
          onChange={(v) => {
            setRepeticion(v);
            if (v === password) setErrores((e) => ({ ...e, repeticion: '' }));
          }}
          error={errores.repeticion}
          obligatorio
          autoComplete="new-password"
        />
        <button type="submit" className="boton" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>

      <p className="aviso">
        <Link to="/login">Volver a iniciar sesión</Link>
      </p>
    </section>
  );
}
