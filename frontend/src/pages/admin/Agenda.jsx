import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  agenda,
  cambiarEstado,
  reprogramar as reprogramarTurno,
  urgencia,
} from '../../api/adminTurnos.js';
import { agregarNota, cargarAtencion, historialAdmin } from '../../api/atenciones.js';
import { mensajeDeError } from '../../api/cliente.js';
import Campo from '../../components/Campo.jsx';
import DetalleAtencion from '../../components/DetalleAtencion.jsx';
import EstadoBadge from '../../components/EstadoBadge.jsx';
import Modal from '../../components/Modal.jsx';
import SelectorFranja from '../../components/SelectorFranja.jsx';

// Mapa de transiciones válidas (sección 5 del plan; idéntico al del backend,
// BE-11). Cualquier otra acción responde 422 TRANSICION_INVALIDA, por eso la
// UI solo ofrece los destinos válidos para cada estado.
const TRANSICIONES = {
  pendiente: ['confirmado', 'cancelado'],
  confirmado: ['atendido', 'ausente', 'cancelado'],
  atendido: [],
  ausente: [],
  cancelado: [],
};

// Etiquetas y estilo de cada acción de estado (los textos son los estados
// del contrato; nada inventado fuera del mapa).
const ACCIONES = {
  confirmado: { texto: 'Confirmar', clase: 'boton' },
  atendido: { texto: 'Atendido', clase: 'boton' },
  ausente: { texto: 'Ausente', clase: 'boton' },
  cancelado: { texto: 'Cancelar', clase: 'boton boton--peligro' },
};

const CANALES = { web: 'Web', telefonico: 'Telefónico', presencial: 'Presencial' };
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// Etiquetas de los campos de texto de la atención (FE-10, todos opcionales
// salvo el profesional: cargarAtencionSchema del backend).
const ETIQUETAS_ATENCION = {
  anamnesis: 'Anamnesis',
  diagnostico: 'Diagnóstico',
  tratamiento: 'Tratamiento',
  medicacion: 'Medicación',
  vacunas: 'Vacunas',
  observaciones: 'Observaciones',
};

// Las 20 franjas de atención (09:00–18:30 cada 30 min), mismos defaults que
// utils/fechas.js del backend (HORA_INICIO/HORA_FIN/SLOT_MINUTOS del .env).
function generarFranjas() {
  const lista = [];
  for (let m = 9 * 60; m <= 18 * 60 + 30; m += 30) {
    lista.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return lista;
}
const FRANJAS = generarFranjas();

function horaDe(turno) {
  return turno.fechaHora.slice(11, 16);
}
function fechaDe(turno) {
  return turno.fechaHora.slice(0, 10);
}
function codigoDe(error) {
  return error?.response?.data?.codigo;
}

// Agenda del administrador (/admin/agenda, FE-06):
// * vista por día: las 20 franjas con sus turnos y las libres con
//   "Cargar turno" (→ /admin/turnos/nuevo, FE-07);
// * vista semanal: lunes a domingo con los turnos de cada día;
// * acciones de estado según el mapa de la sección 5, reprogramación con
//   SelectorFranja y urgencia (motivo obligatorio) que al terminar muestra
//   el contacto del cliente para avisarle (RF25).
export default function Agenda() {
  const [vista, setVista] = useState('dia'); // 'dia' | 'semana'
  const [fecha, setFecha] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [turnos, setTurnos] = useState(null); // null = cargando
  const [errorApi, setErrorApi] = useState('');
  const [aviso, setAviso] = useState('');

  // Acción en curso: null | { tipo: 'estado'|'reprogramar'|'urgencia', ... }.
  const [accion, setAccion] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [accionUrgencia, setAccionUrgencia] = useState('cancelar');
  const [fechaNueva, setFechaNueva] = useState('');
  const [horaNueva, setHoraNueva] = useState('');
  // Incremento para recargar las franjas del modal (ante 409/422).
  const [recargaFranjas, setRecargaFranjas] = useState(0);
  const [errorAccion, setErrorAccion] = useState('');
  const [guardando, setGuardando] = useState(false);
  // Formulario de atención (FE-10): profesional obligatorio, el resto opcional.
  const [formAtencion, setFormAtencion] = useState({
    profesionalNombre: '',
    anamnesis: '',
    diagnostico: '',
    tratamiento: '',
    medicacion: '',
    vacunas: '',
    observaciones: '',
  });
  // Texto de la nota aclaratoria que se agrega bajo una atención.
  const [notaTexto, setNotaTexto] = useState('');
  // Contacto del cliente tras una urgencia (respuesta del backend, RF25).
  const [contacto, setContacto] = useState(null);

  // Historiales por mascota (FE-10): la agenda no informa qué turnos
  // atendidos ya tienen atención, así que se pide el historial de cada
  // mascota con turnos atendidos. { [mascotaId]: { estado, atenciones } }.
  const [historiales, setHistoriales] = useState({});
  // Mascotas cuyo historial ya se pidió: evita repetir el GET al navegar
  // por días o semanas.
  const historialesPedidos = useRef(new Set());

  const pedirHistoriales = useCallback((turnosActuales) => {
    const mascotas = [
      ...new Set(turnosActuales.filter((t) => t.estado === 'atendido').map((t) => t.mascotaId)),
    ];
    mascotas
      .filter((mascotaId) => !historialesPedidos.current.has(mascotaId))
      .forEach((mascotaId) => {
        historialesPedidos.current.add(mascotaId);
        historialAdmin(mascotaId)
          .then(({ data }) => {
            setHistoriales((prev) => ({ ...prev, [mascotaId]: { estado: 'ok', atenciones: data } }));
          })
          .catch(() => {
            // Si el historial no se pudo cargar no se ofrece registrar una
            // atención: el backend igual la rechazaría con 409 si ya existe.
            setHistoriales((prev) => ({ ...prev, [mascotaId]: { estado: 'error', atenciones: [] } }));
          });
      });
  }, []);

  // Inicio y fin de la semana que contiene "fecha" (lunes a domingo).
  // Se memoizan para que cambiar un estado ajeno no recree estos objetos:
  // si fueran objetos nuevos en cada render, "cargar" (useCallback) cambiaría
  // siempre y el useEffect dispararía recargas en bucle.
  const lunes = useMemo(() => dayjs(fecha).subtract((dayjs(fecha).day() + 6) % 7, 'day'), [fecha]);
  const domingo = useMemo(() => lunes.add(6, 'day'), [lunes]);

  const cargar = useCallback(() => {
    let desde = fecha;
    let hasta = fecha;
    if (vista === 'semana') {
      const ini = dayjs(fecha).subtract((dayjs(fecha).day() + 6) % 7, 'day');
      desde = ini.format('YYYY-MM-DD');
      hasta = ini.add(6, 'day').format('YYYY-MM-DD');
    }
    agenda({ desde, hasta })
      .then(({ data }) => {
        setTurnos(data);
        setErrorApi('');
        pedirHistoriales(data);
      })
      .catch((error) => {
        setTurnos([]);
        setErrorApi(mensajeDeError(error, 'No pudimos cargar la agenda. Intentá nuevamente.'));
      });
  }, [vista, fecha, pedirHistoriales]);

  useEffect(() => {
    setTurnos(null);
    cargar();
  }, [cargar]);

  function abrirEstado(turno, nuevoEstado) {
    setAccion({ tipo: 'estado', turno, nuevoEstado });
    setErrorAccion('');
    setAviso('');
  }

  function abrirReprogramacion(turno) {
    setAccion({ tipo: 'reprogramar', turno });
    setErrorAccion('');
    setAviso('');
    setFechaNueva(fechaDe(turno));
    setHoraNueva('');
  }

  function abrirUrgencia(turno) {
    setAccion({ tipo: 'urgencia', turno });
    setErrorAccion('');
    setAviso('');
    setMotivo('');
    setAccionUrgencia('cancelar');
    setFechaNueva(fechaDe(turno));
    setHoraNueva('');
  }

  function cerrarAccion() {
    setAccion(null);
    setErrorAccion('');
  }

  // FE-10: atención del turno, si existe. undefined = el historial todavía no
  // se cargó (o falló) y no se ofrece ninguna acción; null = sin atención.
  function atencionDe(turno) {
    const entrada = historiales[turno.mascotaId];
    if (!entrada || entrada.estado !== 'ok') return undefined;
    return entrada.atenciones.find((atencion) => atencion.turnoId === turno.id) || null;
  }

  function abrirAtencion(turno) {
    setAccion({ tipo: 'atencion', turno });
    setFormAtencion({
      profesionalNombre: '',
      anamnesis: '',
      diagnostico: '',
      tratamiento: '',
      medicacion: '',
      vacunas: '',
      observaciones: '',
    });
    setErrorAccion('');
    setAviso('');
  }

  function abrirNotas(turno, atencion) {
    setAccion({ tipo: 'notas', turno, atencion });
    setNotaTexto('');
    setErrorAccion('');
    setAviso('');
  }

  // Después de guardar una atención o una nota, el historial de esa mascota
  // se vuelve a pedir en la próxima carga de la agenda.
  function invalidarHistorial(mascotaId) {
    historialesPedidos.current.delete(mascotaId);
    setHistoriales((prev) => {
      const copia = { ...prev };
      delete copia[mascotaId];
      return copia;
    });
  }

  async function confirmarAtencion() {
    const { turno } = accion;
    if (!formAtencion.profesionalNombre.trim()) {
      setErrorAccion('El nombre del profesional es obligatorio.');
      return;
    }
    setGuardando(true);
    setErrorAccion('');
    try {
      await cargarAtencion(turno.id, {
        profesionalNombre: formAtencion.profesionalNombre.trim(),
        anamnesis: formAtencion.anamnesis.trim(),
        diagnostico: formAtencion.diagnostico.trim(),
        tratamiento: formAtencion.tratamiento.trim(),
        medicacion: formAtencion.medicacion.trim(),
        vacunas: formAtencion.vacunas.trim(),
        observaciones: formAtencion.observaciones.trim(),
      });
      // La atención es inmutable: no se puede editar ni borrar luego (RF26).
      setAviso('Atención registrada en el historial de la mascota.');
      cerrarAccion();
      invalidarHistorial(turno.mascotaId);
      cargar();
    } catch (error) {
      const status = error.response?.status;
      if (status === 404 || status === 422 || status === 409) {
        // 404: el turno ya no existe; 422 TURNO_NO_ATENDIDO: cambió de estado;
        // 409 ATENCION_YA_EXISTE: otro admin ya la cargó. En los tres casos se
        // muestra el motivo real y se recarga (el botón desaparece solo).
        cerrarAccion();
        setErrorApi(mensajeDeError(error, 'No se pudo registrar la atención.'));
        invalidarHistorial(turno.mascotaId);
        cargar();
      } else if (!error.response) {
        setErrorAccion('No se pudo conectar con el servidor. Intentá nuevamente.');
      } else {
        setErrorAccion(mensajeDeError(error, 'No se pudo registrar la atención. Intentá nuevamente.'));
      }
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarNota() {
    // El historial no incluye mascota_id (SELECT de obtenerHistorial): el
    // id de la mascota sale del turno de la agenda, que sí lo trae.
    const { atencion, turno } = accion;
    const texto = notaTexto.trim();
    if (!texto) {
      setErrorAccion('El texto de la nota es obligatorio.');
      return;
    }
    setGuardando(true);
    setErrorAccion('');
    try {
      const { data } = await agregarNota(atencion.id, texto);
      // La nota se agrega debajo sin tocar la atención original (RF27).
      setHistoriales((prev) => {
        const entrada = prev[turno.mascotaId];
        if (!entrada) return prev;
        return {
          ...prev,
          [turno.mascotaId]: {
            ...entrada,
            atenciones: entrada.atenciones.map((a) =>
              a.id === atencion.id ? { ...a, notas: [...a.notas, data] } : a
            ),
          },
        };
      });
      setAccion((a) =>
        a ? { ...a, atencion: { ...a.atencion, notas: [...a.atencion.notas, data] } } : a
      );
      setNotaTexto('');
      setAviso('Nota aclaratoria agregada.');
    } catch (error) {
      if (error.response?.status === 404) {
        cerrarAccion();
        setErrorApi('Esa atención ya no existe.');
        invalidarHistorial(turno.mascotaId);
        cargar();
      } else if (!error.response) {
        setErrorAccion('No se pudo conectar con el servidor. Intentá nuevamente.');
      } else {
        setErrorAccion(mensajeDeError(error, 'No se pudo agregar la nota. Intentá nuevamente.'));
      }
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEstado() {
    const { turno, nuevoEstado } = accion;
    setGuardando(true);
    setErrorAccion('');
    try {
      await cambiarEstado(turno.id, nuevoEstado);
      setAviso(`Turno ${nuevoEstado}.`);
      cerrarAccion();
      cargar();
    } catch (error) {
      const status = error.response?.status;
      if (status === 404) {
        cerrarAccion();
        setErrorApi('Ese turno ya no existe.');
        cargar();
      } else if (status === 422) {
        // TRANSICION_INVALIDA: el mapa de la UI y el del backend pueden
        // divergir si otro admin cambió el turno; se muestra el motivo real.
        cerrarAccion();
        setErrorApi(mensajeDeError(error, 'Ese cambio de estado no está permitido.'));
        cargar();
      } else if (!error.response) {
        setErrorAccion('No se pudo conectar con el servidor. Intentá nuevamente.');
      } else {
        setErrorAccion(mensajeDeError(error, 'No se pudo actualizar el turno. Intentá nuevamente.'));
      }
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarReprogramacion() {
    setGuardando(true);
    setErrorAccion('');
    try {
      await reprogramarTurno(accion.turno.id, { fecha: fechaNueva, hora: horaNueva });
      setAviso(
        `Turno reprogramado al ${dayjs(`${fechaNueva} ${horaNueva}`).format('DD/MM/YYYY [a las] HH:mm[h]')}.`
      );
      cerrarAccion();
      cargar();
    } catch (error) {
      const codigo = codigoDe(error);
      const status = error.response?.status;
      if (status === 409 || codigo === 'FRANJA_INVALIDA') {
        // Franja ocupada o inválida: elegir otra sin cerrar el modal.
        setErrorAccion(mensajeDeError(error, 'Esa franja no está disponible. Elegí otra.'));
        setHoraNueva('');
        setRecargaFranjas((n) => n + 1);
      } else if (status === 404) {
        cerrarAccion();
        setErrorApi('Ese turno ya no existe.');
        cargar();
      } else if (status === 422) {
        cerrarAccion();
        setErrorApi(mensajeDeError(error, 'No se puede reprogramar ese turno.'));
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

  async function confirmarUrgencia() {
    const motivoLimpio = motivo.trim();
    if (!motivoLimpio) {
      setErrorAccion('El motivo es obligatorio.');
      return;
    }
    if (accionUrgencia === 'reprogramar' && (!fechaNueva || !horaNueva)) {
      setErrorAccion('Elegí la fecha y la franja nuevas.');
      return;
    }
    setGuardando(true);
    setErrorAccion('');
    try {
      const { data } = await urgencia(accion.turno.id, {
        accion: accionUrgencia,
        motivo: motivoLimpio,
        ...(accionUrgencia === 'reprogramar' ? { fecha: fechaNueva, hora: horaNueva } : {}),
      });
      setAviso(
        accionUrgencia === 'cancelar'
          ? 'Urgencia registrada: el turno quedó cancelado.'
          : `Urgencia registrada: turno reprogramado al ${dayjs(`${fechaNueva} ${horaNueva}`).format('DD/MM/YYYY [a las] HH:mm[h]')}.`
      );
      cerrarAccion();
      setContacto(data.cliente); // el backend responde el contacto (RF25)
      cargar();
    } catch (error) {
      const codigo = codigoDe(error);
      const status = error.response?.status;
      if (status === 409 || codigo === 'FRANJA_INVALIDA') {
        setErrorAccion(mensajeDeError(error, 'Esa franja no está disponible. Elegí otra.'));
        setHoraNueva('');
        setRecargaFranjas((n) => n + 1);
      } else if (status === 404) {
        cerrarAccion();
        setErrorApi('Ese turno ya no existe.');
        cargar();
      } else if (status === 422) {
        // TRANSICION_INVALIDA (el turno ya no es accionable): mensaje real.
        cerrarAccion();
        setErrorApi(mensajeDeError(error, 'No se puede aplicar una urgencia a ese turno.'));
        cargar();
      } else if (!error.response) {
        setErrorAccion('No se pudo conectar con el servidor. Intentá nuevamente.');
      } else {
        setErrorAccion(mensajeDeError(error, 'No se pudo registrar la urgencia. Intentá nuevamente.'));
      }
    } finally {
      setGuardando(false);
    }
  }

  function moverFecha(pasos) {
    setFecha(dayjs(fecha).add(pasos, vista === 'dia' ? 'day' : 'week').format('YYYY-MM-DD'));
  }

  const turnoAccion = accion?.turno;

  return (
    <section className="pagina">
      <div className="pagina__cabecera">
        <h1>Agenda</h1>
        <div className="pagina__acciones">
          <button
            type="button"
            className={vista === 'dia' ? 'boton' : 'boton boton--secundario'}
            onClick={() => setVista('dia')}
          >
            Por día
          </button>
          <button
            type="button"
            className={vista === 'semana' ? 'boton' : 'boton boton--secundario'}
            onClick={() => setVista('semana')}
          >
            Por semana
          </button>
        </div>
      </div>

      <div className="agenda__nav">
        <button type="button" className="boton boton--secundario" onClick={() => moverFecha(-1)}>
          ← Anterior
        </button>
        {vista === 'dia' ? (
          <input
            type="date"
            aria-label="Fecha de la agenda"
            value={fecha}
            min="2020-01-01"
            onChange={(e) => e.target.value && setFecha(e.target.value)}
          />
        ) : (
          <strong className="agenda__semana-label">
            Semana del {lunes.format('DD/MM')} al {domingo.format('DD/MM')}
          </strong>
        )}
        <button type="button" className="boton boton--secundario" onClick={() => moverFecha(1)}>
          Siguiente →
        </button>
        <button
          type="button"
          className="boton boton--secundario"
          onClick={() => setFecha(dayjs().format('YYYY-MM-DD'))}
        >
          Hoy
        </button>
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

      {turnos === null && <p className="aviso">Cargando agenda…</p>}

      {turnos !== null && vista === 'dia' && (
        <ol className="agenda">
          {FRANJAS.map((franja) => {
            const turno = turnos.find((t) => horaDe(t) === franja);
            return (
              <li key={franja} className="agenda__fila">
                <span className="agenda__hora">{franja}</span>
                {turno ? (
                  <TarjetaTurno
                    turno={turno}
                    atencion={atencionDe(turno)}
                    onEstado={abrirEstado}
                    onReprogramar={abrirReprogramacion}
                    onUrgencia={abrirUrgencia}
                    onRegistrarAtencion={abrirAtencion}
                    onVerNotas={abrirNotas}
                  />
                ) : (
                  <span className="agenda__libre">
                    Franja libre{' '}
                    <Link to="/admin/turnos/nuevo" className="boton boton--secundario">
                      Cargar turno
                    </Link>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {turnos !== null && vista === 'semana' && (
        <div className="agenda__semana">
          {Array.from({ length: 7 }, (_, i) => {
            const dia = lunes.add(i, 'day');
            const delDia = turnos.filter((t) => fechaDe(t) === dia.format('YYYY-MM-DD'));
            return (
              <section key={dia.format('YYYY-MM-DD')} className="agenda__dia">
                <h2>
                  {DIAS_CORTOS[i]} {dia.format('DD/MM')}
                </h2>
                {delDia.length === 0 ? (
                  <p className="aviso">Sin turnos</p>
                ) : (
                  <ul className="agenda__dia-lista">
                    {delDia.map((turno) => (
                      <li key={turno.id}>
                        <TarjetaTurno
                          turno={turno}
                          atencion={atencionDe(turno)}
                          mostrarHora
                          onEstado={abrirEstado}
                          onReprogramar={abrirReprogramacion}
                          onUrgencia={abrirUrgencia}
                          onRegistrarAtencion={abrirAtencion}
                          onVerNotas={abrirNotas}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {accion?.tipo === 'estado' && (
        <Modal
          titulo={`${ACCIONES[accion.nuevoEstado].texto} turno`}
          mensaje={`${turnoAccion.clienteNombre} ${turnoAccion.clienteApellido} · ${turnoAccion.mascotaNombre} — ${dayjs(turnoAccion.fechaHora).format('DD/MM/YYYY [de] HH:mm[h]')}`}
          textoConfirmar={ACCIONES[accion.nuevoEstado].texto}
          tipo={accion.nuevoEstado === 'cancelado' ? 'peligro' : 'normal'}
          onConfirmar={confirmarEstado}
          onCancelar={cerrarAccion}
        >
          {errorAccion && (
            <p className="error error--caja" role="alert">
              {errorAccion}
            </p>
          )}
        </Modal>
      )}

      {accion?.tipo === 'reprogramar' && (
        <Modal
          titulo="Reprogramar turno"
          mensaje={`${turnoAccion.clienteNombre} ${turnoAccion.clienteApellido} · ${turnoAccion.mascotaNombre}. El turno conserva su estado actual.`}
          textoConfirmar="Confirmar reprogramación"
          tipo="normal"
          onConfirmar={confirmarReprogramacion}
          onCancelar={cerrarAccion}
        >
          <SelectorFranja
            fecha={fechaNueva}
            hora={horaNueva}
            recarga={recargaFranjas}
            onCambio={({ fecha: f, hora: h }) => {
              setFechaNueva(f);
              setHoraNueva(h);
              if (h) setErrorAccion('');
            }}
          />
          {errorAccion && (
            <p className="error error--caja" role="alert">
              {errorAccion}
            </p>
          )}
        </Modal>
      )}

      {accion?.tipo === 'urgencia' && (
        <Modal
          titulo="Registrar urgencia"
          mensaje={`Turno de ${turnoAccion.clienteNombre} ${turnoAccion.clienteApellido} · ${turnoAccion.mascotaNombre} — ${dayjs(turnoAccion.fechaHora).format('DD/MM/YYYY [de] HH:mm[h]')}. Al terminar vas a ver el contacto del cliente para avisarle.`}
          textoConfirmar="Aplicar urgencia"
          tipo="normal"
          onConfirmar={confirmarUrgencia}
          onCancelar={cerrarAccion}
        >
          <Campo
            id="motivoUrgencia"
            etiqueta="Motivo de la urgencia"
            tipo="textarea"
            valor={motivo}
            onChange={(v) => {
              setMotivo(v);
              if (v.trim()) setErrorAccion('');
            }}
            ayuda="Obligatorio. Se guarda en el turno."
            obligatorio
          />
          <Campo
            id="accionUrgencia"
            tipo="select"
            etiqueta="Acción"
            valor={accionUrgencia}
            onChange={(v) => {
              setAccionUrgencia(v);
              setErrorAccion('');
            }}
            opciones={[
              { valor: 'cancelar', etiqueta: 'Cancelar el turno' },
              { valor: 'reprogramar', etiqueta: 'Reprogramar a otra franja' },
            ]}
          />
          {accionUrgencia === 'reprogramar' && (
            <SelectorFranja
              fecha={fechaNueva}
              hora={horaNueva}
              recarga={recargaFranjas}
              onCambio={({ fecha: f, hora: h }) => {
                setFechaNueva(f);
                setHoraNueva(h);
                if (h) setErrorAccion('');
              }}
            />
          )}
          {errorAccion && (
            <p className="error error--caja" role="alert">
              {errorAccion}
            </p>
          )}
        </Modal>
      )}

      {accion?.tipo === 'atencion' && (
        <Modal
          titulo="Registrar atención"
          mensaje={`${turnoAccion.clienteNombre} ${turnoAccion.clienteApellido} · ${turnoAccion.mascotaNombre} — ${dayjs(turnoAccion.fechaHora).format('DD/MM/YYYY [de] HH:mm[h]')}. Una vez guardada no se puede editar ni borrar: las atenciones son inmutables.`}
          textoConfirmar="Guardar atención"
          tipo="normal"
          onConfirmar={confirmarAtencion}
          onCancelar={cerrarAccion}
        >
          <Campo
            id="profesionalAtencion"
            etiqueta="Nombre del profesional"
            valor={formAtencion.profesionalNombre}
            onChange={(v) => {
              setFormAtencion((f) => ({ ...f, profesionalNombre: v }));
              if (v.trim()) setErrorAccion('');
            }}
            obligatorio
          />
          {['anamnesis', 'diagnostico', 'tratamiento', 'medicacion', 'vacunas', 'observaciones'].map(
            (campo) => (
              <Campo
                key={campo}
                id={campo}
                etiqueta={ETIQUETAS_ATENCION[campo]}
                tipo="textarea"
                valor={formAtencion[campo]}
                onChange={(v) => setFormAtencion((f) => ({ ...f, [campo]: v }))}
              />
            )
          )}
          {errorAccion && (
            <p className="error error--caja" role="alert">
              {errorAccion}
            </p>
          )}
          {guardando && <p className="aviso">Guardando…</p>}
        </Modal>
      )}

      {accion?.tipo === 'notas' && (
        <Modal
          titulo="Notas aclaratorias"
          mensaje={`Atención de ${turnoAccion.mascotaNombre} del ${dayjs(turnoAccion.fechaHora).format('DD/MM/YYYY')}. El texto original es inmutable: las notas se agregan debajo (RF27).`}
          textoConfirmar="Agregar nota"
          tipo="normal"
          onConfirmar={confirmarNota}
          onCancelar={cerrarAccion}
        >
          <DetalleAtencion atencion={accion.atencion} />
          <Campo
            id="notaAtencion"
            etiqueta="Nueva nota aclaratoria"
            tipo="textarea"
            valor={notaTexto}
            onChange={(v) => {
              setNotaTexto(v);
              if (v.trim()) setErrorAccion('');
            }}
            obligatorio
          />
          {errorAccion && (
            <p className="error error--caja" role="alert">
              {errorAccion}
            </p>
          )}
          {guardando && <p className="aviso">Guardando…</p>}
        </Modal>
      )}

      {contacto && (
        <Modal
          titulo="Contacto del cliente avisado"
          mensaje={`${contacto.nombre} ${contacto.apellido} — Tel. ${contacto.telefono || 'sin teléfono'} — ${contacto.email || 'sin email registrado'}`}
          textoConfirmar="Entendido"
          tipo="normal"
          onConfirmar={() => setContacto(null)}
          onCancelar={() => setContacto(null)}
        />
      )}

      {guardando && <p className="aviso">Guardando…</p>}
    </section>
  );
}

// Tarjeta de turno de la agenda: cliente, mascota, servicio, canal, estado
// y solo las acciones válidas para su estado (mapa de la sección 5).
// FE-10: en turnos atendidos, "Registrar atención" solo si aún no tiene una
// (atencion === null) y "Ver notas" si ya existe (atencion con datos).
function TarjetaTurno({
  turno,
  mostrarHora = false,
  onEstado,
  onReprogramar,
  onUrgencia,
  atencion,
  onRegistrarAtencion,
  onVerNotas,
}) {
  const destinos = TRANSICIONES[turno.estado] || [];
  const accionable = ['pendiente', 'confirmado'].includes(turno.estado);
  // undefined = el historial todavía no se cargó: no se ofrece ninguna acción.
  const sinAtencion = turno.estado === 'atendido' && atencion === null;
  const conAtencion = turno.estado === 'atendido' && Boolean(atencion);
  return (
    <div className="tarjeta agenda__turno">
      <div className="tarjeta__cabecera">
        <h3>
          {mostrarHora
            ? `${horaDe(turno)} hs`
            : `${turno.clienteNombre} ${turno.clienteApellido}`}
        </h3>
        <EstadoBadge estado={turno.estado} />
      </div>
      {mostrarHora && (
        <p className="tarjeta__detalle">
          <strong>
            {turno.clienteNombre} {turno.clienteApellido}
          </strong>
        </p>
      )}
      <p className="tarjeta__detalle">
        {turno.mascotaNombre} · {turno.servicioNombre} · {CANALES[turno.canal] || turno.canal}
      </p>
      {turno.esUrgencia ? (
        <p className="tarjeta__detalle agenda__urgencia">
          Urgencia{turno.motivo ? `: ${turno.motivo}` : ''}
        </p>
      ) : null}
      {accionable && (
        <div className="tarjeta__acciones">
          {destinos.map((destino) => (
            <button
              key={destino}
              type="button"
              className={ACCIONES[destino].clase}
              onClick={() => onEstado(turno, destino)}
            >
              {ACCIONES[destino].texto}
            </button>
          ))}
          <button
            type="button"
            className="boton boton--secundario"
            onClick={() => onReprogramar(turno)}
          >
            Reprogramar
          </button>
          <button
            type="button"
            className="boton boton--urgencia"
            onClick={() => onUrgencia(turno)}
          >
            Urgencia
          </button>
        </div>
      )}
      {sinAtencion && (
        <div className="tarjeta__acciones">
          <button type="button" className="boton" onClick={() => onRegistrarAtencion(turno)}>
            Registrar atención
          </button>
        </div>
      )}
      {conAtencion && (
        <div className="tarjeta__acciones">
          <button type="button" className="boton boton--secundario" onClick={() => onVerNotas(turno, atencion)}>
            {atencion.notas.length > 0
              ? `Ver atención y notas (${atencion.notas.length})`
              : 'Ver atención'}
          </button>
        </div>
      )}
    </div>
  );
}
