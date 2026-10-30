import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import Campo from './Campo.jsx';
import { mensajeDeError } from '../api/cliente.js';
import { listar as listarFeriados } from '../api/feriados.js';
import { disponibilidad } from '../api/turnos.js';

// Mismo límite que el backend (DIAS_MAX_RESERVA, por defecto 60 días):
// el input de fecha no ofrece días fuera del rango.
const DIAS_MAX_RESERVA = 60;

// Devuelve el motivo por el que una fecha no sirve (sábado, domingo,
// feriado o rango inválido) o '' si se puede elegir.
function motivoDeRechazo(valor, feriados) {
  const dia = dayjs(valor);
  if (!dia.isValid()) return 'Elegí una fecha válida.';
  if (dia.day() === 0 || dia.day() === 6) {
    return 'La veterinaria no atiende sábados ni domingos. Elegí un día de semana.';
  }
  const feriado = feriados.find((f) => f.fecha === valor);
  if (feriado) {
    return `El ${dia.format('DD/MM/YYYY')} es feriado${
      feriado.motivo ? ` (${feriado.motivo})` : ''
    }. Elegí otro día.`;
  }
  return '';
}

// Selector reutilizable de fecha + franja (FE-04; lo reutilizan FE-05,
// FE-06 y FE-07):
// * la fecha rechaza sábados, domingos y feriados (GET /feriados) y acota
//   el rango a hoy … hoy + 60 días (mismo límite que el backend);
// * con una fecha elegida carga GET /turnos/disponibilidad?fecha= y muestra
//   las franjas libres como botones.
//
// Props:
//   fecha    'YYYY-MM-DD' (o '')
//   hora     'HH:MM' (o '')
//   onCambio({ fecha, hora })  el padre guarda la selección
//   recarga  número; al incrementarse desde el padre se vuelven a pedir las
//            franjas (así el 409 de la reserva en FE-04 refresca la lista)
export default function SelectorFranja({ fecha, hora, onCambio, recarga = 0 }) {
  // null = cargando el calendario de feriados; después, arreglo de {fecha, motivo}.
  const [feriados, setFeriados] = useState(null);
  const [franjas, setFranjas] = useState([]);
  const [cargandoFranjas, setCargandoFranjas] = useState(false);
  const [errorFecha, setErrorFecha] = useState('');
  const [errorApi, setErrorApi] = useState('');
  // Contador interno para reintentar la carga de franjas sin cambiar la fecha.
  const [intento, setIntento] = useState(0);

  // Feriados una sola vez por montaje. Si la llamada falla no se bloquea la
  // reserva: el backend igual devuelve [] para un feriado (BE-07).
  useEffect(() => {
    let vivo = true;
    listarFeriados()
      .then(({ data }) => vivo && setFeriados(data))
      .catch(() => vivo && setFeriados([]));
    return () => {
      vivo = false;
    };
  }, []);

  // Franjas libres del día elegido (se recargan al cambiar la fecha o al
  // incrementar `recarga` desde el padre).
  useEffect(() => {
    if (!fecha) {
      setFranjas([]);
      return undefined;
    }
    let vivo = true;
    setCargandoFranjas(true);
    setErrorApi('');
    disponibilidad(fecha)
      .then(({ data }) => vivo && setFranjas(data))
      .catch((error) =>
        vivo && setErrorApi(mensajeDeError(error, 'No pudimos cargar los horarios disponibles.'))
      )
      .finally(() => vivo && setCargandoFranjas(false));
    return () => {
      vivo = false;
    };
  }, [fecha, recarga, intento]);

  function alCambiarFecha(valor) {
    const rechazo = motivoDeRechazo(valor, feriados || []);
    setErrorFecha(rechazo);
    if (rechazo) return;
    onCambio({ fecha: valor, hora: '' });
  }

  const hoy = dayjs().format('YYYY-MM-DD');
  const maximo = dayjs().add(DIAS_MAX_RESERVA, 'day').format('YYYY-MM-DD');

  return (
    <div className="selector-franja">
      <Campo
        id="fecha"
        tipo="date"
        etiqueta="Fecha"
        valor={fecha}
        onChange={alCambiarFecha}
        min={hoy}
        max={maximo}
        disabled={feriados === null}
        error={errorFecha}
        ayuda="De lunes a viernes, hasta 60 días adelante."
        obligatorio
      />

      {fecha && (
        <div className="selector-franja__franjas">
          <p>
            <strong>Horarios del {dayjs(fecha).format('DD/MM/YYYY')}</strong>
          </p>
          {cargandoFranjas && <p className="aviso">Cargando horarios…</p>}
          {!cargandoFranjas && errorApi && (
            <p className="error error--caja" role="alert">
              {errorApi}{' '}
              <button type="button" className="boton boton--secundario" onClick={() => setIntento((n) => n + 1)}>
                Reintentar
              </button>
            </p>
          )}
          {!cargandoFranjas && !errorApi && franjas.length === 0 && (
            <p className="aviso">No quedan horarios libres ese día. Probá con otra fecha.</p>
          )}
          {!cargandoFranjas && !errorApi && franjas.length > 0 && (
            <div className="franjas" role="group" aria-label="Horarios disponibles">
              {franjas.map((h) => (
                <button
                  type="button"
                  key={h}
                  className={`franja${h === hora ? ' franja--activa' : ''}`}
                  aria-pressed={h === hora}
                  onClick={() => onCambio({ fecha, hora: h })}
                >
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
