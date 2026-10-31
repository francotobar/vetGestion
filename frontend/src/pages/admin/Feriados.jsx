import { useCallback, useEffect, useState } from 'react';
import { crear, eliminar, listar } from '../../api/feriados.js';
import { mensajeDeError } from '../../api/cliente.js';
import Campo from '../../components/Campo.jsx';
import Modal from '../../components/Modal.jsx';

// Feriados del administrador (FE-09, RF23), ruta /admin/feriados.
// Permite listar los feriados registrados, dar de alta nuevos feriados (fecha y motivo)
// y dar de baja feriados existentes. Los días feriados quedan bloqueados en la reserva.

function formatearFecha(fechaIso) {
  if (!fechaIso || typeof fechaIso !== 'string') return '';
  const partes = fechaIso.split('-');
  if (partes.length === 3) {
    const [anio, mes, dia] = partes;
    return `${dia}/${mes}/${anio}`;
  }
  return fechaIso;
}

export default function Feriados() {
  const [feriados, setFeriados] = useState(null); // null = cargando
  const [errorApi, setErrorApi] = useState('');
  const [aviso, setAviso] = useState('');

  // Modal de alta: boolean
  const [modalCrear, setModalCrear] = useState(false);
  const [form, setForm] = useState({ fecha: '', motivo: '' });
  const [errorForm, setErrorForm] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Modal de baja: null | feriado a eliminar
  const [feriadoAEliminar, setFeriadoAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const cargar = useCallback(async () => {
    setErrorApi('');
    try {
      const { data } = await listar();
      // Ordenamos por fecha ascendente
      const ordenados = [...data].sort((a, b) => a.fecha.localeCompare(b.fecha));
      setFeriados(ordenados);
    } catch (error) {
      setFeriados([]);
      setErrorApi(mensajeDeError(error, 'No pudimos cargar los feriados. Intentá nuevamente.'));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function abrirCrear() {
    setErrorApi('');
    setErrorForm('');
    setForm({ fecha: '', motivo: '' });
    setModalCrear(true);
  }

  function cerrarModalCrear() {
    if (guardando) return;
    setModalCrear(false);
    setErrorForm('');
  }

  async function manejarGuardar(e) {
    if (e) e.preventDefault();
    if (guardando) return;

    const fechaLimpia = form.fecha.trim();
    const motivoLimpio = form.motivo.trim();

    if (!fechaLimpia) {
      setErrorForm('Falta la fecha');
      return;
    }
    if (!motivoLimpio) {
      setErrorForm('El motivo no puede estar vacío');
      return;
    }

    setGuardando(true);
    setErrorForm('');
    setAviso('');

    try {
      await crear({
        fecha: fechaLimpia,
        motivo: motivoLimpio,
      });

      setAviso(`Feriado del ${formatearFecha(fechaLimpia)} ("${motivoLimpio}") agregado correctamente.`);
      setModalCrear(false);
      setErrorForm('');
      await cargar();
    } catch (error) {
      setErrorForm(mensajeDeError(error, 'No pudimos registrar el feriado. Verificá los datos ingresados.'));
    } finally {
      setGuardando(false);
    }
  }

  function pedirEliminar(feriado) {
    setErrorApi('');
    setFeriadoAEliminar(feriado);
  }

  async function ejecutarEliminar() {
    if (!feriadoAEliminar || eliminando) return;
    setEliminando(true);
    setErrorApi('');
    setAviso('');

    try {
      await eliminar(feriadoAEliminar.fecha);
      setAviso(`Feriado del ${formatearFecha(feriadoAEliminar.fecha)} eliminado correctamente.`);
      setFeriadoAEliminar(null);
      await cargar();
    } catch (error) {
      setErrorApi(mensajeDeError(error, 'No pudimos eliminar el feriado. Intentá nuevamente.'));
      setFeriadoAEliminar(null);
    } finally {
      setEliminando(false);
    }
  }

  return (
    <section className="pagina">
      <div className="pagina__cabecera">
        <h1>Feriados</h1>
        <button type="button" className="boton" onClick={abrirCrear}>
          Nuevo feriado
        </button>
      </div>

      <p className="aviso">
        Los días registrados como feriado no ofrecen franjas horarias disponibles para reserva de turnos
        en la veterinaria (tanto para clientes como para el administrador).
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

      {feriados === null && <p>Cargando feriados…</p>}

      {feriados !== null && feriados.length === 0 && (
        <div className="estado-vacio">
          <p>No hay feriados registrados en el sistema.</p>
          <button type="button" className="boton" onClick={abrirCrear}>
            Registrar primer feriado
          </button>
        </div>
      )}

      {feriados !== null && feriados.length > 0 && (
        <ul className="tarjetas">
          {feriados.map((f) => (
            <li key={f.fecha}>
              <div className="tarjeta">
                <div className="tarjeta__cabecera">
                  <h2>{f.motivo}</h2>
                  <span className="badge badge--pendiente">No laborable</span>
                </div>
                <p className="tarjeta__detalle">
                  <strong>Fecha:</strong> {formatearFecha(f.fecha)} ({f.fecha})
                </p>
                <div className="tarjeta__acciones">
                  <button
                    type="button"
                    className="boton boton--secundario boton--peligro"
                    onClick={() => pedirEliminar(f)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Modal de Alta de Feriado */}
      {modalCrear && (
        <Modal
          titulo="Nuevo feriado"
          textoConfirmar={guardando ? 'Guardando…' : 'Guardar feriado'}
          tipo="normal"
          onConfirmar={guardando ? undefined : manejarGuardar}
          onCancelar={cerrarModalCrear}
        >
          <form onSubmit={manejarGuardar}>
            <Campo
              id="fecha"
              etiqueta="Fecha"
              tipo="date"
              valor={form.fecha}
              onChange={(val) => setForm((prev) => ({ ...prev, fecha: val }))}
              obligatorio
              ayuda="Día no laborable (YYYY-MM-DD)"
              autoFocus
            />
            <Campo
              id="motivo"
              etiqueta="Motivo"
              valor={form.motivo}
              onChange={(val) => setForm((prev) => ({ ...prev, motivo: val }))}
              obligatorio
              maxLength={120}
              placeholder="Ej.: Navidad, Feriado puente nacional, etc."
            />
            {errorForm && (
              <p className="error error--caja" role="alert">
                {errorForm}
              </p>
            )}
          </form>
        </Modal>
      )}

      {/* Modal de Confirmación de Baja */}
      {feriadoAEliminar && (
        <Modal
          titulo="Eliminar feriado"
          mensaje={`¿Eliminar el feriado del ${formatearFecha(feriadoAEliminar.fecha)} ("${feriadoAEliminar.motivo}")? Esa fecha volverá a estar disponible para la reserva de turnos.`}
          textoConfirmar={eliminando ? 'Eliminando…' : 'Eliminar feriado'}
          tipo="peligro"
          onConfirmar={eliminando ? undefined : ejecutarEliminar}
          onCancelar={() => !eliminando && setFeriadoAEliminar(null)}
        />
      )}
    </section>
  );
}
