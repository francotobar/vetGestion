import { useState } from 'react';
import { Link } from 'react-router-dom';
import { buscar } from '../../api/adminClientes.js';
import { mensajeDeError } from '../../api/cliente.js';
import Campo from '../../components/Campo.jsx';

// Listado de clientes del administrador (FE-08), ruta /admin/clientes.
// Buscador por nombre, documento o email (GET /admin/clientes?q=; con término
// vacío el backend devuelve todos los clientes, ordenados por apellido).
// Cada tarjeta muestra el estado de cuenta (con_cuenta / sin_cuenta /
// inactiva) y enlaza a la ficha del cliente (/admin/clientes/:id).

function etiquetaCuenta(cliente) {
  if (cliente.estadoCuenta === 'inactiva') return 'Cuenta inactiva';
  if (cliente.estadoCuenta === 'sin_cuenta') return 'Sin cuenta';
  return 'Con cuenta';
}

export default function Clientes() {
  const [termino, setTermino] = useState('');
  const [buscando, setBuscando] = useState(false);
  // null = todavía no se buscó; [] = búsqueda sin resultados.
  const [clientes, setClientes] = useState(null);
  const [errorApi, setErrorApi] = useState('');

  async function manejarBusqueda(e) {
    e.preventDefault();
    setBuscando(true);
    setErrorApi('');
    try {
      const { data } = await buscar(termino.trim());
      setClientes(data);
    } catch (error) {
      setClientes(null);
      setErrorApi(mensajeDeError(error, 'No pudimos buscar clientes. Intentá nuevamente.'));
    } finally {
      setBuscando(false);
    }
  }

  return (
    <section className="pagina">
      <div className="pagina__cabecera">
        <h1>Clientes</h1>
        <Link to="/admin/clientes/nuevo" className="boton">
          Nuevo cliente
        </Link>
      </div>

      <div className="formulario formulario--ancho">
        <form onSubmit={manejarBusqueda}>
          <Campo
            id="buscar"
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
      </div>

      {errorApi && (
        <p className="error error--caja" role="alert">
          {errorApi}
        </p>
      )}

      {clientes !== null && clientes.length === 0 && (
        <div className="estado-vacio">
          <p>No encontramos ningún cliente con esa búsqueda.</p>
          <Link to="/admin/clientes/nuevo" className="boton">
            Crear cliente
          </Link>
        </div>
      )}

      {clientes !== null && clientes.length > 0 && (
        <ul className="tarjetas">
          {clientes.map((c) => (
            <li key={c.id}>
              <div className="tarjeta">
                <h2>
                  {c.nombre} {c.apellido}
                </h2>
                <p className="tarjeta__detalle">
                  Doc. {c.documento} · {etiquetaCuenta(c)}
                  {c.bloqueado ? ' · Bloqueado' : ''}
                </p>
                <p className="tarjeta__detalle">
                  <Link to={`/admin/clientes/${c.id}`} className="boton boton--secundario">
                    Ver ficha
                  </Link>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
