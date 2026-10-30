import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { desbloquear, mascotasDelCliente, obtener } from '../../api/adminClientes.js';
import { agenda } from '../../api/adminTurnos.js';
import { mensajeDeError } from '../../api/cliente.js';
import Campo from '../../components/Campo.jsx';
import EstadoBadge from '../../components/EstadoBadge.jsx';
import Modal from '../../components/Modal.jsx';

// Ficha del cliente del administrador (FE-08), ruta /admin/clientes/:id.
// Muestra los datos del cliente, sus mascotas activas (BE-12), sus turnos y,
// si está bloqueado, el botón Desbloquear (BE-13): limpia los intentos
// fallidos y permite fijar una contraseña temporal opcional (misma regla que
// el backend: >= 6 caracteres y >= 2 números).
//
// Los turnos se piden con GET /admin/turnos (desde/hasta) porque no existe
// un endpoint por cliente: se filtra por usuario_id en la pantalla. El rango
// cubre 90 días hacia atrás y hoy + 60 (DIAS_MAX_RESERVA: no puede existir
// ningún turno futuro más allá de ese plazo).
const DIAS_ATRAS = 90;
const DIAS_MAX_RESERVA = 60;
// Regla de contraseña del backend (modules/auth/schema.js).
const REGEX_PASSWORD = /^(?=(?:.*\d){2,}).{6,}$/;

const CANALES = { web: 'Web', telefonico: 'Telefónico', presencial: 'Presencial' };

function etiquetaCuenta(cliente) {
  if (cliente.estadoCuenta === 'inactiva') return 'Cuenta inactiva';
  if (cliente.estadoCuenta === 'sin_cuenta') return 'Sin cuenta';
  return 'Con cuenta';
}

function mayuscula(texto) {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : '';
}

function TarjetaTurno({ turno }) {
  return (
    <div className="tarjeta">
      <h2>{dayjs(turno.fechaHora).format('DD/MM/YYYY [de] HH:mm[h]')}</h2>
      <p className="tarjeta__detalle">
        {turno.mascotaNombre} · {turno.servicioNombre} · {CANALES[turno.canal] || turno.canal}
      </p>
      <p className="tarjeta__detalle">
        <EstadoBadge estado={turno.estado} />
      </p>
    </div>
  );
}

export default function ClienteFicha() {
  const { id } = useParams();
  const location = useLocation();
  // Aviso de éxito que puede pasar la alta (navigate con state).
  const [aviso, setAviso] = useState(location.state?.mensaje || '');

  const [cliente, setCliente] = useState(null); // null = cargando
  const [errorApi, setErrorApi] = useState('');
  const [mascotas, setMascotas] = useState(null);
  const [errorMascotas, setErrorMascotas] = useState('');
  const [turnos, setTurnos] = useState(null);
  const [errorTurnos, setErrorTurnos] = useState('');

  // Desbloqueo (solo si el cliente está bloqueado).
  const [modalAbierto, setModalAbierto] = useState(false);
  const [password, setPassword] = useState('');
  const [errorPassword, setErrorPassword] = useState('');
  const [errorDesbloqueo, setErrorDesbloqueo] = useState('');
  const [desbloqueando, setDesbloqueando] = useState(false);

  // Ficha del cliente; si falla (por ejemplo 404) se muestra la página de
  // error. Las mascotas y los turnos se cargan aparte para que un fallo en
  // ellos no deje afuera el resto de la ficha.
  useEffect(() => {
    let vivo = true;
    obtener(id)
      .then(({ data }) => vivo && setCliente(data))
      .catch((error) => {
        if (!vivo) return;
        setCliente(null);
        setErrorApi(mensajeDeError(error, 'No pudimos cargar la ficha del cliente.'));
      });
    return () => {
      vivo = false;
    };
  }, [id]);

  useEffect(() => {
    let vivo = true;
    mascotasDelCliente(id)
      .then(({ data }) => vivo && setMascotas(data))
      .catch((error) => {
        if (!vivo) return;
        setMascotas([]);
        setErrorMascotas(mensajeDeError(error, 'No pudimos cargar las mascotas del cliente.'));
      });
    return () => {
      vivo = false;
    };
  }, [id]);

  useEffect(() => {
    let vivo = true;
    agenda({
      desde: dayjs().subtract(DIAS_ATRAS, 'day').format('YYYY-MM-DD'),
      hasta: dayjs().add(DIAS_MAX_RESERVA, 'day').format('YYYY-MM-DD'),
    })
      .then(({ data }) => {
        if (!vivo) return;
        setTurnos(data.filter((turno) => turno.usuarioId === Number(id)));
      })
      .catch((error) => {
        if (!vivo) return;
        setTurnos([]);
        setErrorTurnos(mensajeDeError(error, 'No pudimos cargar los turnos del cliente.'));
      });
    return () => {
      vivo = false;
    };
  }, [id]);

  function abrirDesbloqueo() {
    setModalAbierto(true);
    setPassword('');
    setErrorPassword('');
    setErrorDesbloqueo('');
  }

  function cerrarDesbloqueo() {
    setModalAbierto(false);
    setErrorPassword('');
    setErrorDesbloqueo('');
  }

  async function confirmarDesbloqueo() {
    const passwordLimpia = password.trim();
    // Misma regla que el backend (auth/schema.js); vacío = no cambiarla.
    if (passwordLimpia && !REGEX_PASSWORD.test(passwordLimpia)) {
      setErrorPassword('La contraseña debe tener al menos 6 caracteres y 2 números.');
      return;
    }
    setDesbloqueando(true);
    setErrorDesbloqueo('');
    try {
      const { data } = await desbloquear(id, passwordLimpia || undefined);
      setCliente(data.cliente); // bloqueado=false, intentos=0, quizá con_cuenta
      setAviso(data.mensaje); // mensaje real del backend
      cerrarDesbloqueo();
    } catch (error) {
      const status = error.response?.status;
      if (status === 404) {
        cerrarDesbloqueo();
        setErrorApi('Ese cliente ya no existe.');
        setCliente(null);
      } else if (!error.response) {
        setErrorDesbloqueo('No se pudo conectar con el servidor. Intentá nuevamente.');
      } else {
        setErrorDesbloqueo(mensajeDeError(error, 'No se pudo desbloquear al cliente. Intentá nuevamente.'));
      }
    } finally {
      setDesbloqueando(false);
    }
  }

  if (errorApi && !cliente) {
    return (
      <section className="pagina">
        <div className="pagina__cabecera">
          <h1>Ficha del cliente</h1>
        </div>
        <p className="error error--caja" role="alert">
          {errorApi}
        </p>
        <div className="pagina__acciones">
          <Link to="/admin/clientes" className="boton boton--secundario">
            Volver a clientes
          </Link>
        </div>
      </section>
    );
  }

  if (!cliente) {
    return (
      <section className="pagina">
        <div className="pagina__cabecera">
          <h1>Ficha del cliente</h1>
        </div>
        <p className="aviso">Cargando ficha…</p>
      </section>
    );
  }

  const hoy = dayjs();
  const proximos = (turnos || []).filter((t) => dayjs(t.fechaHora).isAfter(hoy));
  const anteriores = (turnos || [])
    .filter((t) => !dayjs(t.fechaHora).isAfter(hoy))
    .sort((a, b) => (a.fechaHora < b.fechaHora ? 1 : -1));

  return (
    <section className="pagina">
      <div className="pagina__cabecera">
        <h1>
          {cliente.nombre} {cliente.apellido}
        </h1>
        <Link to="/admin/clientes" className="boton boton--secundario">
          Volver a clientes
        </Link>
      </div>

      {aviso && (
        <p className="aviso--ok" role="status">
          {aviso}
        </p>
      )}

      <dl className="ficha">
        <div>
          <dt>Documento</dt>
          <dd>{cliente.documento}</dd>
        </div>
        <div>
          <dt>Teléfono</dt>
          <dd>{cliente.telefono}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{cliente.email || 'Sin email registrado'}</dd>
        </div>
        <div>
          <dt>Estado de cuenta</dt>
          <dd>{etiquetaCuenta(cliente)}</dd>
        </div>
        <div>
          <dt>Bloqueado</dt>
          <dd>
            {cliente.bloqueado
              ? `Sí (${cliente.intentosFallidos} intentos fallidos)`
              : 'No'}
          </dd>
        </div>
      </dl>

      {cliente.bloqueado && (
        <div className="pagina__acciones">
          <button type="button" className="boton" onClick={abrirDesbloqueo}>
            Desbloquear
          </button>
        </div>
      )}

      <h2>Mascotas</h2>
      {mascotas === null && <p className="aviso">Cargando mascotas…</p>}
      {errorMascotas && (
        <p className="error error--caja" role="alert">
          {errorMascotas}
        </p>
      )}
      {mascotas !== null && !errorMascotas && mascotas.length === 0 && (
        <div className="estado-vacio">
          <p>Este cliente no tiene mascotas registradas.</p>
        </div>
      )}
      {mascotas !== null && mascotas.length > 0 && (
        <ul className="tarjetas">
          {mascotas.map((m) => (
            <li key={m.id}>
              <div className="tarjeta">
                <h2>{m.nombre}</h2>
                <p className="tarjeta__detalle">
                  {mayuscula(m.especie)}
                  {m.raza ? ` · ${m.raza}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2>Turnos</h2>
      {turnos === null && <p className="aviso">Cargando turnos…</p>}
      {errorTurnos && (
        <p className="error error--caja" role="alert">
          {errorTurnos}
        </p>
      )}
      {turnos !== null && !errorTurnos && turnos.length === 0 && (
        <div className="estado-vacio">
          <p>Este cliente no tiene turnos en los últimos 90 días ni reservados a futuro.</p>
        </div>
      )}
      {turnos !== null && turnos.length > 0 && (
        <>
          <h3>Próximos</h3>
          {proximos.length === 0 ? (
            <p className="aviso">Sin turnos próximos.</p>
          ) : (
            <ul className="tarjetas">
              {proximos.map((t) => (
                <li key={t.id}>
                  <TarjetaTurno turno={t} />
                </li>
              ))}
            </ul>
          )}
          <h3>Anteriores</h3>
          {anteriores.length === 0 ? (
            <p className="aviso">Sin turnos anteriores.</p>
          ) : (
            <ul className="tarjetas">
              {anteriores.map((t) => (
                <li key={t.id}>
                  <TarjetaTurno turno={t} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {modalAbierto && (
        <Modal
          titulo="Desbloquear cliente"
          mensaje="Se limpian los intentos fallidos y la cuenta vuelve a poder ingresar. Podés fijarle una contraseña temporal."
          textoConfirmar="Desbloquear"
          tipo="normal"
          onConfirmar={confirmarDesbloqueo}
          onCancelar={cerrarDesbloqueo}
        >
          <Campo
            id="passwordTemporal"
            etiqueta="Contraseña temporal (opcional)"
            tipo="password"
            valor={password}
            onChange={(v) => {
              setPassword(v);
              if (!v || REGEX_PASSWORD.test(v.trim())) setErrorPassword('');
            }}
            error={errorPassword}
            ayuda="Si la dejás vacía, el cliente conserva su contraseña actual. Debe tener al menos 6 caracteres y 2 números."
            autoComplete="new-password"
          />
          {errorDesbloqueo && (
            <p className="error error--caja" role="alert">
              {errorDesbloqueo}
            </p>
          )}
          {desbloqueando && <p className="aviso">Desbloqueando…</p>}
        </Modal>
      )}
    </section>
  );
}
