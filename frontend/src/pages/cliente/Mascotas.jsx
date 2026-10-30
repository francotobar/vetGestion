import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { listar } from '../../api/mascotas.js';
import { mensajeDeError } from '../../api/cliente.js';

// "Mis mascotas" (/mascotas): lista las mascotas propias activas.
// Incluye estado vacío y manejo de error de la API.
export default function Mascotas() {
  const [mascotas, setMascotas] = useState(null); // null = cargando
  const [errorApi, setErrorApi] = useState('');

  useEffect(() => {
    let activo = true;
    listar()
      .then(({ data }) => {
        // Acepta que el backend devuelva el arreglo directo o { mascotas: [...] }.
        if (activo) setMascotas(Array.isArray(data) ? data : data.mascotas || []);
      })
      .catch((error) => {
        if (activo) {
          setMascotas([]);
          setErrorApi(mensajeDeError(error, 'No se pudieron cargar tus mascotas. Intentá nuevamente.'));
        }
      });
    return () => {
      activo = false;
    };
  }, []);

  return (
    <section className="pagina">
      <div className="pagina__cabecera">
        <h1>Mis mascotas</h1>
        <Link to="/mascotas/nueva" className="boton">
          Registrar mascota
        </Link>
      </div>

      {errorApi && (
        <p className="error error--caja" role="alert">
          {errorApi}
        </p>
      )}

      {mascotas === null && !errorApi && <p className="aviso">Cargando mascotas…</p>}

      {mascotas !== null && mascotas.length === 0 && !errorApi && (
        <div className="estado-vacio">
          <p>Todavía no registraste mascotas.</p>
          <p className="aviso">Registrá tu mascota para poder solicitarle turnos.</p>
          <Link to="/mascotas/nueva" className="boton">
            Registrar mi primera mascota
          </Link>
        </div>
      )}

      {mascotas !== null && mascotas.length > 0 && (
        <ul className="tarjetas">
          {mascotas.map((mascota) => (
            <li key={mascota.id} className="tarjeta">
              <h2>
                <Link to={`/mascotas/${mascota.id}`}>{mascota.nombre}</Link>
              </h2>
              <p className="tarjeta__detalle">
                {capitalizar(mascota.especie)} · {mascota.raza} · {capitalizar(mascota.sexo)}
              </p>
              <p className="tarjeta__detalle aviso">
                {mascota.fechaNacimiento
                  ? `Nació el ${dayjs(mascota.fechaNacimiento).format('DD/MM/YYYY')}`
                  : 'Sin fecha de nacimiento'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function capitalizar(texto) {
  return texto ? texto[0].toUpperCase() + texto.slice(1) : '';
}
