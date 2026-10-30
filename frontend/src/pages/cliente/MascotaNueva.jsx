import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { crear } from '../../api/mascotas.js';
import { mensajeDeError } from '../../api/cliente.js';
import FormMascota, { mascotaVacia } from '../../components/FormMascota.jsx';

// Registrar mascota (/mascotas/nueva): alta (RF06) vía POST /mascotas.
// Muestra los errores que devuelve la API (400 validación, 409 si el
// backend resuelve algún duplicado, etc.).
export default function MascotaNueva() {
  const navigate = useNavigate();
  const [errorApi, setErrorApi] = useState('');

  async function guardar(datos) {
    setErrorApi('');
    try {
      await crear(datos);
      navigate('/mascotas');
    } catch (error) {
      const status = error.response?.status;
      if (status === 400) {
        setErrorApi(mensajeDeError(error, 'Revisá los datos ingresados.'));
      } else if (status === 409) {
        setErrorApi(mensajeDeError(error, 'Ya existe una mascota con esos datos.'));
      } else if (!error.response) {
        setErrorApi('No se pudo conectar con el servidor. Intentá nuevamente.');
      } else {
        setErrorApi(mensajeDeError(error, 'No se pudo registrar la mascota. Intentá nuevamente.'));
      }
    }
  }

  return (
    <section className="pagina">
      <div className="pagina__cabecera">
        <h1>Registrar mascota</h1>
        <Link to="/mascotas" className="boton boton--secundario">
          Volver
        </Link>
      </div>

      <div className="formulario formulario--ancho">
        <FormMascota inicial={mascotaVacia} textoBoton="Registrar mascota" onGuardar={guardar}>
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
