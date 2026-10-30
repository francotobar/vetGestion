const { pool } = require('../../config/db');
const { ApiError } = require('../../utils/errores');
const authService = require('../auth/service');

// Mapeo público de cliente para admin (sección 4 y 6).
function mapearCliente(fila) {
  return {
    id: fila.id,
    rol: fila.rol,
    documento: fila.documento,
    nombre: fila.nombre,
    apellido: fila.apellido,
    telefono: fila.telefono,
    email: fila.email,
    estado_cuenta: fila.estado_cuenta,
    bloqueado: fila.bloqueado === 1,
    intentos_fallidos: fila.intentos_fallidos,
    creado_en: fila.creado_en,
    modificado_en: fila.modificado_en,
  };
}

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

// GET /admin/clientes?q=
// Buscar por nombre, documento o email. Si q está vacío o no viene, lista todos los clientes.
async function buscarClientes(q) {
  let sql = `SELECT id, rol, documento, nombre, apellido, telefono, email,
                    estado_cuenta, bloqueado, intentos_fallidos, creado_en, modificado_en
               FROM usuarios
              WHERE rol = 'cliente'`;
  const params = [];

  if (q && q.trim()) {
    const termino = `%${q.trim()}%`;
    sql += ` AND (CONCAT(nombre, ' ', apellido) LIKE ? OR documento LIKE ? OR email LIKE ?)`;
    params.push(termino, termino, termino);
  }

  sql += ` ORDER BY apellido, nombre`;

  const [filas] = await pool.execute(sql, params);
  return filas.map(mapearCliente);
}

// POST /admin/clientes
// Alta asistida (RF01b, RF24). Obligatorios: nombre, apellido, documento, teléfono; email opcional.
// Documento o email duplicado → 409 con id de la ficha existente y nombre del cliente existente en el mensaje.
async function crearCliente(adminId, datos) {
  const { documento, nombre, apellido, telefono } = datos;
  const email = datos.email || null;

  // Verificación de duplicado por documento
  const [[dupDoc]] = await pool.execute(
    'SELECT id, nombre, apellido FROM usuarios WHERE documento = ?',
    [documento]
  );
  if (dupDoc) {
    const err = new ApiError(
      409,
      'DOCUMENTO_EXISTENTE',
      `Ya existe un cliente con ese documento: ${dupDoc.nombre} ${dupDoc.apellido}`
    );
    err.id = dupDoc.id;
    throw err;
  }

  // Verificación de duplicado por email (si se especificó)
  if (email) {
    const [[dupEmail]] = await pool.execute(
      'SELECT id, nombre, apellido FROM usuarios WHERE email = ?',
      [email]
    );
    if (dupEmail) {
      const err = new ApiError(
        409,
        'EMAIL_DUPLICADO',
        `Ya existe un cliente con ese email: ${dupEmail.nombre} ${dupEmail.apellido}`
      );
      err.id = dupEmail.id;
      throw err;
    }
  }

  try {
    const [alta] = await pool.execute(
      `INSERT INTO usuarios
         (rol, documento, nombre, apellido, telefono, email, estado_cuenta, creado_por)
       VALUES ('cliente', ?, ?, ?, ?, ?, 'sin_cuenta', ?)`,
      [documento, nombre, apellido, telefono, email, adminId]
    );
    return obtenerCliente(alta.insertId);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      // Por si hubo carrera concurrente
      const [[existeDoc]] = await pool.execute(
        'SELECT id, nombre, apellido FROM usuarios WHERE documento = ?',
        [documento]
      );
      if (existeDoc) {
        const error = new ApiError(
          409,
          'DOCUMENTO_EXISTENTE',
          `Ya existe un cliente con ese documento: ${existeDoc.nombre} ${existeDoc.apellido}`
        );
        error.id = existeDoc.id;
        throw error;
      }
      if (email) {
        const [[existeEmail]] = await pool.execute(
          'SELECT id, nombre, apellido FROM usuarios WHERE email = ?',
          [email]
        );
        if (existeEmail) {
          const error = new ApiError(
            409,
            'EMAIL_DUPLICADO',
            `Ya existe un cliente con ese email: ${existeEmail.nombre} ${existeEmail.apellido}`
          );
          error.id = existeEmail.id;
          throw error;
        }
      }
    }
    throw err;
  }
}

// GET /admin/clientes/:id
async function obtenerCliente(clienteId) {
  const [[cliente]] = await pool.execute(
    `SELECT id, rol, documento, nombre, apellido, telefono, email,
            estado_cuenta, bloqueado, intentos_fallidos, creado_en, modificado_en
       FROM usuarios
      WHERE id = ? AND rol = 'cliente'`,
    [clienteId]
  );
  if (!cliente) {
    throw new ApiError(404, 'NO_ENCONTRADO', 'El cliente no existe');
  }
  return mapearCliente(cliente);
}

// PUT /admin/clientes/:id
// Editar cliente (RF20).
async function actualizarCliente(adminId, clienteId, datos) {
  // Verificar existencia del cliente
  const clienteActual = await obtenerCliente(clienteId);

  const { nombre, apellido, telefono } = datos;
  const email = datos.email || null;

  if (email) {
    const [[dupEmail]] = await pool.execute(
      'SELECT id, nombre, apellido FROM usuarios WHERE email = ? AND id <> ?',
      [email, clienteId]
    );
    if (dupEmail) {
      const err = new ApiError(
        409,
        'EMAIL_DUPLICADO',
        `Ya existe un cliente con ese email: ${dupEmail.nombre} ${dupEmail.apellido}`
      );
      err.id = dupEmail.id;
      throw err;
    }
  }

  try {
    await pool.execute(
      `UPDATE usuarios
          SET nombre = ?, apellido = ?, telefono = ?, email = ?, modificado_por = ?
        WHERE id = ? AND rol = 'cliente'`,
      [nombre, apellido, telefono, email, adminId, clienteId]
    );
    return obtenerCliente(clienteId);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      const [[existeEmail]] = await pool.execute(
        'SELECT id, nombre, apellido FROM usuarios WHERE email = ? AND id <> ?',
        [email, clienteId]
      );
      if (existeEmail) {
        const error = new ApiError(
          409,
          'EMAIL_DUPLICADO',
          `Ya existe un cliente con ese email: ${existeEmail.nombre} ${existeEmail.apellido}`
        );
        error.id = existeEmail.id;
        throw error;
      }
    }
    throw err;
  }
}

// POST /admin/clientes/:id/baja
// Pasa a `inactiva` (sección 4 y 6).
async function darDeBajaCliente(adminId, clienteId) {
  const cliente = await obtenerCliente(clienteId);

  await pool.execute(
    `UPDATE usuarios
        SET estado_cuenta = 'inactiva', modificado_por = ?
      WHERE id = ? AND rol = 'cliente'`,
    [adminId, clienteId]
  );

  return { mensaje: 'Cliente dado de baja' };
}

// GET /admin/clientes/:id/mascotas
async function listarMascotasCliente(clienteId) {
  await obtenerCliente(clienteId); // asegura que el cliente exista y sea rol='cliente'

  const [filas] = await pool.execute(
    'SELECT * FROM mascotas WHERE usuario_id = ? AND activa = 1 ORDER BY nombre',
    [clienteId]
  );
  return filas.map(mapearMascota);
}

// POST /admin/clientes/:id/mascotas
async function crearMascotaCliente(adminId, clienteId, datos) {
  await obtenerCliente(clienteId); // asegura que el cliente exista

  const [alta] = await pool.execute(
    `INSERT INTO mascotas
       (usuario_id, nombre, especie, raza, sexo, fecha_nacimiento, peso_kg, esterilizado, microchip, alergias_condiciones, creado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      clienteId,
      datos.nombre,
      datos.especie,
      datos.raza,
      datos.sexo,
      datos.fecha_nacimiento,
      datos.peso_kg ?? null,
      datos.esterilizado ? 1 : 0,
      datos.microchip ?? null,
      datos.alergias_condiciones ?? null,
      adminId,
    ]
  );

  const [[mascota]] = await pool.execute(
    'SELECT * FROM mascotas WHERE id = ?',
    [alta.insertId]
  );
  return mapearMascota(mascota);
}

// PUT /admin/mascotas/:id
async function actualizarMascotaAdmin(adminId, mascotaId, datos) {
  const [[mascotaExistente]] = await pool.execute(
    'SELECT * FROM mascotas WHERE id = ? AND activa = 1',
    [mascotaId]
  );
  if (!mascotaExistente) {
    throw new ApiError(404, 'NO_ENCONTRADO', 'La mascota no existe');
  }

  await pool.execute(
    `UPDATE mascotas
        SET nombre = ?, especie = ?, raza = ?, sexo = ?, fecha_nacimiento = ?, peso_kg = ?,
            esterilizado = ?, microchip = ?, alergias_condiciones = ?, modificado_por = ?
      WHERE id = ? AND activa = 1`,
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
      adminId,
      mascotaId,
    ]
  );

  const [[actualizada]] = await pool.execute(
    'SELECT * FROM mascotas WHERE id = ?',
    [mascotaId]
  );
  return mapearMascota(actualizada);
}

// POST /admin/clientes/:id/desbloquear (BE-13)
async function desbloquearCliente(adminId, clienteId, datos) {
  return authService.desbloquearPorAdmin(adminId, clienteId, datos);
}

// POST /admin/clientes/:id/anonimizar (BE-15, RNF04 Ley 25.326).
// Anonimiza un cliente por supresión: reemplaza datos personales, deja mascotas
// inactivas y cancela sus turnos futuros. Todo en una transacción atómica: si
// algo falla, no queda un cliente a medias. No toca atenciones (RF26, inmutables).
async function anonimizarCliente(adminId, clienteId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[cliente]] = await conn.execute(
      `SELECT id FROM usuarios WHERE id = ? AND rol = 'cliente'`,
      [clienteId]
    );
    if (!cliente) {
      await conn.rollback();
      throw new ApiError(404, 'NO_ENCONTRADO', 'El cliente no existe');
    }

    const ahora = new Date();

    // 1. Datos del cliente: nombre, apellido, documento, telefono, email,
    //    password_hash y estado_cuenta.
    await conn.execute(
      `UPDATE usuarios
         SET nombre = 'Anonimizado',
             apellido = '',
             documento = ?,
             telefono = '-',
             email = NULL,
             password_hash = NULL,
             estado_cuenta = 'inactiva',
             modificado_por = ?
       WHERE id = ? AND rol = 'cliente'`,
      [`ANON-${clienteId}`, adminId, clienteId]
    );

    // 2. Mascotas del cliente: baja lógica.
    await conn.execute(
      'UPDATE mascotas SET activa = 0, modificado_por = ? WHERE usuario_id = ?',
      [adminId, clienteId]
    );

    // 3. Turnos futuros (pendiente/confirmado) del cliente: se cancelan.
    //    Los turnos ya atendidos/ausentes/cancelados no se tocan.
    await conn.execute(
      `UPDATE turnos
         SET estado = 'cancelado', modificado_por = ?
       WHERE usuario_id = ?
         AND estado IN ('pendiente', 'confirmado')
         AND fecha_hora > ?`,
      [adminId, clienteId, ahora]
    );

    await conn.commit();
    return { mensaje: 'Cliente anonimizado', id: clienteId };
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      // Ignora errores al hacer rollback; el error original prevalece.
    }
    throw err;
  } finally {
    await conn.release();
  }
}

module.exports = {
  buscarClientes,
  crearCliente,
  obtenerCliente,
  actualizarCliente,
  darDeBajaCliente,
  anonimizarCliente,
  desbloquearCliente,
  listarMascotasCliente,
  crearMascotaCliente,
  actualizarMascotaAdmin,
};
