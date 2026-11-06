// Tests de revocación de sesiones (observación 1 del docente).
// La cookie (JWT) lleva la versión del usuario (tv) y se valida contra
// usuarios.token_version. Cerrar sesión, restablecer la contraseña, desbloquear
// con contraseña temporal y dar de baja al cliente dejan sin efecto las
// cookies anteriores (401 SESION_REVOCADA). Un token sin versión también se rechaza.
//
// Reglas: datos propios con prefijo OBS1-, limpieza en afterAll.
const request = require('supertest');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { env } = require('../src/config/env');
const { pool } = require('../src/config/db');

const PASSWORD = 'clave12';
const DOC_ADMIN = 'OBS1-ADM';
const DOC_CLIENTE = 'OBS1-CLI';
const DOC_DESBLOQUEO = 'OBS1-DESB';
const DOC_BAJA = 'OBS1-BAJA';

let cookieAdmin;
let clienteId;
let desbloqueoId;
let bajaId;

async function login(documento, password = PASSWORD) {
  const res = await request(app).post('/api/auth/login').send({ documento, password });
  expect(res.status).toBe(200);
  return res.headers['set-cookie'][0].split(';')[0];
}

async function insertarCliente(documento, email) {
  const hash = await bcrypt.hash(PASSWORD, 4);
  const [res] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, email, password_hash, estado_cuenta)
     VALUES ('cliente', ?, 'Obs1', 'Test', '1100000001', ?, ?, 'con_cuenta')`,
    [documento, email, hash]
  );
  return res.insertId;
}

beforeAll(async () => {
  const hash = await bcrypt.hash(PASSWORD, 4);
  await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, password_hash, estado_cuenta)
     VALUES ('admin', ?, 'AdminObs1', 'Root', '1100000000', ?, 'con_cuenta')`,
    [DOC_ADMIN, hash]
  );
  clienteId = await insertarCliente(DOC_CLIENTE, 'obs1_cli@vetgestion.test');
  desbloqueoId = await insertarCliente(DOC_DESBLOQUEO, null);
  bajaId = await insertarCliente(DOC_BAJA, null);
  cookieAdmin = await login(DOC_ADMIN);
});

afterAll(async () => {
  await pool.execute(
    "UPDATE usuarios SET creado_por = NULL, modificado_por = NULL WHERE documento LIKE 'OBS1-%'"
  );
  await pool.execute("DELETE FROM usuarios WHERE documento LIKE 'OBS1-%'");
  await pool.end();
});

describe('Revocación de sesiones', () => {
  test('reutilizar la cookie después del logout da 401 SESION_REVOCADA', async () => {
    const cookie = await login(DOC_CLIENTE);
    const antes = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(antes.status).toBe(200);

    const logout = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBe(200);

    const reutilizada = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(reutilizada.status).toBe(401);
    expect(reutilizada.body.codigo).toBe('SESION_REVOCADA');
  });

  test('un login nuevo funciona después del logout', async () => {
    const nueva = await login(DOC_CLIENTE);
    const me = await request(app).get('/api/auth/me').set('Cookie', nueva);
    expect(me.status).toBe(200);
    expect(me.body.documento).toBe(DOC_CLIENTE);
    expect(me.body).not.toHaveProperty('token_version');
  });

  test('cerrar sesión en un dispositivo también revoca la sesión de otro', async () => {
    const dispositivoA = await login(DOC_CLIENTE);
    const dispositivoB = await login(DOC_CLIENTE);

    await request(app).post('/api/auth/logout').set('Cookie', dispositivoA);

    const res = await request(app).get('/api/auth/me').set('Cookie', dispositivoB);
    expect(res.status).toBe(401);
    expect(res.body.codigo).toBe('SESION_REVOCADA');
  });

  test('reutilizar la cookie después de restablecer la contraseña da 401 SESION_REVOCADA', async () => {
    const cookie = await login(DOC_CLIENTE);

    const tokenPlano = crypto.randomBytes(32).toString('hex');
    await pool.execute(
      'UPDATE usuarios SET reset_token_hash = ?, reset_expira = ? WHERE id = ?',
      [
        crypto.createHash('sha256').update(tokenPlano).digest('hex'),
        new Date(Date.now() + 60 * 60 * 1000),
        clienteId,
      ]
    );

    const restablecer = await request(app)
      .post('/api/auth/restablecer')
      .send({ token: tokenPlano, password: 'Nueva12' });
    expect(restablecer.status).toBe(200);

    const reutilizada = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(reutilizada.status).toBe(401);
    expect(reutilizada.body.codigo).toBe('SESION_REVOCADA');

    const conNuevaClave = await login(DOC_CLIENTE, 'Nueva12');
    const me = await request(app).get('/api/auth/me').set('Cookie', conNuevaClave);
    expect(me.status).toBe(200);

    const hashOriginal = await bcrypt.hash(PASSWORD, 4);
    await pool.execute('UPDATE usuarios SET password_hash = ? WHERE id = ?', [hashOriginal, clienteId]);
  });

  test('desbloquear con contraseña temporal revoca la sesión anterior del cliente', async () => {
    const cookie = await login(DOC_DESBLOQUEO);

    const res = await request(app)
      .post(`/api/admin/clientes/${desbloqueoId}/desbloquear`)
      .set('Cookie', cookieAdmin)
      .send({ password: 'Temp12' });
    expect(res.status).toBe(200);

    const reutilizada = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(reutilizada.status).toBe(401);
    expect(reutilizada.body.codigo).toBe('SESION_REVOCADA');
  });

  test('dar de baja al cliente revoca su sesión', async () => {
    const cookie = await login(DOC_BAJA);

    const res = await request(app)
      .post(`/api/admin/clientes/${bajaId}/baja`)
      .set('Cookie', cookieAdmin);
    expect(res.status).toBe(200);

    const reutilizada = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(reutilizada.status).toBe(401);
    expect(reutilizada.body.codigo).toBe('SESION_REVOCADA');
  });

  test('un token sin versión es rechazado con 401 SESION_REVOCADA', async () => {
    const sinVersion = jwt.sign({ id: clienteId, rol: 'cliente' }, env.JWT_SECRET, { expiresIn: '1h' });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `token=${sinVersion}`);
    expect(res.status).toBe(401);
    expect(res.body.codigo).toBe('SESION_REVOCADA');
  });
});
