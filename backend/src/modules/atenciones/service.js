const { pool } = require('../../config/db');
const { ApiError } = require('../../utils/errores');

// Conexión a usar: la pasada por el caller (pruebas con transacción y rollback)
// o el pool compartido de la aplicación (ruta HTTP).
function conexion(conn) {
  return conn || pool;
}

async function obtenerTurno(conn, turnoId) {
  const [filas] = await conexion(conn).execute(
    `SELECT t.id, t.usuario_id, t.mascota_id, t.servicio_id, t.fecha_hora, t.estado
       FROM turnos t
      WHERE t.id = ?`,
    [turnoId]
  );
  return filas[0];
}

// POST /admin/turnos/:id/atencion (RF26, BE-14).
// Solo se puede cargar si el turno está 'atendido' y aún no tiene atención.
// Una vez guardada, la atención es inmutable: los triggers impiden UPDATE y DELETE.
async function cargarAtencion(
  adminId,
  turnoId,
  { profesional_nombre, anamnesis, diagnostico, tratamiento, medicacion, vacunas, observaciones },
  conn = pool
) {
  const turno = await obtenerTurno(conn, turnoId);
  if (!turno) {
    throw new ApiError(404, 'NO_ENCONTRADO', 'El turno no existe');
  }
  if (turno.estado !== 'atendido') {
    throw new ApiError(
      422,
      'TURNO_NO_ATENDIDO',
      'Solo se puede cargar una atención para un turno en estado "atendido"'
    );
  }

  try {
    const [alta] = await conn.execute(
      `INSERT INTO atenciones
         (turno_id, mascota_id, profesional_nombre, anamnesis, diagnostico, tratamiento, medicacion, vacunas, observaciones, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        turnoId,
        turno.mascota_id,
        profesional_nombre,
        anamnesis ?? null,
        diagnostico ?? null,
        tratamiento ?? null,
        medicacion ?? null,
        vacunas ?? null,
        observaciones ?? null,
        adminId,
      ]
    );
    return obtenerAtencion(conn, alta.insertId);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'ATENCION_YA_EXISTE', 'Este turno ya tiene una atención cargada');
    }
    throw err;
  }
}

async function obtenerAtencion(conn, atencionId) {
  const [filas] = await conn.execute(
    `SELECT a.id, a.turno_id, a.mascota_id, t.fecha_hora, s.nombre AS servicio_nombre,
            a.profesional_nombre, a.anamnesis, a.diagnostico, a.tratamiento, a.medicacion, a.vacunas, a.observaciones,
            a.creado_por, a.creado_en
       FROM atenciones a
       JOIN turnos t ON t.id = a.turno_id
       JOIN servicios s ON s.id = t.servicio_id
      WHERE a.id = ?`,
    [atencionId]
  );
  const fila = filas[0];
  if (!fila) return null;
  return { ...fila, notas: [] };
}

// GET /api/mascotas/:id/historial (cliente) y GET /admin/mascotas/:id/historial (admin).
// Historial completo de la mascota en orden cronológico inverso, con sus notas aclaratorias.
// El cliente solo ve sus propias mascotas (404 si es ajena: no filtra información).
async function obtenerHistorial(mascotaId, { usuarioId } = {}, conn = pool) {
  const condicionUsuario = usuarioId !== undefined ? 'AND m.usuario_id = ?' : '';
  const paramsUsuario = usuarioId !== undefined ? [mascotaId, usuarioId] : [mascotaId];

  const [[mascota]] = await conn.execute(
    `SELECT m.id FROM mascotas m WHERE m.id = ? ${condicionUsuario}`,
    paramsUsuario
  );
  if (!mascota) {
    throw new ApiError(404, 'NO_ENCONTRADO', 'La mascota no existe');
  }

  const [filas] = await conn.execute(
    `SELECT a.id AS atencion_id, a.turno_id, t.fecha_hora, s.nombre AS servicio_nombre,
            a.profesional_nombre, a.anamnesis, a.diagnostico, a.tratamiento, a.medicacion, a.vacunas, a.observaciones,
            a.creado_por, a.creado_en,
            n.id AS nota_id, n.texto AS nota_texto, n.creado_por AS nota_creado_por, n.creado_en AS nota_creado_en
       FROM atenciones a
       JOIN turnos t ON t.id = a.turno_id
       JOIN servicios s ON s.id = t.servicio_id
       LEFT JOIN notas_atencion n ON n.atencion_id = a.id
      WHERE a.mascota_id = ?
      ORDER BY a.creado_en DESC, n.creado_en ASC`,
    [mascotaId]
  );

  const porAtencion = new Map();
  for (const fila of filas) {
    let atencion = porAtencion.get(fila.atencion_id);
    if (!atencion) {
      atencion = {
        id: fila.atencion_id,
        turno_id: fila.turno_id,
        fecha_hora: fila.fecha_hora,
        servicio_nombre: fila.servicio_nombre,
        profesional_nombre: fila.profesional_nombre,
        anamnesis: fila.anamnesis,
        diagnostico: fila.diagnostico,
        tratamiento: fila.tratamiento,
        medicacion: fila.medicacion,
        vacunas: fila.vacunas,
        observaciones: fila.observaciones,
        creado_por: fila.creado_por,
        creado_en: fila.creado_en,
        notas: [],
      };
      porAtencion.set(fila.atencion_id, atencion);
    }
    if (fila.nota_id) {
      atencion.notas.push({
        id: fila.nota_id,
        texto: fila.nota_texto,
        creado_por: fila.nota_creado_por,
        creado_en: fila.nota_creado_en,
      });
    }
  }
  return [...porAtencion.values()];
}

// POST /admin/atenciones/:id/notas (RF27, BE-14). Nota aclaratoria: no modifica
// el registro original, se agrega debajo con fecha y autor.
async function agregarNota(adminId, atencionId, { texto }, conn = pool) {
  const [[atencion]] = await conn.execute('SELECT id FROM atenciones WHERE id = ?', [atencionId]);
  if (!atencion) {
    throw new ApiError(404, 'NO_ENCONTRADO', 'La atención no existe');
  }

  const [alta] = await conn.execute(
    'INSERT INTO notas_atencion (atencion_id, texto, creado_por) VALUES (?, ?, ?)',
    [atencionId, texto, adminId]
  );

  const [[nota]] = await conn.execute(
    'SELECT id, texto, creado_por, creado_en FROM notas_atencion WHERE id = ?',
    [alta.insertId]
  );
  return nota;
}

module.exports = { cargarAtencion, obtenerHistorial, agregarNota };
