import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { listar as listarMascotas } from '../../api/mascotas.js';
import { listar as listarServicios } from '../../api/servicios.js';
import { reservar } from '../../api/turnos.js';
import { mensajeDeError } from '../../api/cliente.js';
import SelectorFranja from '../../components/SelectorFranja.jsx';

// Asistente de reserva de turno (FE-04, RF09), ruta /turnos/nuevo.
// 4 pasos: Mascota → Servicio → Fecha y franja → Confirmar. La reserva se
// envía con POST /turnos; si responde 409 (alguien tomó la misma franja)
// se avisa y se recargan las franjas para elegir otra.
const PASOS = ['Mascota', 'Servicio', 'Fecha y franja', 'Confirmar'];

function mayuscula(texto) {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : '';
}

export default function ReservarTurno() {
  const [paso, setPaso] = useState(1);
  const [mascotas, setMascotas] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  const [mascota, setMascota] = useState(null);
  const [servicio, setServicio] = useState(null);
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  // Se incrementa para que SelectorFranja vuelva a pedir las franjas (409/422).
  const [recargaFranjas, setRecargaFranjas] = useState(0);

  const [enviando, setEnviando] = useState(false);
  const [errorReserva, setErrorReserva] = useState('');
  const [turnoReservado, setTurnoReservado] = useState(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([listarMascotas(), listarServicios()])
      .then(([m, s]) => {
        if (!vivo) return;
        setMascotas(m.data);
        setServicios(s.data);
      })
      .catch((error) => vivo && setErrorCarga(mensajeDeError(error, 'No pudimos cargar los datos. Recargá la página.')))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, []);

  async function confirmar() {
    setEnviando(true);
    setErrorReserva('');
    try {
      const { data } = await reservar({
        mascotaId: mascota.id,
        servicioId: servicio.id,
        fecha,
        hora,
      });
      setTurnoReservado(data);
    } catch (error) {
      const status = error.response?.status;
      if (status === 409) {
        // La franja acaba de ocuparse: avisar y recargar las disponibles.
        setErrorReserva(mensajeDeError(error, 'Esa franja acaba de ser reservada, elegí otra'));
        setHora('');
        setPaso(3);
        setRecargaFranjas((n) => n + 1);
      } else if (status === 422) {
        setErrorReserva(mensajeDeError(error, 'Esa franja ya no es válida. Elegí otra fecha u horario.'));
        setHora('');
        setPaso(3);
        setRecargaFranjas((n) => n + 1);
      } else if (status === 404) {
        setErrorReserva(mensajeDeError(error, 'La mascota o el servicio ya no existe. Elegí nuevamente.'));
        setPaso(1);
      } else if (!error.response) {
        setErrorReserva('No se pudo conectar con el servidor. Intentá nuevamente.');
      } else {
        setErrorReserva(mensajeDeError(error, 'No se pudo reservar el turno. Intentá nuevamente.'));
      }
    } finally {
      setEnviando(false);
    }
  }

  // Pantalla de éxito: el turno quedó 'pendiente' (RF09) y el admin lo confirma.
  if (turnoReservado) {
    return (
      <section className="pagina">
        <div className="pagina__cabecera">
          <h1>Turno reservado</h1>
        </div>
        <div className="formulario formulario--ancho">
          <p className="aviso--ok" role="status">
            Listo, reservaste el turno. Está <strong>pendiente</strong> de confirmación por la
            veterinaria.
          </p>
          <dl className="ficha">
            <div>
              <dt>Mascota</dt>
              <dd>{turnoReservado.mascotaNombre}</dd>
            </div>
            <div>
              <dt>Servicio</dt>
              <dd>{turnoReservado.servicioNombre}</dd>
            </div>
            <div>
              <dt>Fecha y hora</dt>
              <dd>
                {dayjs(turnoReservado.fechaHora).format('DD/MM/YYYY [de] HH:mm[h]')}
              </dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{mayuscula(turnoReservado.estado)}</dd>
            </div>
          </dl>
          <div className="pagina__acciones">
            <Link to="/turnos" className="boton">
              Ver mis turnos
            </Link>
            <Link to="/" className="boton boton--secundario">
              Volver al inicio
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="pagina">
      <div className="pagina__cabecera">
        <h1>Reservar turno</h1>
        <Link to="/turnos" className="boton boton--secundario">
          Volver
        </Link>
      </div>

      <ol className="pasos">
        {PASOS.map((nombre, i) => {
          const n = i + 1;
          return (
            <li key={nombre} className={n === paso ? 'paso--actual' : undefined}>
              {n < paso ? (
                <button type="button" onClick={() => setPaso(n)}>
                  {n}. {nombre} ✓
                </button>
              ) : (
                <span>
                  {n}. {nombre}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {errorCarga && (
        <p className="error error--caja" role="alert">
          {errorCarga}
        </p>
      )}

      {paso === 1 && (
        <div>
          {cargando && <p className="aviso">Cargando tus mascotas…</p>}
          {!cargando && mascotas.length === 0 && (
            <div className="estado-vacio">
              <p>Para reservar un turno primero necesitás registrar una mascota.</p>
              <Link to="/mascotas/nueva" className="boton">
                Registrar mascota
              </Link>
            </div>
          )}
          {mascotas.length > 0 && (
            <ul className="tarjetas">
              {mascotas.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className={`tarjeta elegible${mascota?.id === m.id ? ' elegible--activa' : ''}`}
                    onClick={() => {
                      setMascota(m);
                      setPaso(2);
                    }}
                  >
                    <h2>{m.nombre}</h2>
                    <p className="tarjeta__detalle">
                      {mayuscula(m.especie)}
                      {m.raza ? ` · ${m.raza}` : ''}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {paso === 2 && (
        <div>
          {cargando && <p className="aviso">Cargando servicios…</p>}
          <ul className="tarjetas">
            {servicios.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`tarjeta elegible${servicio?.id === s.id ? ' elegible--activa' : ''}`}
                  onClick={() => {
                    setServicio(s);
                    setPaso(3);
                  }}
                >
                  <h2>{s.nombre}</h2>
                  {s.descripcion && <p className="tarjeta__detalle">{s.descripcion}</p>}
                </button>
              </li>
            ))}
          </ul>
          <div className="pagina__acciones">
            <button type="button" className="boton boton--secundario" onClick={() => setPaso(1)}>
              Atrás
            </button>
          </div>
        </div>
      )}

      {paso === 3 && (
        <div className="formulario formulario--ancho">
          <SelectorFranja
            fecha={fecha}
            hora={hora}
            recarga={recargaFranjas}
            onCambio={({ fecha: nuevaFecha, hora: nuevaHora }) => {
              setFecha(nuevaFecha);
              setHora(nuevaHora);
              if (nuevaHora) setErrorReserva('');
            }}
          />
          {errorReserva && (
            <p className="error error--caja" role="alert">
              {errorReserva}
            </p>
          )}
          <div className="pagina__acciones">
            <button type="button" className="boton boton--secundario" onClick={() => setPaso(1)}>
              Atrás
            </button>
            <button
              type="button"
              className="boton"
              disabled={!fecha || !hora}
              onClick={() => setPaso(4)}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {paso === 4 && (
        <div className="formulario formulario--ancho">
          <dl className="ficha">
            <div>
              <dt>Mascota</dt>
              <dd>{mascota?.nombre}</dd>
            </div>
            <div>
              <dt>Servicio</dt>
              <dd>{servicio?.nombre}</dd>
            </div>
            <div>
              <dt>Fecha y hora</dt>
              <dd>
                {dayjs(`${fecha} ${hora}`).format('DD/MM/YYYY [de] HH:mm[h]')}
              </dd>
            </div>
          </dl>
          {errorReserva && (
            <p className="error error--caja" role="alert">
              {errorReserva}
            </p>
          )}
          <div className="pagina__acciones">
            <button
              type="button"
              className="boton boton--secundario"
              onClick={() => setPaso(3)}
              disabled={enviando}
            >
              Atrás
            </button>
            <button type="button" className="boton" onClick={confirmar} disabled={enviando}>
              {enviando ? 'Reservando…' : 'Confirmar reserva'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
