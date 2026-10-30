// Tests para BE-10: Agenda admin y turno manual.
// GET /api/admin/turnos?desde=&hasta=&estado= y POST /api/admin/turnos.
// Criterio de aceptación:
// un turno manual telefónico queda confirmado, con canal='telefonico' y creado_por = admin.
//
// No alteran el seed: datos propios con prefijo TEST10- y limpieza en afterAll.
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const DOC_ADMIN = 'TEST10-ADM';
const DOC_CLIENTE = 'TEST10-CLI';
const DOC_OTRO = 'TEST10-OTRO';

let adminId;
let clienteId;
let otroId;
let mascotaClienteId;
let mascotaOtroId;
let servicioActivoId;
let servicioInactivoId;
let cookieAdmin;
let cookieCliente;

beforeAll(async () => {
  const hash = await bcrypt.hash('clave12', 4);

  // Admin propio del test
  const [adm] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, password_hash, estado_cuenta)
     VALUES ('admin', ?, 'AdminTest10', 'Root', '1111111000', ?, 'con_cuenta')`,
    [DOC_ADMIN, hash]
  );
  adminId = adm.insertId;

  // Cliente propio
  const [cli] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, password_hash, estado_cuenta)
     VALUES ('cliente', ?, 'ClienteTest10', 'Perez', '1122334455', ?, 'con_cuenta')`,
    [DOC_CLIENTE, hash]
  );
  clienteId = cli.insertId;

  // Otro cliente
  const [otro] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, password_hash, estado_cuenta)
     VALUES ('cliente', ?, 'OtroTest10', 'Gomez', '1122334466', ?, 'con_cuenta')`,
    [DOC_OTRO, hash]
  );
  otroId = otro.insertId;

  // Mascota del cliente
  const [masc] = await pool.execute(
    `INSERT INTO mascotas (usuario_id, nombre, especie, raza, sexo, fecha_nacimiento, creado_por)
     VALUES (?, 'Firulais10', 'perro', 'Mestizo', 'macho', '2021-05-10', ?)`,
    [clienteId, clienteId]
  );
  mascotaClienteId = masc.insertId;

  // Mascota de otro cliente
  const [mascO] = await pool.execute(
    `INSERT INTO mascotas (usuario_id, nombre, especie, raza, sexo, fecha_nacimiento, creado_por)
     VALUES (?, 'Mishi10', 'gato', 'Siames', 'hembra', '2022-01-15', ?)`,
    [otroId, otroId]
  );
  mascotaOtroId = mascO.insertId;

  // Servicio activo
  const [srvA] = await pool.execute(
    `INSERT INTO servicios (nombre, descripcion, activo)
     VALUES ('TEST10S-Consulta', 'Consulta activa', 1)`
  );
  servicioActivoId = srvA.insertId;

  // Servicio inactivo
  const [srvI] = await pool.execute(
    `INSERT INTO servicios (nombre, descripcion, activo)
     VALUES ('TEST10S-Inactivo', 'Servicio inactivo', 0)`
  );
  servicioInactivoId = srvI.insertId;

  // Cookies de sesión
  const logAdm = await request(app).post('/api/auth/login').send({ documento: DOC_ADMIN, password: 'clave12' });
  expect(logAdm.status).toBe(200);
  cookieAdmin = logAdm.headers['set-cookie'][0];

  const logCli = await request(app).post('/api/auth/login').send({ documento: DOC_CLIENTE, password: 'clave12' });
  expect(logCli.status).toBe(200);
  cookieCliente = logCli.headers['set-cookie'][0];
});

afterAll(async () => {
  await pool.execute(
    'DELETE FROM turnos WHERE usuario_id IN (SELECT id FROM usuarios WHERE documento LIKE ?)',
    ['TEST10-%']
  );
  await pool.execute(
    'DELETE FROM turnos WHERE creado_por IN (SELECT id FROM usuarios WHERE documento LIKE ?)',
    ['TEST10-%']
  );
  await pool.execute(
    'DELETE FROM mascotas WHERE usuario_id IN (SELECT id FROM usuarios WHERE documento LIKE ?)',
    ['TEST10-%']
  );
  await pool.execute('DELETE FROM servicios WHERE nombre LIKE ?', ['TEST10S-%']);
  await pool.execute('DELETE FROM usuarios WHERE documento LIKE ?', ['TEST10-%']);
  await pool.end();
});

describe('POST /admin/turnos (turno manual)', () => {
  test('criterio de aceptación: turno manual telefónico queda confirmado, con canal=telefonico y creado_por = admin', async () => {
    const fecha = '2026-11-18'; // miércoles laborable
    const hora = '10:00';

    const res = await request(app)
      .post('/api/admin/turnos')
      .set('Cookie', cookieAdmin)
      .send({
        usuario_id: clienteId,
        mascota_id: mascotaClienteId,
        servicio_id: servicioActivoId,
        fecha,
        hora,
        canal: 'telefonico',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.estado).toBe('confirmado');
    expect(res.body.canal).toBe('telefonico');
    expect(res.body.creado_por).toBe(adminId);
    expect(res.body.usuario_id).toBe(clienteId);
    expect(res.body.mascota_id).toBe(mascotaClienteId);
    expect(res.body.servicio_id).toBe(servicioActivoId);
    expect(res.body.cliente_nombre).toBe('ClienteTest10');
    expect(res.body.mascota_nombre).toBe('Firulais10');
    expect(res.body.servicio_nombre).toBe('TEST10S-Consulta');

    // Comprobamos en BD
    const [[turnoBD]] = await pool.execute('SELECT * FROM turnos WHERE id = ?', [res.body.id]);
    expect(turnoBD.estado).toBe('confirmado');
    expect(turnoBD.canal).toBe('telefonico');
    expect(turnoBD.creado_por).toBe(adminId);
    expect(turnoBD.fecha_hora_activa).toBe(`${fecha} ${hora}:00`);
  });

  test('turno manual presencial exitoso', async () => {
    const res = await request(app)
      .post('/api/admin/turnos')
      .set('Cookie', cookieAdmin)
      .send({
        usuario_id: clienteId,
        mascota_id: mascotaClienteId,
        servicio_id: servicioActivoId,
        fecha: '2026-11-18',
        hora: '10:30',
        canal: 'presencial',
      });

    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('confirmado');
    expect(res.body.canal).toBe('presencial');
    expect(res.body.creado_por).toBe(adminId);
  });

  test('canal inválido (por ej. web en turno manual admin) → 400 DATOS_INVALIDOS', async () => {
    const res = await request(app)
      .post('/api/admin/turnos')
      .set('Cookie', cookieAdmin)
      .send({
        usuario_id: clienteId,
        mascota_id: mascotaClienteId,
        servicio_id: servicioActivoId,
        fecha: '2026-11-18',
        hora: '11:00',
        canal: 'web',
      });

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('DATOS_INVALIDOS');
  });

  test('mascota ajena al cliente indicado → 404 NO_ENCONTRADO', async () => {
    const res = await request(app)
      .post('/api/admin/turnos')
      .set('Cookie', cookieAdmin)
      .send({
        usuario_id: clienteId,
        mascota_id: mascotaOtroId, // mascota de otro
        servicio_id: servicioActivoId,
        fecha: '2026-11-18',
        hora: '11:30',
        canal: 'telefonico',
      });

    expect(res.status).toBe(404);
    expect(res.body.codigo).toBe('NO_ENCONTRADO');
  });

  test('servicio inactivo → 404 NO_ENCONTRADO', async () => {
    const res = await request(app)
      .post('/api/admin/turnos')
      .set('Cookie', cookieAdmin)
      .send({
        usuario_id: clienteId,
        mascota_id: mascotaClienteId,
        servicio_id: servicioInactivoId,
        fecha: '2026-11-18',
        hora: '12:00',
        canal: 'telefonico',
      });

    expect(res.status).toBe(404);
    expect(res.body.codigo).toBe('NO_ENCONTRADO');
  });

  test('franja ocupada → 409 FRANJA_OCUPADA', async () => {
    // 2026-11-18 10:00 ya fue reservada en el primer test
    const res = await request(app)
      .post('/api/admin/turnos')
      .set('Cookie', cookieAdmin)
      .send({
        usuario_id: otroId,
        mascota_id: mascotaOtroId,
        servicio_id: servicioActivoId,
        fecha: '2026-11-18',
        hora: '10:00',
        canal: 'telefonico',
      });

    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('FRANJA_OCUPADA');
  });

  test('autorización: cliente común no puede crear turno manual admin (403)', async () => {
    const res = await request(app)
      .post('/api/admin/turnos')
      .set('Cookie', cookieCliente)
      .send({
        usuario_id: clienteId,
        mascota_id: mascotaClienteId,
        servicio_id: servicioActivoId,
        fecha: '2026-11-18',
        hora: '12:30',
        canal: 'telefonico',
      });

    expect(res.status).toBe(403);
  });
});

describe('GET /admin/turnos (agenda admin)', () => {
  beforeAll(async () => {
    // Insertamos turnos directos con varios estados y fechas para probar filtros y joins
    await pool.execute(
      `INSERT INTO turnos (usuario_id, mascota_id, servicio_id, fecha_hora, estado, canal, creado_por)
       VALUES (?, ?, ?, '2026-11-19 09:00:00', 'pendiente', 'web', ?)`,
      [clienteId, mascotaClienteId, servicioActivoId, clienteId]
    );

    await pool.execute(
      `INSERT INTO turnos (usuario_id, mascota_id, servicio_id, fecha_hora, estado, canal, creado_por)
       VALUES (?, ?, ?, '2026-11-19 14:00:00', 'cancelado', 'telefonico', ?)`,
      [otroId, mascotaOtroId, servicioActivoId, adminId]
    );

    await pool.execute(
      `INSERT INTO turnos (usuario_id, mascota_id, servicio_id, fecha_hora, estado, canal, creado_por)
       VALUES (?, ?, ?, '2026-11-20 15:00:00', 'atendido', 'presencial', ?)`,
      [clienteId, mascotaClienteId, servicioActivoId, adminId]
    );
  });

  test('obtiene la lista con joins a cliente, mascota y servicio', async () => {
    const res = await request(app)
      .get('/api/admin/turnos')
      .query({ desde: '2026-11-19', hasta: '2026-11-19' })
      .set('Cookie', cookieAdmin);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);

    const turno1 = res.body.find((t) => t.fecha_hora === '2026-11-19 09:00:00');
    expect(turno1).toBeDefined();
    expect(turno1.cliente_nombre).toBe('ClienteTest10');
    expect(turno1.cliente_apellido).toBe('Perez');
    expect(turno1.cliente_documento).toBe(DOC_CLIENTE);
    expect(turno1.mascota_nombre).toBe('Firulais10');
    expect(turno1.mascota_especie).toBe('perro');
    expect(turno1.servicio_nombre).toBe('TEST10S-Consulta');
    expect(turno1.estado).toBe('pendiente');

    const turno2 = res.body.find((t) => t.fecha_hora === '2026-11-19 14:00:00');
    expect(turno2).toBeDefined();
    expect(turno2.cliente_nombre).toBe('OtroTest10');
    expect(turno2.mascota_nombre).toBe('Mishi10');
    expect(turno2.estado).toBe('cancelado');
  });

  test('filtra por estado', async () => {
    const res = await request(app)
      .get('/api/admin/turnos')
      .query({ desde: '2026-11-19', hasta: '2026-11-20', estado: 'atendido' })
      .set('Cookie', cookieAdmin);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].fecha_hora).toBe('2026-11-20 15:00:00');
    expect(res.body[0].estado).toBe('atendido');
  });

  test('filtro con estado inválido → 400 DATOS_INVALIDOS', async () => {
    const res = await request(app)
      .get('/api/admin/turnos')
      .query({ estado: 'invalido' })
      .set('Cookie', cookieAdmin);

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('DATOS_INVALIDOS');
  });

  test('autorización: sin sesión → 401; cliente → 403', async () => {
    const sinSesion = await request(app).get('/api/admin/turnos');
    expect(sinSesion.status).toBe(401);

    const comoCliente = await request(app).get('/api/admin/turnos').set('Cookie', cookieCliente);
    expect(comoCliente.status).toBe(403);
  });
});
