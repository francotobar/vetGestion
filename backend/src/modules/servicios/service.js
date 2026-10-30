const { pool } = require('../../config/db');
const { ApiError } = require('../../utils/errores');

function mapearServicio(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    activo: fila.activo === 1,
  };
}

// El cliente ve solo los activos (RF19); el admin ve el catálogo completo.
async function listarActivos() {
  const [filas] = await pool.execute(
    'SELECT id, nombre, descripcion, activo FROM servicios WHERE activo = 1 ORDER BY nombre'
  );
  return filas.map(mapearServicio);
}

async function listarTodos() {
  const [filas] = await pool.execute(
    'SELECT id, nombre, descripcion, activo FROM servicios ORDER BY nombre'
  );
  return filas.map(mapearServicio);
}

async function obtener(id) {
  const [[servicio]] = await pool.execute(
    'SELECT id, nombre, descripcion, activo FROM servicios WHERE id = ?',
    [id]
  );
  if (!servicio) {
    throw new ApiError(404, 'NO_ENCONTRADO', 'El servicio no existe');
  }
  return mapearServicio(servicio);
}

async function crear({ nombre, descripcion, activo }) {
  try {
    const [alta] = await pool.execute('INSERT INTO servicios (nombre, descripcion, activo) VALUES (?, ?, ?)', [
      nombre,
      descripcion ?? null,
      activo ? 1 : 0,
    ]);
    return obtener(alta.insertId);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'SERVICIO_DUPLICADO', 'Ya existe un servicio con ese nombre');
    }
    throw err;
  }
}

// Edición completa, incluido activar/desactivar (baja lógica).
async function actualizar(id, { nombre, descripcion, activo }) {
  try {
    const [resultado] = await pool.execute(
      'UPDATE servicios SET nombre = ?, descripcion = ?, activo = ? WHERE id = ?',
      [nombre, descripcion ?? null, activo ? 1 : 0, id]
    );
    if (resultado.affectedRows === 0) {
      throw new ApiError(404, 'NO_ENCONTRADO', 'El servicio no existe');
    }
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'SERVICIO_DUPLICADO', 'Ya existe un servicio con ese nombre');
    }
    throw err;
  }
  return obtener(id);
}

module.exports = { listarActivos, listarTodos, crear, actualizar };
