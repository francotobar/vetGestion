// Tests para BE-13: Desbloqueo por administrador (sección 7, 6 y 5 del plan).
// Endpoint: POST /api/admin/clientes/:id/desbloquear
// Criterio de aceptación:
//   Dado un cliente bloqueado sin email, cuando el admin lo desbloquea con
//   contraseña temporal, entonces el cliente puede ingresar con ella.
//
// Reglas: datos propios con prefijo TEST13-, limpieza al terminar.
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const DOC_ADMIN = 'TEST13-ADM';
const DOC_BLOQUEADO_SIN_EMAIL = 'TEST13-CLI-NOEMAIL';
const DOC_BLOQUEADO_CON_EMAIL = 'TEST13-CLI-EMAIL';
const DOC_SIN_CUENTA = 'TEST13-CLI-SINCTA';

const EMAIL_CLIENTE = 'test13_cliente@vetgestion.test';

let adminId;
let clienteSinEmailId;
let clienteConEmailId;
let clienteSinCuentaId;
let cookieAdmin;
let cookieCliente;

beforeAll(async () => {
  const hash = await bcrypt.hash('clave12', 4);

  // Admin propio
  const [adm] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, password_hash, estado_cuenta)
     VALUES ('admin', ?, 'AdminTest13', 'Root', '1100001301', ?, 'con_cuenta')`,
    [DOC_ADMIN, hash]
  );
  adminId = adm.insertId;

  // Cliente con cuenta bloqueado y SIN email (5 intentos fallidos previos)
  const [cli1] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, email, password_hash, estado_cuenta, intentos_fallidos, bloqueado)
     VALUES ('cliente', ?, 'Pedro', 'SinEmail', '1100001302', NULL, ?, 'con_cuenta', 5, 1)`,
    [DOC_BLOQUEADO_SIN_EMAIL, hash]
  );
  clienteSinEmailId = cli1.insertId;

  // Cliente con cuenta bloqueado y CON email
  const [cli2] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, email, password_hash, estado_cuenta, intentos_fallidos, bloqueado)
     VALUES ('cliente', ?, 'Maria', 'ConEmail', '1100001303', ?, ?, 'con_cuenta', 5, 1)`,
    [DOC_BLOQUEADO_CON_EMAIL, EMAIL_CLIENTE, hash]
  );
  clienteConEmailId = cli2.insertId;

  // Cliente sin_cuenta
  const [cli3] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, email, estado_cuenta)
     VALUES ('cliente', ?, 'Juan', 'SinCuenta', '1100001304', NULL, 'sin_cuenta')`,
    [DOC_SIN_CUENTA]
  );
  clienteSinCuentaId = cli3.insertId;

  // Login admin para obtener cookie
  const logAdm = await request(app).post('/api/auth/login').send({ documento: DOC_ADMIN, password: 'clave12' });
  expect(logAdm.status).toBe(200);
  cookieAdmin = logAdm.headers['set-cookie'][0];

  // Login cliente válido para probar 403
  // Insertamos temporalmente un cliente con_cuenta no bloqueado
  const [cliOk] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, password_hash, estado_cuenta)
     VALUES ('cliente', 'TEST13-CLI-OK', 'Cliente', 'Normal', '1100001305', ?, 'con_cuenta')`,
    [hash]
  );
  const logCli = await request(app).post('/api/auth/login').send({ documento: 'TEST13-CLI-OK', password: 'clave12' });
  expect(logCli.status).toBe(200);
  cookieCliente = logCli.headers['set-cookie'][0];
});

afterAll(async () => {
  // Limpieza de usuarios TEST13-
  await pool.execute(
    'UPDATE usuarios SET creado_por = NULL, modificado_por = NULL WHERE documento LIKE ?',
    ['TEST13-%']
  );
  await pool.execute('DELETE FROM usuarios WHERE documento LIKE ? AND rol = "cliente"', ['TEST13-%']);
  await pool.execute('DELETE FROM usuarios WHERE documento LIKE ?', ['TEST13-%']);
  await pool.end();
});

describe('Autorización en POST /api/admin/clientes/:id/desbloquear', () => {
  test('sin autenticación responde 401', async () => {
    const res = await request(app).post(`/api/admin/clientes/${clienteSinEmailId}/desbloquear`).send();
    expect(res.status).toBe(401);
  });

  test('rol cliente responde 403', async () => {
    const res = await request(app)
      .post(`/api/admin/clientes/${clienteSinEmailId}/desbloquear`)
      .set('Cookie', cookieCliente)
      .send();
    expect(res.status).toBe(403);
  });
});

describe('Validaciones y casos de error en desbloqueo', () => {
  test('id inexistente responde 404', async () => {
    const res = await request(app)
      .post('/api/admin/clientes/9999999/desbloquear')
      .set('Cookie', cookieAdmin)
      .send();
    expect(res.status).toBe(404);
    expect(res.body.codigo).toBe('NO_ENCONTRADO');
  });

  test('contraseña temporal que no cumple formato (menos de 2 números o menos de 6 caracteres) responde 400', async () => {
    const res = await request(app)
      .post(`/api/admin/clientes/${clienteSinEmailId}/desbloquear`)
      .set('Cookie', cookieAdmin)
      .send({ password: 'abc1' });
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('DATOS_INVALIDOS');
  });
});

describe('Criterio de aceptación principal BE-13', () => {
  test('Dado un cliente bloqueado sin email, cuando el admin lo desbloquea con contraseña temporal, entonces el cliente puede ingresar con ella', async () => {
    // 1. Verificamos que inicialmente al intentar login responde 423 CUENTA_BLOQUEADA con el mensaje para sin email
    const loginBloqueado = await request(app)
      .post('/api/auth/login')
      .send({ documento: DOC_BLOQUEADO_SIN_EMAIL, password: 'clave12' });
    expect(loginBloqueado.status).toBe(423);
    expect(loginBloqueado.body.codigo).toBe('CUENTA_BLOQUEADA');
    expect(loginBloqueado.body.mensaje).toContain('Contactá a la veterinaria');

    // 2. El admin desbloquea y asigna contraseña temporal
    const nuevaPasswordTemporal = 'Temporal99';
    const resDesbloqueo = await request(app)
      .post(`/api/admin/clientes/${clienteSinEmailId}/desbloquear`)
      .set('Cookie', cookieAdmin)
      .send({ password: nuevaPasswordTemporal });

    expect(resDesbloqueo.status).toBe(200);
    expect(resDesbloqueo.body.cliente).toBeDefined();
    expect(resDesbloqueo.body.cliente.bloqueado).toBe(false);
    expect(resDesbloqueo.body.cliente.intentos_fallidos).toBe(0);

    // 3. Verificamos en BD que bloqueado=0 e intentos_fallidos=0
    const [[enBd]] = await pool.execute(
      'SELECT bloqueado, intentos_fallidos FROM usuarios WHERE id = ?',
      [clienteSinEmailId]
    );
    expect(enBd.bloqueado).toBe(0);
    expect(enBd.intentos_fallidos).toBe(0);

    // 4. El cliente inicia sesión con la contraseña temporal exitosamente (200)
    const loginExitoso = await request(app)
      .post('/api/auth/login')
      .send({ documento: DOC_BLOQUEADO_SIN_EMAIL, password: nuevaPasswordTemporal });
    expect(loginExitoso.status).toBe(200);
    expect(loginExitoso.body.usuario.documento).toBe(DOC_BLOQUEADO_SIN_EMAIL);
    expect(loginExitoso.headers['set-cookie'][0]).toContain('token=');
  });

  test('Desbloqueo sin enviar nueva contraseña: reinicia bloqueado e intentos_fallidos conservando la contraseña previa', async () => {
    // 1. Verificamos que cliente con email está bloqueado (423)
    const loginBloqueado = await request(app)
      .post('/api/auth/login')
      .send({ documento: DOC_BLOQUEADO_CON_EMAIL, password: 'clave12' });
    expect(loginBloqueado.status).toBe(423);
    expect(loginBloqueado.body.codigo).toBe('CUENTA_BLOQUEADA');
    expect(loginBloqueado.body.mensaje).toContain('Recuperar contraseña');

    // 2. El admin lo desbloquea sin mandar body con password
    const resDesbloqueo = await request(app)
      .post(`/api/admin/clientes/${clienteConEmailId}/desbloquear`)
      .set('Cookie', cookieAdmin)
      .send({});

    expect(resDesbloqueo.status).toBe(200);
    expect(resDesbloqueo.body.cliente.bloqueado).toBe(false);
    expect(resDesbloqueo.body.cliente.intentos_fallidos).toBe(0);

    // 3. Inicia sesión con la contraseña previa ('clave12') exitosamente
    const loginExitoso = await request(app)
      .post('/api/auth/login')
      .send({ documento: DOC_BLOQUEADO_CON_EMAIL, password: 'clave12' });
    expect(loginExitoso.status).toBe(200);
    expect(loginExitoso.body.usuario.documento).toBe(DOC_BLOQUEADO_CON_EMAIL);
  });
});
