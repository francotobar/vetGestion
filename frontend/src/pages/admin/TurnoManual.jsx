import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { buscar as buscarClientes, mascotasDelCliente } from '../../api/adminClientes.js';
import { crear as crearTurno } from '../../api/adminTurnos.js';
import { listar as listarServicios } from '../../api/servicios.js';
import { mensajeDeError } from '../../api/cliente.js';
import Campo from '../../components/Campo.jsx';
import SelectorFranja from '../../components/SelectorFranja.jsx';

// Turno manual del administrador (FE-07, RF21), ruta /admin/turnos/nuevo.
// Asistente de 5 pasos: Cliente (búsqueda por documento/nombre, BE-12) →
// Mascota (las del cliente, GET /admin/clientes/:id/mascotas) → Servicio →
// Fecha y franja (SelectorFranja, reutilizado de FE-04) → Confirmar con el
// canal (telefonico o presencial; el backend crea el turno 'confirmado').
// Si la búsqueda no encuentra al cliente se ofrece "Crear cliente" (FE-08).
const PASOS = ['Cliente', 'Mascota', 'Servicio', 'Fecha y franja', 'Confirmar'];

// canales del contrato (crearTurnoAdminSchema, sección 6).
const CANALES = [
  { valor: 'telefonico', etiqueta: 'Telefónico' },
  { valor: 'presencial', etiqueta: 'Presencial' },
];

function mayuscula(texto) {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : '';
}

// Rotulo de estado de cuenta para que el admin vea si el cliente puede
// ingresar al sistema (con_cuenta / sin_cuenta / inactiva, BE-12).
function etiquetaCuenta(cliente) {
  if (cliente.estadoCuenta === 'inactiva') return 'Cuenta inactiva';
  if (cliente.estadoCuenta === 'sin_cuenta') return 'Sin cuenta';
  return 'Con cuenta';
}

export default function TurnoManual() {
  const [paso, setPaso] = useState(1);

  // Paso 1: búsqueda de clientes (null = todavía no se buscó).
  const [termino, setTermino] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState(null);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [cliente, setCliente] = useState(null);

  // Paso 2: mascotas del cliente elegido.
  const [mascotas, setMascotas] = useState([]);
  const [cargandoMascotas, setCargandoMascotas] = useState(false);
  const [errorMascotas, setErrorMascotas] = useState('');

  // Pasos 3 a 5.
  const [servicios, setServicios] = useState(null); // null = cargando
  const [errorServicios, setErrorServicios] = useState('');
  const [mascota, setMascota] = useState(null);
  const [servicio, setServicio] = useState(null);
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  // Se incrementa para que SelectorFranja vuelva a pedir las franjas (409/422).
  const [recargaFranjas, setRecargaFranjas] = useState(0);
  const [canal, setCanal] = useState('telefonico');

  const [enviando, setEnviando] = useState(false);
  const [errorCreacion, setErrorCreacion] = useState('');
  const [turnoCreado, setTurnoCreado] = useState(null);

  // Servicios activos una sola vez por montaje (los pide cualquier paso).
  useEffect(() => {
    let vivo = true;
    listarServicios()
      .then(({ data }) => vivo && setServicios(data))
      .catch((error) =>
        vivo && setErrorServicios(mensajeDeError(error, 'No pudimos cargar los servicios. Recargá la página.'))
      );
    return () => {
      vivo = false;
    };
  }, []);

  async function buscar(e) {
    e.preventDefault();
    setBuscando(true);
    setErrorBusqueda('');
    try {
      // Con término vacío el backend devuelve todos los clientes.
      const { data } = await buscarClientes(termino.trim());
      setResultados(data);
    } catch (error) {
      setResultados(null);
      setErrorBusqueda(mensajeDeError(error, 'No pudimos buscar clientes. Intentá nuevamente.'));
    } finally {
      setBuscando(false);
    }
  }

  // Seleccionar un cliente carga sus mascotas activas (BE-12) y avanza.
  async function seleccionarCliente(c) {
    setCliente(c);
    setMascota(null); // la anterior pertenecía al cliente viejo
    setMascotas([]);
    setErrorMascotas('');
    setPaso(2);
    setCargandoMascotas(true);
    try {
      const { data } = await mascotasDelCliente(c.id);
      setMascotas(data);
    } catch (error) {
      setErrorMascotas(mensajeDeError(error, 'No pudimos cargar las mascotas del cliente.'));
    } finally {
      setCargandoMascotas(false);
    }
  }

  async function confirmar() {
    setEnviando(true);
    setErrorCreacion('');
    try {
      const { data } = await crearTurno({
        usuarioId: cliente.id,
        mascotaId: mascota.id,
        servicioId: servicio.id,
        fecha,
        hora,
        canal,
      });
      setTurnoCreado(data);
    } catch (error) {
      const status = error.response?.status;
      if (status === 409) {
        // La franja acaba de tomarse: avisar y recargar las disponibles.
        setErrorCreacion(mensajeDeError(error, 'Esa franja ya fue reservada, elegí otra'));
        setHora('');
        setPaso(4);
        setRecargaFranjas((n) => n + 1);
      } else if (status === 422) {
        // FRANJA_INVALIDA (fin de semana, feriado, fuera del horario o plazo).
        setErrorCreacion(mensajeDeError(error, 'Esa franja no es válida. Elegí otra fecha u horario.'));
        setHora('');
        setPaso(4);
        setRecargaFranjas((n) => n + 1);
      } else if (status === 404) {
        // Cliente, mascota o servicio ya no existe: el mensaje real lo dice
        // cuál; se queda en el resumen para que el admin vuelva al paso que
        // corresponda (los pasos anteriores siguen clickeables).
        setErrorCreacion(mensajeDeError(error, 'El cliente, la mascota o el servicio ya no existe.'));
      } else if (!error.response) {
        setErrorCreacion('No se pudo conectar con el servidor. Intentá nuevamente.');
      } else {
        setErrorCreacion(mensajeDeError(error, 'No se pudo cargar el turno. Intentá nuevamente.'));
      }
    } finally {
      setEnviando(false);
    }
  }

  // "Cargar otro turno" desde la pantalla de éxito: vuelve al paso 1 y
  // limpia todo lo elegido (servicios se quedan cargados).
  function reiniciar() {
    setPaso(1);
    setTermino('');
    setResultados(null);
    setCliente(null);
    setMascotas([]);
    setMascota(null);
    setServicio(null);
    setFecha('');
    setHora('');
    setCanal('telefonico');
    setErrorCreacion('');
    setTurnoCreado(null);
  }

  // Pantalla de éxito: el turno manual nace 'confirmado' (RF21, BE-10).
  if (turnoCreado) {
    return (
      <section className="pagina">
        <div className="pagina__cabecera">
          <h1>Turno cargado</h1>
        </div>
        <div className="formulario formulario--ancho">
          <p className="aviso--ok" role="status">
            Listo, el turno quedó registrado y <strong>confirmado</strong>. Ya aparece en la agenda.
          </p>
          <dl className="ficha">
            <div>
              <dt>Cliente</dt>
              <dd>
                {turnoCreado.clienteNombre} {turnoCreado.clienteApellido}
              </dd>
            </div>
            <div>
              <dt>Mascota</dt>
              <dd>{turnoCreado.mascotaNombre}</dd>
            </div>
            <div>
              <dt>Servicio</dt>
              <dd>{turnoCreado.servicioNombre}</dd>
            </div>
            <div>
              <dt>Fecha y hora</dt>
              <dd>{dayjs(turnoCreado.fechaHora).format('DD/MM/YYYY [de] HH:mm[h]')}</dd>
            </div>
            <div>
              <dt>Canal</dt>
              <dd>{CANALES.find((c) => c.valor === turnoCreado.canal)?.etiqueta || turnoCreado.canal}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{mayuscula(turnoCreado.estado)}</dd>
            </div>
          </dl>
          <div className="pagina__acciones">
            <button type="button" className="boton" onClick={reiniciar}>
              Cargar otro turno
            </button>
            <Link to="/admin/agenda" className="boton boton--secundario">
              Ver agenda
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="pagina">
      <div className="pagina__cabecera">
        <h1>Turno manual</h1>
        <Link to="/admin/agenda" className="boton boton--secundario">
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

      {paso === 1 && (
        <div className="formulario formulario--ancho">
          <form onSubmit={buscar}>
            <Campo
              id="buscarCliente"
              etiqueta="Buscar cliente"
              valor={termino}
              onChange={setTermino}
              ayuda="Por nombre, documento o email. Dejalo vacío para ver todos."
              placeholder="Ej.: 30111222 o María Pérez"
            />
            <div className="pagina__acciones">
              <button type="submit" className="boton" disabled={buscando}>
                {buscando ? 'Buscando…' : 'Buscar'}
              </button>
            </div>
          </form>

          {errorBusqueda && (
            <p className="error error--caja" role="alert">
              {errorBusqueda}
            </p>
          )}

          {resultados !== null && resultados.length === 0 && (
            <div className="estado-vacio">
              <p>No encontramos ningún cliente con esa búsqueda.</p>
              {/* La alta de clientes se completa en FE-08 (/admin/clientes/nuevo). */}
              <Link to="/admin/clientes/nuevo" className="boton">
                Crear cliente
              </Link>
            </div>
          )}

          {resultados !== null && resultados.length > 0 && (
            <ul className="tarjetas">
              {resultados.map((c) => (
                <li key={c.id}>
                  <button type="button" className="tarjeta elegible" onClick={() => seleccionarCliente(c)}>
                    <h2>
                      {c.nombre} {c.apellido}
                    </h2>
                    <p className="tarjeta__detalle">
                      Doc. {c.documento} · {etiquetaCuenta(c)}
                      {c.bloqueado ? ' · Bloqueado' : ''}
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
          <p className="aviso">
            Cliente: <strong>{cliente?.nombre} {cliente?.apellido}</strong> (doc. {cliente?.documento})
          </p>
          {cargandoMascotas && <p className="aviso">Cargando mascotas del cliente…</p>}
          {errorMascotas && (
            <p className="error error--caja" role="alert">
              {errorMascotas}
            </p>
          )}
          {!cargandoMascotas && !errorMascotas && mascotas.length === 0 && (
            <div className="estado-vacio">
              <p>Este cliente no tiene mascotas registradas.</p>
              {/* La ficha del cliente (mascotas incluidas) se completa en FE-08. */}
              <Link to={`/admin/clientes/${cliente?.id}`} className="boton">
                Ver ficha del cliente
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
                      setPaso(3);
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
          <div className="pagina__acciones">
            <button type="button" className="boton boton--secundario" onClick={() => setPaso(1)}>
              Atrás
            </button>
          </div>
        </div>
      )}

      {paso === 3 && (
        <div>
          {errorServicios && (
            <p className="error error--caja" role="alert">
              {errorServicios}
            </p>
          )}
          {servicios === null && !errorServicios && <p className="aviso">Cargando servicios…</p>}
          {servicios !== null && servicios.length === 0 && (
            <div className="estado-vacio">
              <p>No hay servicios activos. Cargá uno desde la configuración.</p>
            </div>
          )}
          {servicios !== null && servicios.length > 0 && (
            <ul className="tarjetas">
              {servicios.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`tarjeta elegible${servicio?.id === s.id ? ' elegible--activa' : ''}`}
                    onClick={() => {
                      setServicio(s);
                      setPaso(4);
                    }}
                  >
                    <h2>{s.nombre}</h2>
                    {s.descripcion && <p className="tarjeta__detalle">{s.descripcion}</p>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="pagina__acciones">
            <button type="button" className="boton boton--secundario" onClick={() => setPaso(2)}>
              Atrás
            </button>
          </div>
        </div>
      )}

      {paso === 4 && (
        <div className="formulario formulario--ancho">
          <SelectorFranja
            fecha={fecha}
            hora={hora}
            recarga={recargaFranjas}
            onCambio={({ fecha: nuevaFecha, hora: nuevaHora }) => {
              setFecha(nuevaFecha);
              setHora(nuevaHora);
              if (nuevaHora) setErrorCreacion('');
            }}
          />
          {errorCreacion && (
            <p className="error error--caja" role="alert">
              {errorCreacion}
            </p>
          )}
          <div className="pagina__acciones">
            <button type="button" className="boton boton--secundario" onClick={() => setPaso(3)}>
              Atrás
            </button>
            <button
              type="button"
              className="boton"
              disabled={!fecha || !hora}
              onClick={() => setPaso(5)}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {paso === 5 && (
        <div className="formulario formulario--ancho">
          <dl className="ficha">
            <div>
              <dt>Cliente</dt>
              <dd>
                {cliente?.nombre} {cliente?.apellido} (doc. {cliente?.documento})
              </dd>
            </div>
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
              <dd>{dayjs(`${fecha} ${hora}`).format('DD/MM/YYYY [de] HH:mm[h]')}</dd>
            </div>
          </dl>
          <Campo
            id="canal"
            tipo="select"
            etiqueta="Canal"
            valor={canal}
            onChange={(v) => {
              setCanal(v);
              setErrorCreacion('');
            }}
            opciones={CANALES}
            ayuda="Cómo llegó el turno: por teléfono o presencialmente en el mostrador."
          />
          {errorCreacion && (
            <p className="error error--caja" role="alert">
              {errorCreacion}
            </p>
          )}
          <div className="pagina__acciones">
            <button
              type="button"
              className="boton boton--secundario"
              onClick={() => setPaso(4)}
              disabled={enviando}
            >
              Atrás
            </button>
            <button type="button" className="boton" onClick={confirmar} disabled={enviando}>
              {enviando ? 'Cargando…' : 'Confirmar turno'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
