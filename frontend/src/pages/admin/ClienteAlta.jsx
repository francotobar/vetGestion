import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { crear } from '../../api/adminClientes.js';
import { mensajeDeError } from '../../api/cliente.js';
import Campo from '../../components/Campo.jsx';

// Alta asistida de cliente por el administrador (FE-08, RF01b/RF24), ruta
// /admin/clientes/nuevo. Obligatorios: documento, nombre, apellido y
// teléfono; email opcional (igual que altaClienteSchema del backend). El
// backend crea la cuenta como 'sin_cuenta'. Si el documento o el email ya
// existen responde 409 con el id de la ficha existente: se muestra el
// mensaje real de la API y un link a esa ficha (RF24).
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ClienteAlta() {
  const navigate = useNavigate();

  const [formulario, setFormulario] = useState({
    documento: '',
    nombre: '',
    apellido: '',
    telefono: '',
    email: '',
  });
  const [errores, setErrores] = useState({});
  const [errorApi, setErrorApi] = useState('');
  // Duplicado devuelto por la API: { mensaje, id } de la ficha existente.
  const [duplicado, setDuplicado] = useState(null);
  const [enviando, setEnviando] = useState(false);

  function cambiar(campo) {
    return (valor) => {
      setFormulario((f) => ({ ...f, [campo]: valor }));
      setErrores((e) => ({ ...e, [campo]: undefined }));
      setDuplicado(null);
    };
  }

  function validar() {
    const nuevosErrores = {};
    if (!formulario.documento.trim()) nuevosErrores.documento = 'El documento es obligatorio.';
    if (!formulario.nombre.trim()) nuevosErrores.nombre = 'El nombre es obligatorio.';
    if (!formulario.apellido.trim()) nuevosErrores.apellido = 'El apellido es obligatorio.';
    if (!formulario.telefono.trim()) nuevosErrores.telefono = 'El teléfono es obligatorio.';
    if (formulario.email.trim() && !REGEX_EMAIL.test(formulario.email.trim())) {
      nuevosErrores.email = 'El email no tiene un formato válido.';
    }
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function manejarSubmit(e) {
    e.preventDefault();
    setErrorApi('');
    setDuplicado(null);
    if (!validar()) return;

    setEnviando(true);
    try {
      const { data } = await crear({
        documento: formulario.documento.trim(),
        nombre: formulario.nombre.trim(),
        apellido: formulario.apellido.trim(),
        telefono: formulario.telefono.trim(),
        // Email opcional: si viene vacío no se envía.
        email: formulario.email.trim(),
      });
      // El cliente creado queda 'sin_cuenta'; la ficha muestra el estado.
      navigate(`/admin/clientes/${data.id}`, {
        state: { mensaje: 'Cliente creado correctamente.' },
      });
    } catch (error) {
      const status = error.response?.status;
      if (status === 409) {
        // RF24: el backend responde { codigo, mensaje, id } con la ficha
        // existente (documento o email duplicado); se muestra tal cual.
        setDuplicado({
          mensaje: mensajeDeError(error, 'Ya existe un cliente con ese documento o email.'),
          id: error.response.data?.id,
        });
      } else if (!error.response) {
        setErrorApi('No se pudo conectar con el servidor. Intentá nuevamente.');
      } else {
        setErrorApi(mensajeDeError(error, 'No se pudo crear el cliente. Intentá nuevamente.'));
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="pagina">
      <div className="pagina__cabecera">
        <h1>Nuevo cliente</h1>
        <Link to="/admin/clientes" className="boton boton--secundario">
          Volver
        </Link>
      </div>

      <div className="formulario formulario--ancho">
        <form onSubmit={manejarSubmit}>
          <Campo
            id="documento"
            etiqueta="Documento"
            valor={formulario.documento}
            onChange={cambiar('documento')}
            error={errores.documento}
            placeholder="Ej.: 30111222"
          />
          <Campo
            id="nombre"
            etiqueta="Nombre"
            valor={formulario.nombre}
            onChange={cambiar('nombre')}
            error={errores.nombre}
          />
          <Campo
            id="apellido"
            etiqueta="Apellido"
            valor={formulario.apellido}
            onChange={cambiar('apellido')}
            error={errores.apellido}
          />
          <Campo
            id="telefono"
            etiqueta="Teléfono"
            valor={formulario.telefono}
            onChange={cambiar('telefono')}
            error={errores.telefono}
            placeholder="Ej.: 1155554444"
          />
          <Campo
            id="email"
            etiqueta="Email (opcional)"
            tipo="email"
            valor={formulario.email}
            onChange={cambiar('email')}
            error={errores.email}
            ayuda="Si no tiene email, dejalo vacío: el cliente podrá usar el sistema solo con documento y contraseña."
          />

          {duplicado && (
            <div className="error error--caja" role="alert">
              <p>{duplicado.mensaje}</p>
              {duplicado.id && (
                <p>
                  <Link to={`/admin/clientes/${duplicado.id}`}>Ver la ficha del cliente existente</Link>
                </p>
              )}
            </div>
          )}
          {errorApi && (
            <p className="error error--caja" role="alert">
              {errorApi}
            </p>
          )}

          <div className="pagina__acciones">
            <Link to="/admin/clientes" className="boton boton--secundario">
              Cancelar
            </Link>
            <button type="submit" className="boton" disabled={enviando}>
              {enviando ? 'Creando…' : 'Crear cliente'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
