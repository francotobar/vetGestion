import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { cancelar, misTurnos, reprogramar } from '../../api/turnos.js';
import { mensajeDeError } from '../../api/cliente.js';
import EstadoBadge from '../../components/EstadoBadge.jsx';
import Modal from '../../components/Modal.jsx';
import SelectorFranja from '../../components/SelectorFranja.jsx';

// Mis turnos (/turnos, RF10 y RF11): lista los turnos del cliente con su
// estado y permite cancelar (con confirmación) o reprogramar (reutilizando
// SelectorFranja) los que están en 'pendiente' o 'confirmado'.
// Los errores de la API se muestran tal cual llegan: 422 de antelación
// insuficiente, 422 de transición inválida, 409 de franja ocupada (que
// recarga las franjas del modal) y 404 si el turno ya no existe.
export default function MisTurnos() {
  const [turnos, setTurnos] = useState(null); // null = cargando
  const [errorApi, setErrorApi] = useState('');
  const [aviso, setAviso] = useState('');

  // Acción en curso: null | { tipo: 'cancelar'|'reprogramar', turno }.
  const [accion, setAccion] = useState(null);
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  // Incremento para recargar las franjas del modal (ante un 409/422).
  const [recargaFranjas, setRecargaFranjas] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');

  const cargar = useCallback(() => {
    misTurnos()
      .then(({ data }) => {
        setTurnos(data);
        setErrorApi('');
      })
      .catch((error) => {
        setTurnos([]);
        setErrorApi(mensajeDeError(error, 'No pudimos cargar tus turnos. Intentá nuevamente.'));
      });
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function abrirCancelacion(turno) {
    setAccion({ tipo: 'cancelar', turno });
    setErrorAccion('');
    setAviso('');
  }

  function abrirReprogramacion(turno) {
    setAccion({ tipo: 'reprogramar', turno });
    setErrorAccion('');
    setAviso('');
    // Precargo la fecha actual del turno; la franja se elige de cero.
    setFecha(dayjs(turno.fechaHora).format('YYYY-MM-DD'));
    setHora('');
  }

  function cerrarAccion() {
    setAccion(null);
    setErrorAccion('');
  }

  async function confirmarCancelacion() {
    setGuardando(true);
    setErrorAccion('');
    try {
      await cancelar(accion.turno.id);
      cerrarAccion();
      setAviso('El turno fue cancelado.');
      cargar();
    } catch (error) {
      // 422 (antelación o estado) y 404: se muestra el mensaje real y se
      // cierra para que el cliente vea la lista actualizada.
      cerrarAccion();
      if (error.response?.status === 404) {
        setErrorApi('Ese turno ya no existe.');
        cargar();
      } else {
        setErrorApi(mensajeDeError(error, 'No se pudo cancelar el turno. Intentá nuevamente.'));
      }
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarReprogramacion() {
    setGuardando(true);
    setErrorAccion('');
    try {
      await reprogramar(accion.turno.id, { fecha, hora });
      cerrarAccion();
      setAviso(
        `Turno reprogramado al ${dayjs(`${fecha} ${hora}`).format('DD/MM/YYYY [a las] HH:mm[h]')}.`
      );
      cargar();
    } catch (error) {
      const status = error.response?.status;
      if (status === 409) {
        // La franja se ocupó mientras tanto: avisar y recargar las libres.
        setErrorAccion(mensajeDeError(error, 'Esa franja acaba de ser reservada, elegí otra'));
        setHora('');
        setRecargaFranjas((n) => n + 1);
      } else if (status === 422) {
        setErrorAccion(mensajeDeError(error, 'Esa franja ya no es válida. Elegí otra.'));
        setHora('');
        setRecargaFranjas((n) => n + 1);
      } else if (status === 404) {
        cerrarAccion();
        setErrorApi('Ese turno ya no existe.');
        cargar();
      } else if (!error.response) {
        setErrorAccion('No se pudo conectar con el servidor. Intentá nuevamente.');
      } else {
        setErrorAccion(mensajeDeError(error, 'No se pudo reprogramar el turno. Intentá nuevamente.'));
      }
    } finally {
      setGuardando(false);
    }
  }

  const turnoAccion = accion?.turno;

  return (
    <section className="pagina">
      <div className="pagina__cabecera">
        <h1>Mis turnos</h1>
        <Link to="/turnos/nuevo" className="boton">
          Reservar turno
        </Link>
      </div>

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

      {turnos === null && <p className="aviso">Cargando tus turnos…</p>}

      {turnos !== null && turnos.length === 0 && !errorApi && (
        <div className="estado-vacio">
          <p>Todavía no tenés turnos.</p>
          <Link to="/turnos/nuevo" className="boton">
            Reservar turno
          </Link>
        </div>
      )}

      {turnos !== null && turnos.length > 0 && (
        <ul className="tarjetas">
          {turnos.map((turno) => {
            const accionable = ['pendiente', 'confirmado'].includes(turno.estado);
            return (
              <li key={turno.id} className="tarjeta">
                <div className="tarjeta__cabecera">
                  <h2>{dayjs(turno.fechaHora).format('DD/MM/YYYY [de] HH:mm[h]')}</h2>
                  <EstadoBadge estado={turno.estado} />
                </div>
                <p className="tarjeta__detalle">
                  {turno.mascotaNombre} · {turno.servicioNombre}
                </p>
                {turno.esUrgencia && <p className="tarjeta__detalle">Urgencia</p>}
                {accionable && (
                  <div className="tarjeta__acciones">
                    <button
                      type="button"
                      className="boton boton--secundario"
                      onClick={() => abrirReprogramacion(turno)}
                    >
                      Reprogramar
                    </button>
                    <button
                      type="button"
                      className="boton boton--peligro"
                      onClick={() => abrirCancelacion(turno)}
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {accion?.tipo === 'cancelar' && (
        <Modal
          titulo={`¿Cancelar el turno del ${dayjs(turnoAccion.fechaHora).format('DD/MM/YYYY [a las] HH:mm[h]')}?`}
          mensaje={`Se cancelará el turno de ${turnoAccion.mascotaNombre} por ${turnoAccion.servicioNombre}. Esta acción no se puede deshacer.`}
          textoConfirmar="Cancelar turno"
          onConfirmar={confirmarCancelacion}
          onCancelar={cerrarAccion}
        />
      )}

      {accion?.tipo === 'reprogramar' && (
        <Modal
          titulo="Reprogramar turno"
          mensaje={`Elegí la nueva fecha y franja para el turno de ${turnoAccion.mascotaNombre} por ${turnoAccion.servicioNombre}. El turno volverá a quedar pendiente de confirmación.`}
          textoConfirmar="Confirmar reprogramación"
          tipo="normal"
          onConfirmar={confirmarReprogramacion}
          onCancelar={cerrarAccion}
        >
          <SelectorFranja
            fecha={fecha}
            hora={hora}
            recarga={recargaFranjas}
            onCambio={({ fecha: nuevaFecha, hora: nuevaHora }) => {
              setFecha(nuevaFecha);
              setHora(nuevaHora);
              if (nuevaHora) setErrorAccion('');
            }}
          />
          {errorAccion && (
            <p className="error error--caja" role="alert">
              {errorAccion}
            </p>
          )}
        </Modal>
      )}

      {guardando && <p className="aviso">Guardando…</p>}
    </section>
  );
}
