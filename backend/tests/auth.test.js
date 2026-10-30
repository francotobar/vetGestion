// Tests de autenticación (BE-03).
// Regla: no alteran los datos del seed. Usan documentos con prefijo "TEST-"
// y los eliminan al terminar cada suite.
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const DOC_REGISTRO = 'TEST-10000001';
const DOC_VINCULO = 'TEST-20000002';
const DOC_TELEFONO = 'TEST-20000003';
const DOC_PASSWORD = 'TEST-30000001';
const DOC_EMAIL = 'TEST-40000001';
const DOC_BLOQUEO = 'TEST-50000001';
const DOC_RECUPERAR = 'TEST-60000001';
const DOC_RESET = 'TEST-70000001';

async function limpiarTests() {
  await pool.execute('DELETE FROM usuarios WHERE documento LIKE ?', ['TEST-%']);
}

afterAll(async () => {
  await limpiarTests();
  await pool.end();
});

describe('POST /api/auth/registro', () => {
  test('registra un cliente nuevo (201) y se puede iniciar sesion', async () => {
    const registro = await request(app).post('/api/auth/registro').send({
      documento: DOC_REGISTRO,
      nombre: 'Ana',
      apellido: 'Tester',
      telefono: '1100000001',
      password: 'clave12',
      consentimiento: true,
    });
    expect(registro.status).toBe(201);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ documento: DOC_REGISTRO, password: 'clave12' });
    expect(login.status).toBe(200);
    expect(login.body.usuario.rol).toBe('cliente');
    expect(login.headers['set-cookie'][0]).toContain('HttpOnly');
  });

  test('vincula una ficha "sin_cuenta" con el mismo telefono, sin duplicar', async () => {
    await pool.execute(
      `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, estado_cuenta)
       VALUES ('cliente', ?, 'Ficha', 'Previa', '1122334455', 'sin_cuenta')`,
      [DOC_VINCULO]
    );

    const registro = await request(app).post('/api/auth/registro').send({
      documento: DOC_VINCULO,
      nombre: 'Ficha',
      apellido: 'Previa',
      telefono: '1122334455',
      password: 'clave12',
      consentimiento: true,
    });
    expect(registro.status).toBe(201);

    const [[fila]] = await pool.execute(
      'SELECT estado_cuenta, password_hash FROM usuarios WHERE documento = ?',
      [DOC_VINCULO]
    );
    expect(fila.estado_cuenta).toBe('con_cuenta');
    expect(fila.password_hash).toBeTruthy();

    const [[{ total }]] = await pool.execute('SELECT COUNT(*) AS total FROM usuarios WHERE documento = ?', [
      DOC_VINCULO,
    ]);
    expect(total).toBe(1);
  });

  test('telefono distinto al de la ficha -> 409', async () => {
    await pool.execute(
      `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, estado_cuenta)
       VALUES ('cliente', ?, 'Ficha', 'Ajena', '1199999999', 'sin_cuenta')`,
      [DOC_TELEFONO]
    );

    const registro = await request(app).post('/api/auth/registro').send({
      documento: DOC_TELEFONO,
      nombre: 'Ficha',
      apellido: 'Ajena',
      telefono: '1100000099', // no coincide
      password: 'clave12',
      consentimiento: true,
    });
    expect(registro.status).toBe(409);
    expect(registro.body.codigo).toBe('FICHA_NO_COINCIDE');
  });

  test('contraseñas invalidas (abc12, abcdef1) -> 400', async () => {
    for (const password of ['abc12', 'abcdef1']) {
      const registro = await request(app).post('/api/auth/registro').send({
        documento: DOC_PASSWORD,
        nombre: 'Prueba',
        apellido: 'Password',
        telefono: '1100000003',
        password,
        consentimiento: true,
      });
      expect(registro.status).toBe(400);
    }
  });

  test('sin consentimiento -> 400', async () => {
    const registro = await request(app).post('/api/auth/registro').send({
      documento: DOC_PASSWORD,
      nombre: 'Prueba',
      apellido: 'Password',
      telefono: '1100000003',
      password: 'clave12',
    });
    expect(registro.status).toBe(400);
  });

  test('email ya usado (del seed) -> 409 EMAIL_DUPLICADO', async () => {
    const registro = await request(app).post('/api/auth/registro').send({
      documento: DOC_EMAIL,
      nombre: 'Email',
      apellido: 'Duplicado',
      telefono: '1100000004',
      email: 'luciana.garcia@example.com', // pertenece al seed; no se modifica
      password: 'clave12',
      consentimiento: true,
    });
    expect(registro.status).toBe(409);
    expect(registro.body.codigo).toBe('EMAIL_DUPLICADO');
  });
});

describe('POST /api/auth/login y GET /api/auth/me', () => {
  test('documento inexistente -> 401 genérico', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ documento: 'TEST-NOEXISTE', password: 'cualquier1' });
    expect(login.status).toBe(401);
    expect(login.body.codigo).toBe('CREDENCIALES_INVALIDAS');
  });

  test('5 intentos fallidos bloquean; el sexto con la contraseña correcta -> 423', async () => {
    await request(app).post('/api/auth/registro').send({
      documento: DOC_BLOQUEO,
      nombre: 'Bloqueo',
      apellido: 'Test',
      telefono: '1100000005',
      password: 'clave12',
      consentimiento: true,
    });

    for (let i = 0; i < 5; i += 1) {
      const intento = await request(app)
        .post('/api/auth/login')
        .send({ documento: DOC_BLOQUEO, password: 'mala1234' });
      expect(intento.status).toBe(401);
    }

    const sexto = await request(app)
      .post('/api/auth/login')
      .send({ documento: DOC_BLOQUEO, password: 'clave12' }); // correcta
    expect(sexto.status).toBe(423);
    expect(sexto.body.codigo).toBe('CUENTA_BLOQUEADA');
  });

  test('me sin cookie -> 401; con sesión → devuelve el usuario sin password', async () => {
    const sinCookie = await request(app).get('/api/auth/me');
    expect(sinCookie.status).toBe(401);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ documento: DOC_REGISTRO, password: 'clave12' });
    const cookie = login.headers['set-cookie'][0];

    const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.documento).toBe(DOC_REGISTRO);
    expect(me.body.password_hash).toBeUndefined();

    const logout = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBe(200);
    expect(logout.headers['set-cookie'][0]).toContain('token=;');
  });
});

describe('POST /api/auth/recuperar y POST /api/auth/restablecer (BE-16)', () => {
  test('recuperar con email existente genera token y devuelve 200', async () => {
    await request(app).post('/api/auth/registro').send({
      documento: DOC_RECUPERAR,
      nombre: 'Test',
      apellido: 'Recup',
      telefono: '1111111111',
      email: 'test_recup@example.com',
      password: 'clave12',
      consentimiento: true,
    });

    const res = await request(app).post('/api/auth/recuperar').send({ email: 'test_recup@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.mensaje).toContain('Si el email existe, se ha enviado un enlace');
    expect(res.body.token).toBeDefined();
    expect(res.body.expira).toBeDefined();
  });

  test('recuperar sin email en el cuerpo -> 400', async () => {
    const res = await request(app).post('/api/auth/recuperar').send({});
    expect(res.status).toBe(400);
  });

  test('recuperar email inexistente -> misma estructura que el que existe', async () => {
    const res = await request(app).post('/api/auth/recuperar').send({ email: 'inexistente@ejemplo.com' });
    expect(res.status).toBe(200);
    expect(res.body.mensaje).toContain('Si el email existe, se ha enviado un enlace');
    expect(res.body.token).toBeDefined();
  });

  test('restablecer con token valido y contrasena correcta -> 200', async () => {
    // Primero recuperar para generar token asociado al usuario
    await request(app).post('/api/auth/recuperar').send({ email: 'test_recup@example.com' });

    const { token } = (await request(app).post('/api/auth/recuperar').send({ email: 'test_recup@example.com' })).body;

    const res = await request(app).post('/api/auth/restablecer').send({ token, password: 'NuevaClave12!' });
    expect(res.status).toBe(200);
    expect(res.body.mensaje).toBe('Contraseña restablecida correctamente');
    expect(res.body.cliente.estado_cuenta).toBe('con_cuenta');
    expect(res.body.cliente.bloqueado).toBe(false);
  });
test('restablecer con token vencido -> 400', async () => {
    // Primero recuperar para generar token asociado al usuario
    await request(app).post('/api/auth/recuperar').send({ email: 'test_recup@example.com' });

    // Obtener el token
    const { token } = (await request(app).post('/api/auth/recuperar').send({ email: 'test_recup@example.com' })).body;

    // Obtener el ID del usuario
    const [[user]] = await pool.execute(
      'SELECT id FROM usuarios WHERE email = ? LIMIT 1',
      ['test_recup@example.com']
    );

    // Simular que el token vencido poniendo su fecha de expiración en el pasado
    await pool.execute(
      'UPDATE usuarios SET reset_expira = ? WHERE id = ?',
      ['2019-01-01 00:00:00', user.id]
    );

    const res = await request(app).post('/api/auth/restablecer').send({ token, password: 'clave12' });
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('TOKEN_VENCIDO');
  });

  test('restablecer con token invalido -> 400', async () => {
    const res = await request(app).post('/api/auth/restablecer').send({ token: 'token-inexistente', password: 'clave12' });
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('TOKEN_INVALIDO');
  });

  test('usuario sin email no puede recuperar por esta via', async () => {
    await request(app).post('/api/auth/registro').send({
      documento: DOC_RESET,
      nombre: 'Sin',
      apellido: 'Email',
      telefono: '1111111111',
      // Sin email
      password: 'clave12',
      consentimiento: true,
    });

    const res = await request(app).post('/api/auth/recuperar').send({ email: '' });
    expect(res.status).toBe(400);
  });
});
