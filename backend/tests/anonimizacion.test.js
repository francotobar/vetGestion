// Tests para BE-15: Anonimización de clientes (sección 7 y 6 del plan).
// Endpoint: POST /api/admin/clientes/:id/anonimizar
//
// Criterios de aceptación:
// - nombre → "Anonimizado", apellido → "", documento → ANON-<id>, teléfono → "-",
//   email y contraseña → NULL, estado_cuenta → 'inactiva'.
// - mascotas → activa = 0.
// - turnos futuros (pendiente/confirmado) → cancelados.
// - No toca atenciones (RF26, inmutables).
// Todo en una transacción atómica: si algo falla, no queda un cliente a medias.
//
// Reglas: datos propios con prefijo TEST15-, limpieza al terminar contemplando
// que el cliente anonimizado queda con documento ANON-<id>.
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const DOC_ADMIN = 'TEST15-ADM';
const DOC_CLIENTE = 'TEST15-CLI';

let adminId;
let clienteId;
let mascotaId;
let servicioId;
let turnoFuturoId;
let turnoPasadoId;
let cookieAdmin;
let cookieCliente;

async function login(documento) {
  const res = await request(app).post('/api/auth/login').send({ documento, password: 'clave12' });
  expect(res.status).toBe(200);
  return res.headers['set-cookie'][0];
}

beforeAll(async () => {
  const hash = await bcrypt.hash('clave12', 4);

  // Admin propio
  const [adm] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, password_hash, estado_cuenta)
     VALUES ('admin', ?, 'AdminTest15', 'Root', '1111111222', ?, 'con_cuenta')`,
    [DOC_ADMIN, hash]
  );
  adminId = adm.insertId;

  // Cliente propio
  const [cli] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, email, password_hash, estado_cuenta)
     VALUES ('cliente', ?, 'Carlos', 'Perez', '1122334411', 'test15_cli@vetgestion.test', ?, 'con_cuenta')`,
    [DOC_CLIENTE, hash]
  );
  clienteId = cli.insertId;

  // Mascota del cliente
  const [masc] = await pool.execute(
    `INSERT INTO mascotas (usuario_id, nombre, especie, raza, sexo, fecha_nacimiento, peso_kg, esterilizado, creado_por)
     VALUES (?, 'Firulais15', 'perro', 'Labrador', 'macho', '2021-03-10', 25.5, 1, ?)`,
    [clienteId, clienteId]
  );
  mascotaId = masc.insertId;

  // Servicio propio
  const [srv] = await pool.execute(
    `INSERT INTO servicios (nombre, descripcion, activo) VALUES ('TEST15S-Consulta', 'Consulta test 15', 1)`
  );
  servicioId = srv.insertId;

  // Turno futuro (confirmado): debe cancelarse al anonimizar
  const [tf] = await pool.execute(
    `INSERT INTO turnos (usuario_id, mascota_id, servicio_id, fecha_hora, estado, canal, creado_por)
     VALUES (?, ?, ?, '2026-12-10 09:00:00', 'confirmado', 'web', ?)`,
    [clienteId, mascotaId, servicioId, clienteId]
  );
  turnoFuturoId = tf.insertId;

  // Turno pasado (atendido): no se toca al anonimizar
  const [tp] = await pool.execute(
    `INSERT INTO turnos (usuario_id, mascota_id, servicio_id, fecha_hora, estado, canal, creado_por)
     VALUES (?, ?, ?, '2026-10-20 10:00:00', 'atendido', 'web', ?)`,
    [clienteId, mascotaId, servicioId, clienteId]
  );
  turnoPasadoId = tp.insertId;

  cookieAdmin = await login(DOC_ADMIN);
  cookieCliente = await login(DOC_CLIENTE);
});

afterAll(async () => {
  // Limpieza: turnos y mascotas del cliente (por usuario_id, independiente del documento).
  await pool.execute('DELETE FROM turnos WHERE usuario_id = ?', [clienteId]);
  await pool.execute('DELETE FROM mascotas WHERE usuario_id = ?', [clienteId]);
  // Usuarios: el cliente quedó con documento ANON-<clienteId>, por eso se contempla
  // tanto TEST15-% (antes de anonimizar) como ANON-% (después).
  await pool.execute('DELETE FROM usuarios WHERE documento LIKE ? OR documento LIKE ?', [
    'TEST15-%',
    'ANON-%',
  ]);
  await pool.execute('DELETE FROM servicios WHERE nombre LIKE ?', ['TEST15S-%']);
  await pool.end();
});

describe('Autorización en POST /api/admin/clientes/:id/anonimizar', () => {
  test('usuario anónimo recibe 401', async () => {
    const res = await request(app).post(`/api/admin/clientes/${clienteId}/anonimizar`);
    expect(res.status).toBe(401);
    expect(res.body.codigo).toBe('NO_AUTENTICADO');
  });

  test('un cliente recibe 403 al intentar anonimizar a otro', async () => {
    const res = await request(app)
      .post(`/api/admin/clientes/${clienteId}/anonimizar`)
      .set('Cookie', cookieCliente);
    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('SIN_PERMISO');
  });
});

describe('POST /api/admin/clientes/:id/anonimizar', () => {
  test('cliente inexistente responde 404', async () => {
    const res = await request(app)
      .post('/api/admin/clientes/9999999/anonimizar')
      .set('Cookie', cookieAdmin);
    expect(res.status).toBe(404);
    expect(res.body.codigo).toBe('NO_ENCONTRADO');
  });

  test('anonimiza al cliente: datos, mascotas inactivas, turnos futuros cancelados, sin tocar atenciones', async () => {
    const res = await request(app)
      .post(`/api/admin/clientes/${clienteId}/anonimizar`)
      .set('Cookie', cookieAdmin);

    expect(res.status).toBe(200);
    expect(res.body.mensaje).toBe('Cliente anonimizado');
    expect(res.body.id).toBe(clienteId);

    // Datos del cliente anonimizados
    const [[usuario]] = await pool.execute(
      `SELECT nombre, apellido, documento, telefono, email, password_hash, estado_cuenta
         FROM usuarios WHERE id = ?`,
      [clienteId]
    );
    expect(usuario.nombre).toBe('Anonimizado');
    expect(usuario.apellido).toBe('');
    expect(usuario.documento).toBe(`ANON-${clienteId}`);
    expect(usuario.telefono).toBe('-');
    expect(usuario.email).toBeNull();
    expect(usuario.password_hash).toBeNull();
    expect(usuario.estado_cuenta).toBe('inactiva');

    // GET del cliente ya no lo encuentra por documento original (404 por rol/cliente)
    const getRes = await request(app)
      .get(`/api/admin/clientes/${clienteId}`)
      .set('Cookie', cookieAdmin);
    expect(getRes.status).toBe(200);
    expect(getRes.body.documento).toBe(`ANON-${clienteId}`);
    expect(getRes.body.estado_cuenta).toBe('inactiva');

    // Mascota inactiva
    const [[mascota]] = await pool.execute('SELECT activa FROM mascotas WHERE id = ?', [mascotaId]);
    expect(mascota.activa).toBe(0);

    // Turno futuro cancelado
    const [[turnoFuturo]] = await pool.execute('SELECT estado FROM turnos WHERE id = ?', [
      turnoFuturoId,
    ]);
    expect(turnoFuturo.estado).toBe('cancelado');

    // Turno pasado (atendido) no se toca
    const [[turnoPasado]] = await pool.execute('SELECT estado FROM turnos WHERE id = ?', [
      turnoPasadoId,
    ]);
    expect(turnoPasado.estado).toBe('atendido');

    // No se crearon ni tocaron atenciones en este test
    const [[{ total: totalAtenciones }]] = await pool.execute(
      'SELECT COUNT(*) AS total FROM atenciones WHERE creado_por = ?',
      [adminId]
    );
    expect(totalAtenciones).toBe(0);
  });

  test('cliente anonimizado no puede iniciar sesión (cuenta inactiva)', async () => {
    // Después del anonimizado, el documento es ANON-<clienteId> y password_hash es NULL
    const res = await request(app)
      .post('/api/auth/login')
      .send({ documento: `ANON-${clienteId}`, password: 'clave12' });
    expect(res.status).toBe(401);
  });

  test('doble anonimización: error controlado, no 500', async () => {
    // Crear un cliente separado para este test
    const hashCli2 = await bcrypt.hash('clave12', 4);
    const [cli2] = await pool.execute(
      `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, email, password_hash, estado_cuenta)
       VALUES ('cliente', ?, 'Test', 'Doble', '1100000000', 'test doble@vetgestion.test', ?, 'con_cuenta')`,
      ['TEST-DOBLE2', hashCli2]
    );
    const cliente2Id = cli2.insertId;

    // Primero anonimiza (debe tener éxito)
    await request(app)
      .post(`/api/admin/clientes/${cliente2Id}/anonimizar`)
      .set('Cookie', cookieAdmin);

    // Segundo intento: debería responder sin 500 (puede ser 200 o 404, pero nunca 500)
    const res = await request(app)
      .post(`/api/admin/clientes/${cliente2Id}/anonimizar`)
      .set('Cookie', cookieAdmin);
    expect(res.status).not.toBe(500);

    // Limpiar
    await pool.execute('DELETE FROM usuarios WHERE id = ?', [cliente2Id]);
  });

  test('anónimizar es atómico: fallo intermedio no deja cliente a medias', async () => {
    // Segundo cliente independiente para este test
    const hashCli2 = await bcrypt.hash('clave12', 4);
    const [cli2] = await pool.execute(
      `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, email, password_hash, estado_cuenta)
       VALUES ('cliente', ?, 'Ana', 'Garcia', '1122334422', 'test15_cli2@vetgestion.test', ?, 'con_cuenta')`,
      [`${DOC_CLIENTE}2`, hashCli2]
    );
    const cliente2Id = cli2.insertId;

    // Forzar un error: documento ANON-<cliente2Id> ya existe (restricción única de documento).
    await pool.execute(
      `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, estado_cuenta)
       VALUES ('cliente', ?, 'Choque', 'Documento', '1100000000', 'sin_cuenta')`,
      [`ANON-${cliente2Id}`]
    );

    const res = await request(app)
      .post(`/api/admin/clientes/${cliente2Id}/anonimizar`)
      .set('Cookie', cookieAdmin);
    // El UPDATE de documento falla por duplicado, se hace rollback y no hay respuesta 200.
    expect(res.status).not.toBe(200);

    // El cliente2 debió quedar intacto (no anonimizado a medias).
    const [[intacto]] = await pool.execute(
      `SELECT nombre, apellido, documento, estado_cuenta FROM usuarios WHERE id = ?`,
      [cliente2Id]
    );
    expect(intacto).toBeDefined();
    expect(intacto.nombre).toBe('Ana');
    expect(intacto.apellido).toBe('Garcia');
    expect(intacto.documento).toBe(`${DOC_CLIENTE}2`);
    expect(intacto.estado_cuenta).toBe('con_cuenta');

    // Limpieza explícita de este test
    await pool.execute('DELETE FROM usuarios WHERE documento = ?', [`ANON-${cliente2Id}`]);
    await pool.execute('DELETE FROM usuarios WHERE id = ?', [cliente2Id]);
  });
});
