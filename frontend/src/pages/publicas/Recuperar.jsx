import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { mensajeDeError } from '../../api/cliente.js';
import { recuperar } from '../../api/auth.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Campo from '../../components/Campo.jsx';

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Pantalla pública de recuperación de contraseña (RF02, BE-16). El backend
// responde siempre igual, exista o no el email con esa cuenta: la pantalla
// muestra solo el mensaje del backend y nunca revela si el email existe.
// El enlace de restablecimiento lo simula el backend (sin SMTP) imprimiéndolo
// por la consola del servidor; el token nunca llega al cliente (BE-16).
export default function Recuperar() {
  const { usuario } = useAuth();
  const [email, setEmail] = useState('');
  const [errorEmail, setErrorEmail] = useState('');
  const [errorApi, setErrorApi] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Con sesión vigente no tiene sentido pedir recuperación.
  if (usuario) return <Navigate to={usuario.rol === 'admin' ? '/admin/agenda' : '/turnos'} replace />;

  async function manejarSubmit(evento) {
    evento.preventDefault();
    setErrorApi('');
    setAviso('');

    const emailLimpio = email.trim();
    if (!emailLimpio) {
      setErrorEmail('El email es obligatorio.');
      return;
    }
    if (!REGEX_EMAIL.test(emailLimpio)) {
      setErrorEmail('El email no tiene un formato válido.');
      return;
    }
    setErrorEmail('');

    setEnviando(true);
    try {
      const { data } = await recuperar(emailLimpio);
      // Mismo mensaje siempre (el real del backend): no revela existencia.
      setAviso(data.mensaje);
      setEmail('');
    } catch (error) {
      if (!error.response) {
        setErrorApi('No se pudo conectar con el servidor. Intentá nuevamente.');
      } else {
        setErrorApi(mensajeDeError(error, 'No se pudo pedir la recuperación. Intentá nuevamente.'));
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="pagina formulario">
      <h1>Recuperar contraseña</h1>

      <p className="aviso">
        Ingresá el email que tenés registrado en la veterinaria y te vamos a enviar un enlace para
        crear una contraseña nueva.
      </p>

      {aviso && (
        <p className="aviso aviso--ok" role="status">
          {aviso}
        </p>
      )}

      {errorApi && (
        <p className="error error--caja" role="alert">
          {errorApi}
        </p>
      )}

      <form onSubmit={manejarSubmit} noValidate>
        <Campo
          id="email"
          etiqueta="Email"
          tipo="email"
          valor={email}
          onChange={setEmail}
          error={errorEmail}
          obligatorio
          autoComplete="email"
        />
        <button type="submit" className="boton" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar enlace'}
        </button>
      </form>

      <p className="aviso">
        <Link to="/login">Volver a iniciar sesión</Link>
      </p>
    </section>
  );
}
