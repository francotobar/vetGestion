const { pool } = require('../../config/db');
const { ApiError } = require('../../utils/errores');
const {
  generarFranjas,
  esDiaLaborable,
  validarFranja,
  parsearFechaHora,
} = require('../../utils/fechas');

// Formatea un Date local como 'YYYY-MM-DD' (regla 8: intercambio de fechas).
function aFechaLocal(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

// Disponibilidad del día (sección 5 del plan):
// 1. Día sin atención (no laborable, feriado o fecha pasada) → [].
// 2. Franjas ocupadas: turnos del día con estado <> 'cancelado'.
// 3. Libres = franjas del horario, menos las ocupadas y menos las ya
//    pasadas si el día es hoy.
// "ahora" es parametrizable (mismo criterio que utils/fechas) para que los
// tests no dependan de la fecha real; el controller usa el valor por defecto.
async function disponibilidad(fecha, ahora = new Date()) {
  if (!esDiaLaborable(fecha)) return [];

  const hoy = aFechaLocal(ahora);
  if (fecha < hoy) return [];

  const [[feriado]] = await pool.execute('SELECT fecha FROM feriados WHERE fecha = ?', [fecha]);
  if (feriado) return [];

  const [anio, mes, dia] = fecha.split('-').map(Number);
  const siguiente = aFechaLocal(new Date(anio, mes - 1, dia + 1));
  const [filas] = await pool.execute(
    `SELECT TIME_FORMAT(fecha_hora, '%H:%i') AS hora
       FROM turnos
      WHERE fecha_hora >= ? AND fecha_hora < ? AND estado <> 'cancelado'`,
    [`${fecha} 00:00:00`, `${siguiente} 00:00:00`]
  );
  const ocupadas = new Set(filas.map((f) => f.hora));

  return generarFranjas().filter((hora) => {
    if (ocupadas.has(hora)) return false;
    if (fecha === hoy && parsearFechaHora(fecha, hora) < ahora) return false;
    return true;
  });
}

async function obtenerTurno(id) {
  const [[turno]] = await pool.execute(
    'SELECT id, mascota_id, servicio_id, fecha_hora, estado FROM turnos WHERE id = ?',
    [id]
  );
  return turno;
}

// Reserva del cliente (sección 5):
// 1. La mascota pertenece al usuario y está activa; si no → 404.
// 2. El servicio existe y está activo; si no → 404.
// 3. validarFranja(...) → 422 FRANJA_INVALIDA si no corresponde.
// 4. INSERT pendiente / web.
// 5. La restricción única de la BD (fecha_hora_activa) es la garantía contra
//    la doble reserva: NO hay "SELECT y luego INSERT" como control; si MySQL
//    lanza ER_DUP_ENTRY → 409 FRANJA_OCUPADA.
// "ahora" es parametrizable como en disponibilidad (los tests lo fijan).
async function crearComoCliente(
  usuarioId,
  { mascota_id, servicio_id, fecha, hora },
  ahora = new Date()
) {
  const [[mascota]] = await pool.execute(
    'SELECT id FROM mascotas WHERE id = ? AND usuario_id = ? AND activa = 1',
    [mascota_id, usuarioId]
  );
  if (!mascota) {
    throw new ApiError(404, 'NO_ENCONTRADO', 'La mascota no existe');
  }

  const [[servicio]] = await pool.execute('SELECT id FROM servicios WHERE id = ? AND activo = 1', [
    servicio_id,
  ]);
  if (!servicio) {
    throw new ApiError(404, 'NO_ENCONTRADO', 'El servicio no existe');
  }

  const [filasFeriados] = await pool.execute('SELECT fecha FROM feriados WHERE fecha = ?', [fecha]);
  validarFranja(fecha, hora, { feriados: filasFeriados.map((f) => f.fecha), ahora });

  try {
    const [alta] = await pool.execute(
      `INSERT INTO turnos (usuario_id, mascota_id, servicio_id, fecha_hora, estado, canal, creado_por)
       VALUES (?, ?, ?, ?, 'pendiente', 'web', ?)`,
      [usuarioId, mascota_id, servicio_id, `${fecha} ${hora}:00`, usuarioId]
    );
    return obtenerTurno(alta.insertId);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'FRANJA_OCUPADA', 'Esa franja acaba de ser reservada, elegí otra');
    }
    throw err;
  }
}

module.exports = { disponibilidad, crearComoCliente };
