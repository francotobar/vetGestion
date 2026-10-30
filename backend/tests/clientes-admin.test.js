// Tests para BE-12: Clientes del administrador (sección 7 y 6 del plan).
// Endpoints:
//   GET /api/admin/clientes?q=
//   POST /api/admin/clientes
//   GET /api/admin/clientes/:id
//   PUT /api/admin/clientes/:id
//   POST /api/admin/clientes/:id/baja
//   GET /api/admin/clientes/:id/mascotas
//   POST /api/admin/clientes/:id/mascotas
//   PUT /api/admin/mascotas/:id
//
// Criterio de aceptación:
// Dado un documento existente, cuando el admin intenta crearlo de nuevo,
// entonces 409 y el mensaje incluye el nombre del cliente existente.
// Prevención de duplicados (RF24): documento o email duplicado -> 409 con id de la ficha.
//
// Reglas: datos propios con prefijo TEST12-, limpieza al terminar.
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const DOC_ADMIN = 'TEST12-ADM';
const DOC_CLIENTE1 = 'TEST12-CLI1';
const DOC_CLIENTE2 = 'TEST12-CLI2';
const DOC_ALTA = 'TEST12-ALTA1';
const DOC_DUP = 'TEST12-DUP';

const EMAIL_CLIENTE1 = 'test12_cli1@vetgestion.test';
const EMAIL_CLIENTE2 = 'test12_cli2@vetgestion.test';
const EMAIL_ALTA = 'test12_alta@vetgestion.test';

let adminId;
let cliente1Id;
let cliente2Id;
let cookieAdmin;
let cookieCliente;

beforeAll(async () => {
  const hash = await bcrypt.hash('clave12', 4);

  // Admin propio
  const [adm] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, password_hash, estado_cuenta)
     VALUES ('admin', ?, 'AdminTest12', 'Root', '1111111222', ?, 'con_cuenta')`,
    [DOC_ADMIN, hash]
  );
  adminId = adm.insertId;

  // Clientes existentes
  const [cli1] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, email, password_hash, estado_cuenta)
     VALUES ('cliente', ?, 'Carlos', 'Perez', '1122334411', ?, ?, 'con_cuenta')`,
    [DOC_CLIENTE1, EMAIL_CLIENTE1, hash]
  );
  cliente1Id = cli1.insertId;

  const [cli2] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, email, password_hash, estado_cuenta)
     VALUES ('cliente', ?, 'Lucia', 'Gomez', '1122334422', ?, ?, 'sin_cuenta')`,
    [DOC_CLIENTE2, EMAIL_CLIENTE2, hash]
  );
  cliente2Id = cli2.insertId;

  // Mascota para cliente1
  await pool.execute(
    `INSERT INTO mascotas (usuario_id, nombre, especie, raza, sexo, fecha_nacimiento, peso_kg, esterilizado, creado_por)
     VALUES (?, 'Firulais12', 'perro', 'Labrador', 'macho', '2021-03-10', 25.5, 1, ?)`,
    [cliente1Id, cliente1Id]
  );

  // Login admin
  const logAdm = await request(app).post('/api/auth/login').send({ documento: DOC_ADMIN, password: 'clave12' });
  expect(logAdm.status).toBe(200);
  cookieAdmin = logAdm.headers['set-cookie'][0];

  // Login cliente
  const logCli = await request(app).post('/api/auth/login').send({ documento: DOC_CLIENTE1, password: 'clave12' });
  expect(logCli.status).toBe(200);
  cookieCliente = logCli.headers['set-cookie'][0];
});

afterAll(async () => {
  // Limpieza de mascotas creadas por admin o clientes TEST12-
  await pool.execute(
    'DELETE FROM mascotas WHERE usuario_id IN (SELECT id FROM usuarios WHERE documento LIKE ?)',
    ['TEST12-%']
  );
  // Limpieza de usuarios TEST12-: primero desvincular creado_por / modificado_por para evitar fk_usr_creado
  await pool.execute(
    'UPDATE usuarios SET creado_por = NULL, modificado_por = NULL WHERE documento LIKE ?',
    ['TEST12-%']
  );
  // Borrar los usuarios clientes primero y luego el admin
  await pool.execute('DELETE FROM usuarios WHERE documento LIKE ? AND rol = "cliente"', ['TEST12-%']);
  await pool.execute('DELETE FROM usuarios WHERE documento LIKE ?', ['TEST12-%']);
  await pool.end();
});

describe('Autorización en rutas de administración de clientes y mascotas', () => {
  test('un usuario anónimo recibe 401', async () => {
    const res = await request(app).get('/api/admin/clientes');
    expect(res.status).toBe(401);
  });

  test('un cliente recibe 403 al acceder a /api/admin/clientes', async () => {
    const res = await request(app).get('/api/admin/clientes').set('Cookie', cookieCliente);
    expect(res.status).toBe(403);
  });

  test('un cliente recibe 403 al acceder a /api/admin/mascotas/1', async () => {
    const res = await request(app)
      .put('/api/admin/mascotas/1')
      .set('Cookie', cookieCliente)
      .send({
        nombre: 'Max',
        especie: 'perro',
        raza: 'Boxer',
        sexo: 'macho',
        fecha_nacimiento: '2020-01-01',
      });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/clientes (Búsqueda)', () => {
  test('lista clientes y permite buscar por nombre o apellido', async () => {
    const res = await request(app)
      .get('/api/admin/clientes?q=Carlos')
      .set('Cookie', cookieAdmin);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const encontrado = res.body.find((c) => c.documento === DOC_CLIENTE1);
    expect(encontrado).toBeDefined();
    expect(encontrado.nombre).toBe('Carlos');
    expect(encontrado.apellido).toBe('Perez');
  });

  test('permite buscar por documento', async () => {
    const res = await request(app)
      .get(`/api/admin/clientes?q=${DOC_CLIENTE2}`)
      .set('Cookie', cookieAdmin);

    expect(res.status).toBe(200);
    const encontrado = res.body.find((c) => c.documento === DOC_CLIENTE2);
    expect(encontrado).toBeDefined();
    expect(encontrado.nombre).toBe('Lucia');
  });

  test('permite buscar por email', async () => {
    const res = await request(app)
      .get(`/api/admin/clientes?q=${EMAIL_CLIENTE1}`)
      .set('Cookie', cookieAdmin);

    expect(res.status).toBe(200);
    const encontrado = res.body.find((c) => c.email === EMAIL_CLIENTE1);
    expect(encontrado).toBeDefined();
  });
});

describe('POST /api/admin/clientes (Alta asistida)', () => {
  test('crea un cliente en estado "sin_cuenta" con email opcional (201)', async () => {
    const res = await request(app)
      .post('/api/admin/clientes')
      .set('Cookie', cookieAdmin)
      .send({
        documento: DOC_ALTA,
        nombre: 'Mariana',
        apellido: 'Lopez',
        telefono: '1199887766',
        email: EMAIL_ALTA,
      });

    expect(res.status).toBe(201);
    expect(res.body.documento).toBe(DOC_ALTA);
    expect(res.body.nombre).toBe('Mariana');
    expect(res.body.apellido).toBe('Lopez');
    expect(res.body.telefono).toBe('1199887766');
    expect(res.body.email).toBe(EMAIL_ALTA);
    expect(res.body.estado_cuenta).toBe('sin_cuenta');
    expect(res.body.rol).toBe('cliente');
  });

  test('valida campos obligatorios (400 si falta nombre, apellido, documento o telefono)', async () => {
    const res = await request(app)
      .post('/api/admin/clientes')
      .set('Cookie', cookieAdmin)
      .send({
        documento: 'TEST12-INCOMPLETO',
        nombre: 'SinTelefono',
        apellido: 'Prueba',
      });

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('DATOS_INVALIDOS');
  });

  test('Criterio de aceptación: documento existente responde 409, incluye id y nombre del cliente existente', async () => {
    const res = await request(app)
      .post('/api/admin/clientes')
      .set('Cookie', cookieAdmin)
      .send({
        documento: DOC_CLIENTE1,
        nombre: 'Otro Carlos',
        apellido: 'Perez',
        telefono: '1122334400',
      });

    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('DOCUMENTO_EXISTENTE');
    expect(res.body.id).toBe(cliente1Id);
    expect(res.body.mensaje).toContain('Carlos Perez');
  });

  test('email duplicado responde 409, incluye id y nombre del cliente existente', async () => {
    const res = await request(app)
      .post('/api/admin/clientes')
      .set('Cookie', cookieAdmin)
      .send({
        documento: DOC_DUP,
        nombre: 'Nuevo',
        apellido: 'Cliente',
        telefono: '1122334499',
        email: EMAIL_CLIENTE2,
      });

    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('EMAIL_DUPLICADO');
    expect(res.body.id).toBe(cliente2Id);
    expect(res.body.mensaje).toContain('Lucia Gomez');
  });
});

describe('GET y PUT /api/admin/clientes/:id', () => {
  test('GET devuelve datos del cliente existente', async () => {
    const res = await request(app)
      .get(`/api/admin/clientes/${cliente1Id}`)
      .set('Cookie', cookieAdmin);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(cliente1Id);
    expect(res.body.documento).toBe(DOC_CLIENTE1);
  });

  test('GET responde 404 para cliente inexistente', async () => {
    const res = await request(app)
      .get('/api/admin/clientes/9999999')
      .set('Cookie', cookieAdmin);

    expect(res.status).toBe(404);
    expect(res.body.codigo).toBe('NO_ENCONTRADO');
  });

  test('PUT actualiza datos del cliente (nombre, apellido, telefono, email)', async () => {
    const res = await request(app)
      .put(`/api/admin/clientes/${cliente1Id}`)
      .set('Cookie', cookieAdmin)
      .send({
        nombre: 'Carlos Modificado',
        apellido: 'Perez Modificado',
        telefono: '1133334444',
        email: 'carlos_modificado@vetgestion.test',
      });

    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe('Carlos Modificado');
    expect(res.body.apellido).toBe('Perez Modificado');
    expect(res.body.telefono).toBe('1133334444');
    expect(res.body.email).toBe('carlos_modificado@vetgestion.test');
  });

  test('PUT con email de otro cliente responde 409 con id del duplicado', async () => {
    const res = await request(app)
      .put(`/api/admin/clientes/${cliente1Id}`)
      .set('Cookie', cookieAdmin)
      .send({
        nombre: 'Carlos',
        apellido: 'Perez',
        telefono: '1133334444',
        email: EMAIL_CLIENTE2,
      });

    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('EMAIL_DUPLICADO');
    expect(res.body.id).toBe(cliente2Id);
  });
});

describe('POST /api/admin/clientes/:id/baja', () => {
  test('pasa el estado_cuenta del cliente a "inactiva"', async () => {
    const res = await request(app)
      .post(`/api/admin/clientes/${cliente2Id}/baja`)
      .set('Cookie', cookieAdmin);

    expect(res.status).toBe(200);
    expect(res.body.mensaje).toBe('Cliente dado de baja');

    const getRes = await request(app)
      .get(`/api/admin/clientes/${cliente2Id}`)
      .set('Cookie', cookieAdmin);

    expect(getRes.status).toBe(200);
    expect(getRes.body.estado_cuenta).toBe('inactiva');
  });
});

describe('Mascotas del cliente (/admin/clientes/:id/mascotas y /admin/mascotas/:id)', () => {
  let mascotaCreadaId;

  test('GET /admin/clientes/:id/mascotas lista las mascotas activas del cliente', async () => {
    const res = await request(app)
      .get(`/api/admin/clientes/${cliente1Id}/mascotas`)
      .set('Cookie', cookieAdmin);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body.find((m) => m.nombre === 'Firulais12')).toBeDefined();
  });

  test('POST /admin/clientes/:id/mascotas crea una mascota para el cliente', async () => {
    const res = await request(app)
      .post(`/api/admin/clientes/${cliente1Id}/mascotas`)
      .set('Cookie', cookieAdmin)
      .send({
        nombre: 'MichiAdmin12',
        especie: 'gato',
        raza: 'Siames',
        sexo: 'hembra',
        fecha_nacimiento: '2022-06-15',
        peso_kg: 4.2,
        esterilizado: false,
        microchip: 'CHIP12345',
        alergias_condiciones: 'Polvo',
      });

    expect(res.status).toBe(201);
    expect(res.body.nombre).toBe('MichiAdmin12');
    expect(res.body.usuario_id).toBe(cliente1Id);
    expect(res.body.especie).toBe('gato');
    expect(res.body.peso_kg).toBe(4.2);
    mascotaCreadaId = res.body.id;
  });

  test('POST /admin/clientes/:id/mascotas con cliente inexistente responde 404', async () => {
    const res = await request(app)
      .post('/api/admin/clientes/9999999/mascotas')
      .set('Cookie', cookieAdmin)
      .send({
        nombre: 'Fantasma',
        especie: 'perro',
        raza: 'Callejero',
        sexo: 'macho',
        fecha_nacimiento: '2022-01-01',
      });

    expect(res.status).toBe(404);
  });

  test('PUT /admin/mascotas/:id edita la mascota correctamente', async () => {
    const res = await request(app)
      .put(`/api/admin/mascotas/${mascotaCreadaId}`)
      .set('Cookie', cookieAdmin)
      .send({
        nombre: 'MichiAdmin12 Modificado',
        especie: 'gato',
        raza: 'Siames',
        sexo: 'hembra',
        fecha_nacimiento: '2022-06-15',
        peso_kg: 4.8,
        esterilizado: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe('MichiAdmin12 Modificado');
    expect(res.body.peso_kg).toBe(4.8);
    expect(res.body.esterilizado).toBe(true);
  });

  test('PUT /admin/mascotas/:id con id inexistente responde 404', async () => {
    const res = await request(app)
      .put('/api/admin/mascotas/9999999')
      .set('Cookie', cookieAdmin)
      .send({
        nombre: 'Inexistente',
        especie: 'perro',
        raza: 'Callejero',
        sexo: 'macho',
        fecha_nacimiento: '2022-01-01',
      });

    expect(res.status).toBe(404);
    expect(res.body.codigo).toBe('NO_ENCONTRADO');
  });
});
