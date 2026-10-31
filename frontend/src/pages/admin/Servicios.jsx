import { useCallback, useEffect, useState } from 'react';
import { actualizar, crear, listarAdmin } from '../../api/servicios.js';
import { mensajeDeError } from '../../api/cliente.js';
import Campo from '../../components/Campo.jsx';
import Modal from '../../components/Modal.jsx';

// Catálogo de servicios del administrador (FE-09, RF19), ruta /admin/servicios.
// Permite listar el catálogo completo (activos e inactivos), crear nuevos servicios,
// editar nombre/descripción y activar/desactivar (baja lógica, sin borrado físico).
export default function Servicios() {
  const [servicios, setServicios] = useState(null); // null = cargando
  const [errorApi, setErrorApi] = useState('');
  const [aviso, setAviso] = useState('');

  // Estado para el modal de alta / edición: null | { modo: 'crear' } | { modo: 'editar', servicio }
  const [modalForm, setModalForm] = useState(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '', activo: true });
  const [errorForm, setErrorForm] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Estado para el modal de confirmación de activación / desactivación:
  // null | { tipo: 'activar' | 'desactivar', servicio }
  const [modalConfirmar, setModalConfirmar] = useState(null);
  const [procesandoToggle, setProcesandoToggle] = useState(false);

  const cargar = useCallback(async () => {
    setErrorApi('');
    try {
      const { data } = await listarAdmin();
      setServicios(data);
    } catch (error) {
      setServicios([]);
      setErrorApi(mensajeDeError(error, 'No pudimos cargar los servicios. Intentá nuevamente.'));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function abrirCrear() {
    setErrorApi('');
    setErrorForm('');
    setForm({ nombre: '', descripcion: '', activo: true });
    setModalForm({ modo: 'crear' });
  }

  function abrirEditar(servicio) {
    setErrorApi('');
    setErrorForm('');
    setForm({
      nombre: servicio.nombre || '',
      descripcion: servicio.descripcion || '',
      activo: Boolean(servicio.activo),
    });
    setModalForm({ modo: 'editar', servicio });
  }

  function cerrarModalForm() {
    if (guardando) return;
    setModalForm(null);
    setErrorForm('');
  }

  async function manejarGuardar(e) {
    if (e) e.preventDefault();
    if (guardando) return;

    const nombreLimpio = form.nombre.trim();
    if (!nombreLimpio) {
      setErrorForm('El nombre no puede estar vacío');
      return;
    }

    setGuardando(true);
    setErrorForm('');
    setAviso('');

    try {
      const payload = {
        nombre: nombreLimpio,
        descripcion: form.descripcion.trim() || null,
        activo: form.activo,
      };

      if (modalForm.modo === 'crear') {
        await crear(payload);
        setAviso(`Servicio "${nombreLimpio}" creado correctamente.`);
      } else {
        await actualizar(modalForm.servicio.id, payload);
        setAviso(`Servicio "${nombreLimpio}" actualizado correctamente.`);
      }

      setModalForm(null);
      setErrorForm('');
      await cargar();
    } catch (error) {
      setErrorForm(mensajeDeError(error, 'Ocurrió un error al guardar el servicio.'));
    } finally {
      setGuardando(false);
    }
  }

  function abrirConfirmarToggle(servicio, tipo) {
    setErrorApi('');
    setModalConfirmar({ tipo, servicio });
  }

  async function ejecutarToggle() {
    if (!modalConfirmar || procesandoToggle) return;
    const { tipo, servicio } = modalConfirmar;
    setProcesandoToggle(true);
    setErrorApi('');
    setAviso('');

    try {
      const nuevoActivo = tipo === 'activar';
      await actualizar(servicio.id, {
        nombre: servicio.nombre,
        descripcion: servicio.descripcion,
        activo: nuevoActivo,
      });

      setAviso(
        nuevoActivo
          ? `Servicio "${servicio.nombre}" activado. Ahora estará disponible para los clientes.`
          : `Servicio "${servicio.nombre}" desactivado. Ya no aparecerá en la reserva de turnos.`
      );
      setModalConfirmar(null);
      await cargar();
    } catch (error) {
      setErrorApi(mensajeDeError(error, 'No pudimos actualizar el estado del servicio.'));
      setModalConfirmar(null);
    } finally {
      setProcesandoToggle(false);
    }
  }

  return (
    <section className="pagina">
      <div className="pagina__cabecera">
        <h1>Servicios</h1>
        <button type="button" className="boton" onClick={abrirCrear}>
          Nuevo servicio
        </button>
      </div>

      <p className="aviso">
        Administrá el catálogo de servicios de la veterinaria. Los servicios inactivos no se muestran
        a los clientes en el asistente de reservas.
      </p>

      {aviso && (
        <p className="aviso--ok" role="status">
          {aviso}
        </p>
      )}

      {errorApi && (
        <p className="error error--caja" role="alert">
          {errorApi}
        </p>
      )}

      {servicios === null && <p>Cargando servicios…</p>}

      {servicios !== null && servicios.length === 0 && (
        <div className="estado-vacio">
          <p>No hay servicios registrados en el catálogo.</p>
          <button type="button" className="boton" onClick={abrirCrear}>
            Crear primer servicio
          </button>
        </div>
      )}

      {servicios !== null && servicios.length > 0 && (
        <ul className="tarjetas">
          {servicios.map((s) => (
            <li key={s.id}>
              <div className="tarjeta">
                <div className="tarjeta__cabecera">
                  <h2>{s.nombre}</h2>
                  <span className={`badge ${s.activo ? 'badge--atendido' : 'badge--cancelado'}`}>
                    {s.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <p className="tarjeta__detalle">
                  {s.descripcion ? s.descripcion : <span className="aviso">Sin descripción</span>}
                </p>
                <div className="tarjeta__acciones">
                  <button
                    type="button"
                    className="boton boton--secundario"
                    onClick={() => abrirEditar(s)}
                  >
                    Editar
                  </button>
                  {s.activo ? (
                    <button
                      type="button"
                      className="boton boton--secundario boton--peligro"
                      onClick={() => abrirConfirmarToggle(s, 'desactivar')}
                    >
                      Desactivar
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="boton"
                      onClick={() => abrirConfirmarToggle(s, 'activar')}
                    >
                      Activar
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Modal de Alta / Edición de Servicio */}
      {modalForm && (
        <Modal
          titulo={modalForm.modo === 'crear' ? 'Nuevo servicio' : 'Editar servicio'}
          textoConfirmar={guardando ? 'Guardando…' : 'Guardar'}
          tipo="normal"
          onConfirmar={guardando ? undefined : manejarGuardar}
          onCancelar={cerrarModalForm}
        >
          <form onSubmit={manejarGuardar}>
            <Campo
              id="nombre"
              etiqueta="Nombre del servicio"
              valor={form.nombre}
              onChange={(val) => setForm((prev) => ({ ...prev, nombre: val }))}
              obligatorio
              maxLength={80}
              placeholder="Ej.: Consulta general, Vacunación, etc."
              autoFocus
            />
            <Campo
              id="descripcion"
              etiqueta="Descripción"
              tipo="textarea"
              valor={form.descripcion}
              onChange={(val) => setForm((prev) => ({ ...prev, descripcion: val }))}
              ayuda="Opcional. Máximo 255 caracteres."
              maxLength={255}
              placeholder="Detalles sobre lo que incluye la atención o requisitos..."
            />
            {modalForm.modo === 'editar' && (
              <Campo
                id="activo"
                etiqueta="Estado"
                tipo="select"
                valor={form.activo ? 'true' : 'false'}
                onChange={(val) => setForm((prev) => ({ ...prev, activo: val === 'true' }))}
                opciones={[
                  { valor: 'true', etiqueta: 'Activo (disponible para reservas)' },
                  { valor: 'false', etiqueta: 'Inactivo (no disponible)' },
                ]}
              />
            )}
            {errorForm && (
              <p className="error error--caja" role="alert">
                {errorForm}
              </p>
            )}
          </form>
        </Modal>
      )}

      {/* Modal de Confirmación para Activar / Desactivar */}
      {modalConfirmar && (
        <Modal
          titulo={modalConfirmar.tipo === 'desactivar' ? 'Desactivar servicio' : 'Activar servicio'}
          mensaje={
            modalConfirmar.tipo === 'desactivar'
              ? `¿Estás seguro de desactivar el servicio "${modalConfirmar.servicio.nombre}"? Dejará de estar disponible para que los clientes reserven turnos.`
              : `¿Estás seguro de activar el servicio "${modalConfirmar.servicio.nombre}"? Volverá a estar disponible para la reserva de turnos.`
          }
          textoConfirmar={
            procesandoToggle
              ? 'Procesando…'
              : modalConfirmar.tipo === 'desactivar'
              ? 'Desactivar'
              : 'Activar'
          }
          tipo={modalConfirmar.tipo === 'desactivar' ? 'peligro' : 'normal'}
          onConfirmar={procesandoToggle ? undefined : ejecutarToggle}
          onCancelar={() => !procesandoToggle && setModalConfirmar(null)}
        />
      )}
    </section>
  );
}
