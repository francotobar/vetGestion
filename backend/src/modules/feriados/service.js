const { pool } = require('../../config/db');
const { ApiError } = require('../../utils/errores');

// La lista es pública para C/A: la usan la reserva (FE-04) y el admin.
async function listar() {
  const [filas] = await pool.execute('SELECT fecha, motivo FROM feriados ORDER BY fecha');
  return filas; // dateStrings: true → fecha como 'YYYY-MM-DD'
}

async function crear({ fecha, motivo }) {
  try {
    await pool.execute('INSERT INTO feriados (fecha, motivo) VALUES (?, ?)', [fecha, motivo]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'FERIADO_DUPLICADO', 'Ya existe un feriado en esa fecha');
    }
    throw err;
  }
  return { fecha, motivo };
}

// Baja de feriados: es dato de configuración, se elimina directamente
// (la tabla feriados no tiene columna de baja lógica).
async function eliminar(fecha) {
  const [resultado] = await pool.execute('DELETE FROM feriados WHERE fecha = ?', [fecha]);
  if (resultado.affectedRows === 0) {
    throw new ApiError(404, 'NO_ENCONTRADO', 'El feriado no existe');
  }
  return { mensaje: 'Feriado eliminado' };
}

module.exports = { listar, crear, eliminar };
