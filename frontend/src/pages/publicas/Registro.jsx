import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { mensajeDeError } from '../../api/cliente.js';
import { registrar } from '../../api/auth.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Campo from '../../components/Campo.jsx';

// Misma regla que el backend (sección 5): ≥ 6 caracteres y ≥ 2 dígitos.
const REGEX_PASSWORD = /^(?=(?:.*\d){2,}).{6,}$/;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Pantalla pública de registro de cliente (RF01a). Valida en el cliente
// (obligatorios, contraseña, consentimiento) y muestra los errores que
// devuelve la API, en particular el 409 (documento ya con cuenta / email
// duplicado / ficha existente con teléfono distinto).
export default function Registro() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const [formulario, setFormulario] = useState({
    nombre: '',
    apellido: '',
    documento: '',
    telefono: '',
    email: '',
    password: '',
  });
  const [consentimiento, setConsentimiento] = useState(false);
  const [errores, setErrores] = useState({});
  const [errorApi, setErrorApi] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to={usuario.rol === 'admin' ? '/admin/agenda' : '/turnos'} replace />;

  function cambiar(campo) {
    return (valor) => setFormulario((f) => ({ ...f, [campo]: valor }));
  }

  function validar() {
    const nuevosErrores = {};
    if (!formulario.nombre.trim()) nuevosErrores.nombre = 'El nombre es obligatorio.';
    if (!formulario.apellido.trim()) nuevosErrores.apellido = 'El apellido es obligatorio.';
    if (!formulario.documento.trim()) nuevosErrores.documento = 'El documento es obligatorio.';
    if (!formulario.telefono.trim()) nuevosErrores.telefono = 'El teléfono es obligatorio.';
    if (!REGEX_PASSWORD.test(formulario.password)) {
      nuevosErrores.password = 'La contraseña debe tener al menos 6 caracteres y 2 números.';
    }
    if (formulario.email.trim() && !REGEX_EMAIL.test(formulario.email.trim())) {
      nuevosErrores.email = 'El email no tiene un formato válido.';
    }
    if (!consentimiento) {
      nuevosErrores.consentimiento = 'Debés aceptar el tratamiento de datos personales.';
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
      await registrar({
        nombre: formulario.nombre.trim(),
        apellido: formulario.apellido.trim(),
        documento: formulario.documento.trim(),
        telefono: formulario.telefono.trim(),
        // El email es opcional: si viene vacío no se envía.
        email: formulario.email.trim() || undefined,
        password: formulario.password,
        consentimiento: true,
      });
      // El registro no crea sesión: el cliente ingresa con sus credenciales.
      navigate('/login', { state: { mensaje: 'Cuenta creada correctamente. Ya podés iniciar sesión.' } });
    } catch (error) {
      const status = error.response?.status;
      if (status === 409) {
        // El backend responde 409 con un mensaje específico: email en uso,
        // documento ya con cuenta, o ficha existente con teléfono distinto
        // ("Contactá a la veterinaria").
        setErrorApi(mensajeDeError(error, 'El documento o el email ya están registrados. Contactá a la veterinaria.'));
      } else if (status === 400) {
        setErrorApi(mensajeDeError(error, 'Revisá los datos ingresados.'));
      } else if (!error.response) {
        setErrorApi('No se pudo conectar con el servidor. Intentá nuevamente.');
      } else {
        setErrorApi(mensajeDeError(error, 'No se pudo crear la cuenta. Intentá nuevamente.'));
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="pagina formulario formulario--registro">
      <h1>Crear cuenta</h1>

      {errorApi && (
        <p className="error error--caja" role="alert">
          {errorApi}
        </p>
      )}

      <form onSubmit={manejarSubmit} noValidate>
        <Campo
          id="nombre"
          etiqueta="Nombre"
          valor={formulario.nombre}
          onChange={cambiar('nombre')}
          error={errores.nombre}
          obligatorio
          autoComplete="given-name"
        />
        <Campo
          id="apellido"
          etiqueta="Apellido"
          valor={formulario.apellido}
          onChange={cambiar('apellido')}
          error={errores.apellido}
          obligatorio
          autoComplete="family-name"
        />
        <Campo
          id="documento"
          etiqueta="Documento (DNI)"
          valor={formulario.documento}
          onChange={cambiar('documento')}
          error={errores.documento}
          obligatorio
          autoComplete="username"
        />
        <Campo
          id="telefono"
          etiqueta="Teléfono"
          tipo="tel"
          valor={formulario.telefono}
          onChange={cambiar('telefono')}
          error={errores.telefono}
          obligatorio
          autoComplete="tel"
        />
        <Campo
          id="email"
          etiqueta="Email (opcional)"
          tipo="email"
          valor={formulario.email}
          onChange={cambiar('email')}
          error={errores.email}
          ayuda="Si ya sos cliente de la veterinaria, usá el email que tenemos registrado."
          autoComplete="email"
        />
        <Campo
          id="password"
          etiqueta="Contraseña"
          tipo="password"
          valor={formulario.password}
          onChange={cambiar('password')}
          error={errores.password}
          ayuda="Mínimo 6 caracteres y al menos 2 números."
          obligatorio
          autoComplete="new-password"
        />

        <div className="campo campo--checkbox">
          <label>
            <input
              type="checkbox"
              checked={consentimiento}
              onChange={(e) => setConsentimiento(e.target.checked)}
            />
            <span>
              Acepto el tratamiento de mis datos personales conforme a la Ley 25.326 de
              Protección de los Datos Personales, con la finalidad de gestionar mi cuenta y
              los turnos de mis mascotas.
            </span>
          </label>
          {errores.consentimiento && (
            <p className="error" role="alert">
              {errores.consentimiento}
            </p>
          )}
        </div>

        <button type="submit" className="boton" disabled={enviando}>
          {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>

      <p className="aviso">
        ¿Ya tenés cuenta? <Link to="/login">Iniciar sesión</Link>
      </p>
    </section>
  );
}
