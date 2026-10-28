const { env } = require('../../config/env');
const { pool } = require('../../config/db');
const { ApiError } = require('../../utils/errores');
const {
  generarFranjas,
  esDiaLaborable,
  validarFranja,
  horasHasta,
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
    `SELECT t.id, t.usuario_id, t.mascota_id, t.servicio_id, t.fecha_hora, t.estado, t.canal, t.es_urgencia, t.motivo,
            t.creado_por, t.modificado_por, t.creado_en, t.modificado_en,
            u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, u.documento AS cliente_documento, u.telefono AS cliente_telefono,
            m.nombre AS mascota_nombre,
            s.nombre AS servicio_nombre
       FROM turnos t
       JOIN usuarios u ON u.id = t.usuario_id
       JOIN mascotas m ON m.id = t.mascota_id
       JOIN servicios s ON s.id = t.servicio_id
      WHERE t.id = ?`,
    [id]
  );
  return turno;
}

// GET /turnos/mios (cliente, sección 6 del plan).
// Devuelve los turnos del cliente con los datos de mascota y servicio.
async function misTurnos(usuarioId) {
  const [turnos] = await pool.execute(
    `SELECT t.id, t.mascota_id, t.servicio_id, t.fecha_hora, t.estado, t.canal, t.es_urgencia, t.motivo,
            m.nombre AS mascota_nombre,
            s.nombre AS servicio_nombre
       FROM turnos t
       JOIN mascotas m ON m.id = t.mascota_id
       JOIN servicios s ON s.id = t.servicio_id
      WHERE t.usuario_id = ?
      ORDER BY t.fecha_hora DESC`,
    [usuarioId]
  );
  return turnos;
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

// Cancelación de turno por el cliente (sección 5 del plan):
// * Solo turnos propios en 'pendiente' o 'confirmado'. Si es de otro cliente o no existe → 404.
// * Si no está en 'pendiente' o 'confirmado' → 422 TRANSICION_INVALIDA.
// * Si horasHasta(fecha_hora) < ANTELACION_HS → 422 ANTELACION_INSUFICIENTE.
// * UPDATE estado='cancelado', modificado_por=usuarioId.
async function cancelarComoCliente(usuarioId, turnoId, ahora = new Date()) {
  const [[turno]] = await pool.execute(
    'SELECT id, usuario_id, fecha_hora, estado FROM turnos WHERE id = ? AND usuario_id = ?',
    [turnoId, usuarioId]
  );
  if (!turno) {
    throw new ApiError(404, 'NO_ENCONTRADO', 'El turno no existe');
  }

  if (!['pendiente', 'confirmado'].includes(turno.estado)) {
    throw new ApiError(
      422,
      'TRANSICION_INVALIDA',
      `No se puede cancelar un turno en estado "${turno.estado}"`
    );
  }

  const horas = horasHasta(turno.fecha_hora, ahora);
  if (horas < env.ANTELACION_HS) {
    throw new ApiError(
      422,
      'ANTELACION_INSUFICIENTE',
      `Los turnos solo pueden cancelarse con al menos ${env.ANTELACION_HS} horas de antelación`
    );
  }

  await pool.execute(
    'UPDATE turnos SET estado = ?, modificado_por = ? WHERE id = ?',
    ['cancelado', usuarioId, turnoId]
  );

  return obtenerTurno(turnoId);
}

// Reprogramación de turno por el cliente (sección 5 del plan):
// * Mismas validaciones de propiedad, estado y antelación (sobre el turno actual).
// * validarFranja(nueva).
// * UPDATE fecha_hora=?, estado='pendiente', modificado_por=?; capturar ER_DUP_ENTRY → 409 FRANJA_OCUPADA.
// * Se hace con un único UPDATE (atómico).
async function reprogramarComoCliente(
  usuarioId,
  turnoId,
  { fecha, hora },
  ahora = new Date()
) {
  const [[turno]] = await pool.execute(
    'SELECT id, usuario_id, fecha_hora, estado FROM turnos WHERE id = ? AND usuario_id = ?',
    [turnoId, usuarioId]
  );
  if (!turno) {
    throw new ApiError(404, 'NO_ENCONTRADO', 'El turno no existe');
  }

  if (!['pendiente', 'confirmado'].includes(turno.estado)) {
    throw new ApiError(
      422,
      'TRANSICION_INVALIDA',
      `No se puede reprogramar un turno en estado "${turno.estado}"`
    );
  }

  const horas = horasHasta(turno.fecha_hora, ahora);
  if (horas < env.ANTELACION_HS) {
    throw new ApiError(
      422,
      'ANTELACION_INSUFICIENTE',
      `Los turnos solo pueden reprogramarse con al menos ${env.ANTELACION_HS} horas de antelación`
    );
  }

  const [filasFeriados] = await pool.execute('SELECT fecha FROM feriados WHERE fecha = ?', [fecha]);
  validarFranja(fecha, hora, { feriados: filasFeriados.map((f) => f.fecha), ahora });

  try {
    await pool.execute(
      'UPDATE turnos SET fecha_hora = ?, estado = ?, modificado_por = ? WHERE id = ?',
      [`${fecha} ${hora}:00`, 'pendiente', usuarioId, turnoId]
    );
    return obtenerTurno(turnoId);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'FRANJA_OCUPADA', 'Esa franja acaba de ser reservada, elegí otra');
    }
    throw err;
  }
}

// GET /admin/turnos?desde=&hasta=&estado= (admin, sección 6 y 7 BE-10)
// Agenda con joins a cliente, mascota y servicio, y filtros opcionales.
async function listarAgendaAdmin({ desde, hasta, estado } = {}) {
  const condiciones = [];
  const params = [];

  if (desde) {
    condiciones.push('t.fecha_hora >= ?');
    params.push(`${desde} 00:00:00`);
  }

  if (hasta) {
    condiciones.push('t.fecha_hora <= ?');
    params.push(`${hasta} 23:59:59`);
  }

  if (estado) {
    condiciones.push('t.estado = ?');
    params.push(estado);
  }

  const whereClause = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [turnos] = await pool.execute(
    `SELECT t.id, t.usuario_id, t.mascota_id, t.servicio_id, t.fecha_hora, t.estado, t.canal, t.es_urgencia, t.motivo,
            t.creado_por, t.modificado_por, t.creado_en, t.modificado_en,
            u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, u.documento AS cliente_documento, u.telefono AS cliente_telefono,
            m.nombre AS mascota_nombre, m.especie AS mascota_especie,
            s.nombre AS servicio_nombre
       FROM turnos t
       JOIN usuarios u ON u.id = t.usuario_id
       JOIN mascotas m ON m.id = t.mascota_id
       JOIN servicios s ON s.id = t.servicio_id
      ${whereClause}
      ORDER BY t.fecha_hora ASC`,
    params
  );
  return turnos;
}

// POST /admin/turnos (turno manual por admin, RF21 y BE-10)
// Reglas sección 5:
// - canal ∈ {telefonico, presencial}
// - estado='confirmado'
// - creado_por=adminId
// - la mascota debe pertenecer al usuarioId indicado y estar activa (404 si no)
// - el servicio debe existir y estar activo (404 si no)
// - validarFranja(fecha, hora, ...)
// - ER_DUP_ENTRY → 409 FRANJA_OCUPADA
async function crearComoAdmin(
  adminId,
  { usuario_id, mascota_id, servicio_id, fecha, hora, canal },
  ahora = new Date()
) {
  const [[usuario]] = await pool.execute('SELECT id FROM usuarios WHERE id = ?', [usuario_id]);
  if (!usuario) {
    throw new ApiError(404, 'NO_ENCONTRADO', 'El cliente no existe');
  }

  const [[mascota]] = await pool.execute(
    'SELECT id FROM mascotas WHERE id = ? AND usuario_id = ? AND activa = 1',
    [mascota_id, usuario_id]
  );
  if (!mascota) {
    throw new ApiError(404, 'NO_ENCONTRADO', 'La mascota no existe o no pertenece al cliente');
  }

  const [[servicio]] = await pool.execute('SELECT id FROM servicios WHERE id = ? AND activo = 1', [
    servicio_id,
  ]);
  if (!servicio) {
    throw new ApiError(404, 'NO_ENCONTRADO', 'El servicio no existe o no está activo');
  }

  const [filasFeriados] = await pool.execute('SELECT fecha FROM feriados WHERE fecha = ?', [fecha]);
  validarFranja(fecha, hora, { feriados: filasFeriados.map((f) => f.fecha), ahora });

  try {
    const [alta] = await pool.execute(
      `INSERT INTO turnos (usuario_id, mascota_id, servicio_id, fecha_hora, estado, canal, creado_por)
       VALUES (?, ?, ?, ?, 'confirmado', ?, ?)`,
      [usuario_id, mascota_id, servicio_id, `${fecha} ${hora}:00`, canal, adminId]
    );
    return obtenerTurno(alta.insertId);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'FRANJA_OCUPADA', 'Esa franja ya fue reservada');
    }
    throw err;
  }
}

module.exports = {
  disponibilidad,
  crearComoCliente,
  misTurnos,
  cancelarComoCliente,
  reprogramarComoCliente,
  listarAgendaAdmin,
  crearComoAdmin,
};
