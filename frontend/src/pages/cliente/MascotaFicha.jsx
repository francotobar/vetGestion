import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { actualizar, darDeBaja, listar } from '../../api/mascotas.js';
import { historialCliente } from '../../api/atenciones.js';
import { mensajeDeError } from '../../api/cliente.js';
import DetalleAtencion from '../../components/DetalleAtencion.jsx';
import FormMascota from '../../components/FormMascota.jsx';
import Modal from '../../components/Modal.jsx';

// Ficha de la mascota (/mascotas/:id): datos completos (RF06), edición
// y baja lógica con confirmación. La mascota se busca dentro de
// GET /mascotas (no hay GET /mascotas/:id en el contrato de la sección 6).
// FE-10: debajo se muestra el historial clínico (GET /mascotas/:id/historial),
// de solo lectura, en orden cronológico inverso con las notas aclaratorias.
export default function MascotaFicha() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [mascota, setMascota] = useState(null); // null = cargando
  const [errorApi, setErrorApi] = useState('');
  const [editando, setEditando] = useState(false);
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);
  const [bajando, setBajando] = useState(false);
  // Historial clínico: null = cargando, [] = sin atenciones, 'error' = fallo.
  const [historial, setHistorial] = useState(null);

  // El historial se pide recién cuando la mascota aparece en la lista: si no
  // está (mascota ajena o dada de baja) el endpoint respondería 404 y la
  // ficha ya muestra su propio mensaje de "no encontramos esa mascota".
  const mascotaOk = Boolean(mascota) && mascota !== 'no-encontrada';
  useEffect(() => {
    if (!mascotaOk) return undefined;
    let vivo = true;
    historialCliente(id)
      .then(({ data }) => vivo && setHistorial(data))
      .catch((error) => {
        if (!vivo) return;
        setHistorial('error');
        setErrorApi(mensajeDeError(error, 'No se pudo cargar el historial clínico.'));
      });
    return () => {
      vivo = false;
    };
    // mascotaOk (y no el objeto mascota) para no repetir el pedido al editar.
  }, [id, mascotaOk]);

  const cargar = useCallback(() => {
    listar()
      .then(({ data }) => {
        const lista = Array.isArray(data) ? data : data.mascotas || [];
        // Una mascota ajena o dada de baja no aparece en la lista → 404.
        setMascota(lista.find((m) => String(m.id) === String(id)) || 'no-encontrada');
      })
      .catch((error) => {
        setErrorApi(mensajeDeError(error, 'No se pudo cargar la mascota. Intentá nuevamente.'));
        setMascota('no-encontrada');
      });
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar(datos) {
    setErrorApi('');
    try {
      await actualizar(id, datos);
      setEditando(false);
      cargar();
    } catch (error) {
      const status = error.response?.status;
      if (status === 400) {
        setErrorApi(mensajeDeError(error, 'Revisá los datos ingresados.'));
      } else if (status === 404) {
        setErrorApi('No encontramos esa mascota.');
        setEditando(false);
      } else if (!error.response) {
        setErrorApi('No se pudo conectar con el servidor. Intentá nuevamente.');
      } else {
        setErrorApi(mensajeDeError(error, 'No se pudieron guardar los cambios. Intentá nuevamente.'));
      }
    }
  }

  async function confirmarBaja() {
    setConfirmandoBaja(false);
    setBajando(true);
    setErrorApi('');
    try {
      await darDeBaja(id);
      navigate('/mascotas');
    } catch (error) {
      setBajando(false);
      if (error.response?.status === 404) {
        setErrorApi('No encontramos esa mascota.');
      } else if (!error.response) {
        setErrorApi('No se pudo conectar con el servidor. Intentá nuevamente.');
      } else {
        setErrorApi(mensajeDeError(error, 'No se pudo dar de baja la mascota. Intentá nuevamente.'));
      }
    }
  }

  if (mascota === null) return <p className="aviso">Cargando mascota…</p>;

  if (mascota === 'no-encontrada') {
    return (
      <section className="pagina">
        <h1>Mascota</h1>
        {errorApi && (
          <p className="error error--caja" role="alert">
            {errorApi}
          </p>
        )}
        {!errorApi && <p>No encontramos esa mascota.</p>}
        <p>
          <Link to="/mascotas">Volver a mis mascotas</Link>
        </p>
      </section>
    );
  }

  if (editando) {
    return (
      <section className="pagina">
        <div className="pagina__cabecera">
          <h1>Editar a {mascota.nombre}</h1>
          <button type="button" className="boton boton--secundario" onClick={() => setEditando(false)}>
            Cancelar
          </button>
        </div>
        <div className="formulario formulario--ancho">
          <FormMascota
            inicial={{
              nombre: mascota.nombre || '',
              especie: mascota.especie || 'perro',
              raza: mascota.raza || '',
              sexo: mascota.sexo || 'macho',
              fechaNacimiento: mascota.fechaNacimiento
                ? dayjs(mascota.fechaNacimiento).format('YYYY-MM-DD')
                : '',
              pesoKg: mascota.pesoKg ?? '',
              esterilizado: Boolean(mascota.esterilizado),
              microchip: mascota.microchip || '',
              alergiasCondiciones: mascota.alergiasCondiciones || '',
            }}
            textoBoton="Guardar cambios"
            onGuardar={guardar}
          >
            {errorApi && (
              <p className="error error--caja" role="alert">
                {errorApi}
              </p>
            )}
          </FormMascota>
        </div>
      </section>
    );
  }

  return (
    <section className="pagina">
      <div className="pagina__cabecera">
        <h1>{mascota.nombre}</h1>
        <div className="pagina__acciones">
          <button type="button" className="boton" onClick={() => setEditando(true)} disabled={bajando}>
            Editar
          </button>
          <button
            type="button"
            className="boton boton--peligro"
            onClick={() => setConfirmandoBaja(true)}
            disabled={bajando}
          >
            {bajando ? 'Dando de baja…' : 'Dar de baja'}
          </button>
        </div>
      </div>

      {errorApi && (
        <p className="error error--caja" role="alert">
          {errorApi}
        </p>
      )}

      <dl className="ficha">
        <div>
          <dt>Especie</dt>
          <dd>{capitalizar(mascota.especie)}</dd>
        </div>
        <div>
          <dt>Raza</dt>
          <dd>{mascota.raza}</dd>
        </div>
        <div>
          <dt>Sexo</dt>
          <dd>{capitalizar(mascota.sexo)}</dd>
        </div>
        <div>
          <dt>Fecha de nacimiento</dt>
          <dd>
            {mascota.fechaNacimiento
              ? `${dayjs(mascota.fechaNacimiento).format('DD/MM/YYYY')} (${calcularEdad(mascota.fechaNacimiento)})`
              : 'Sin registrar'}
          </dd>
        </div>
        <div>
          <dt>Peso</dt>
          <dd>{mascota.pesoKg != null ? `${mascota.pesoKg} kg` : 'Sin registrar'}</dd>
        </div>
        <div>
          <dt>Esterilizado</dt>
          <dd>{mascota.esterilizado ? 'Sí' : 'No'}</dd>
        </div>
        <div>
          <dt>Microchip</dt>
          <dd>{mascota.microchip || 'Sin registrar'}</dd>
        </div>
        <div>
          <dt>Alergias o condiciones</dt>
          <dd>{mascota.alergiasCondiciones || 'Sin registrar'}</dd>
        </div>
      </dl>

      <h2>Historial clínico</h2>
      {historial === null && <p className="aviso">Cargando historial…</p>}
      {historial === 'error' && (
        <p className="error error--caja" role="alert">
          No se pudo cargar el historial clínico. Intentá nuevamente.
        </p>
      )}
      {Array.isArray(historial) && historial.length === 0 && (
        <div className="estado-vacio">
          <p>Sin atenciones</p>
        </div>
      )}
      {Array.isArray(historial) && historial.length > 0 && (
        // El backend devuelve las atenciones en orden cronológico inverso.
        <ul className="tarjetas">
          {historial.map((atencion) => (
            <li key={atencion.id}>
              <div className="tarjeta">
                <DetalleAtencion atencion={atencion} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirmandoBaja && (
        <Modal
          titulo={`¿Dar de baja a ${mascota.nombre}?`}
          mensaje="La mascota no aparecerá más en tu lista ni podrá tener turnos nuevos. Esta acción no se puede deshacer."
          textoConfirmar="Dar de baja"
          onConfirmar={confirmarBaja}
          onCancelar={() => setConfirmandoBaja(false)}
        />
      )}
    </section>
  );
}

function capitalizar(texto) {
  return texto ? texto[0].toUpperCase() + texto.slice(1) : '';
}

// Edad en años/meses calculada desde la fecha de nacimiento (RF06).
function calcularEdad(fecha) {
  const nac = dayjs(fecha);
  const hoy = dayjs();
  const meses = hoy.diff(nac, 'month');
  const anios = Math.floor(meses / 12);
  if (anios > 0) {
    const resto = meses % 12;
    return resto > 0 ? `${anios} ${anios === 1 ? 'año' : 'años'} y ${resto} ${resto === 1 ? 'mes' : 'meses'}` : `${anios} ${anios === 1 ? 'año' : 'años'}`;
  }
  return meses > 0 ? `${meses} ${meses === 1 ? 'mes' : 'meses'}` : 'Menos de un mes';
}
