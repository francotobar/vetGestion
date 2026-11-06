const { pool } = require('../../config/db');
const { ApiError } = require('../../utils/errores');
const { cancelarTurnosFuturos } = require('../turnos/service');

// Datos de mascota que expone la API (sin marcas de auditoría).
function mapearMascota(fila) {
  return {
    id: fila.id,
    usuario_id: fila.usuario_id,
    nombre: fila.nombre,
    especie: fila.especie,
    raza: fila.raza,
    sexo: fila.sexo,
    fecha_nacimiento: fila.fecha_nacimiento,
    peso_kg: fila.peso_kg === null ? null : Number(fila.peso_kg),
    esterilizado: fila.esterilizado === 1,
    microchip: fila.microchip,
    alergias_condiciones: fila.alergias_condiciones,
  };
}

// Todas las consultas filtran SIEMPRE por usuario_id = req.usuario.id
// (sección 6): un recurso ajeno o dado de baja responde 404, no 403.
async function listar(usuarioId) {
  const [filas] = await pool.execute(
    'SELECT * FROM mascotas WHERE usuario_id = ? AND activa = 1 ORDER BY nombre',
    [usuarioId]
  );
  return filas.map(mapearMascota);
}

async function obtener(usuarioId, mascotaId) {
  const [[mascota]] = await pool.execute(
    'SELECT * FROM mascotas WHERE id = ? AND usuario_id = ? AND activa = 1',
    [mascotaId, usuarioId]
  );
  if (!mascota) {
    throw new ApiError(404, 'NO_ENCONTRADO', 'La mascota no existe');
  }
  return mapearMascota(mascota);
}

async function crear(usuarioId, datos) {
  const [alta] = await pool.execute(
    `INSERT INTO mascotas
       (usuario_id, nombre, especie, raza, sexo, fecha_nacimiento, peso_kg, esterilizado, microchip, alergias_condiciones, creado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      usuarioId,
      datos.nombre,
      datos.especie,
      datos.raza,
      datos.sexo,
      datos.fecha_nacimiento,
      datos.peso_kg ?? null,
      datos.esterilizado ? 1 : 0,
      datos.microchip ?? null,
      datos.alergias_condiciones ?? null,
      usuarioId,
    ]
  );
  return obtener(usuarioId, alta.insertId);
}

async function actualizar(usuarioId, mascotaId, datos) {
  const [resultado] = await pool.execute(
    `UPDATE mascotas
        SET nombre = ?, especie = ?, raza = ?, sexo = ?, fecha_nacimiento = ?, peso_kg = ?,
            esterilizado = ?, microchip = ?, alergias_condiciones = ?, modificado_por = ?
      WHERE id = ? AND usuario_id = ? AND activa = 1`,
    [
      datos.nombre,
      datos.especie,
      datos.raza,
      datos.sexo,
      datos.fecha_nacimiento,
      datos.peso_kg ?? null,
      datos.esterilizado ? 1 : 0,
      datos.microchip ?? null,
      datos.alergias_condiciones ?? null,
      usuarioId,
      mascotaId,
      usuarioId,
    ]
  );
  if (resultado.affectedRows === 0) {
    throw new ApiError(404, 'NO_ENCONTRADO', 'La mascota no existe');
  }
  return obtener(usuarioId, mascotaId);
}

// Baja lógica de una mascota (activa = 0; nunca se borra físicamente, sección 4)
// junto con sus turnos futuros pendientes o confirmados, que quedan cancelados.
// Todo en una transacción: si algo falla, la mascota sigue activa y sus turnos
// sin cambios. usuarioId limita la baja a las mascotas de ese cliente (si no
// viene, la baja es del admin). Los turnos pasados no se tocan.
async function darDeBajaMascota(mascotaId, { usuarioId, modificadoPor }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[mascota]] = await conn.execute(
      'SELECT id, usuario_id FROM mascotas WHERE id = ? AND activa = 1 FOR UPDATE',
      [mascotaId]
    );
    if (!mascota || (usuarioId !== undefined && mascota.usuario_id !== usuarioId)) {
      throw new ApiError(404, 'NO_ENCONTRADO', 'La mascota no existe');
    }

    await conn.execute('UPDATE mascotas SET activa = 0, modificado_por = ? WHERE id = ?', [
      modificadoPor,
      mascotaId,
    ]);
    const turnosCancelados = await cancelarTurnosFuturos(
      conn,
      { mascotaId },
      { modificadoPor, motivo: 'Baja de la mascota' }
    );

    await conn.commit();
    return { mensaje: 'Mascota dada de baja', turnos_cancelados: turnosCancelados };
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      // El error original prevalece.
    }
    throw err;
  } finally {
    conn.release();
  }
}

// DELETE /mascotas/:id (cliente): solo sus mascotas.
async function eliminar(usuarioId, mascotaId) {
  return darDeBajaMascota(mascotaId, { usuarioId, modificadoPor: usuarioId });
}

module.exports = { listar, obtener, crear, actualizar, eliminar, darDeBajaMascota };
