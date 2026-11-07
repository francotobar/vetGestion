// Tests de autorización de todas las rutas administrativas (punto 9 de la revisión final).
// Un cliente no puede ejecutar ninguna operación de administrador: el rol se valida
// en el servidor antes de validar el cuerpo, y se toma de la base (no del token).
// Sin sesión responde 401. Los ids son inexistentes y no se modifica ningún dato.
//
// Reglas: datos propios con prefijo AUTH5-, limpieza en afterAll.
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { env } = require('../src/config/env');
const { pool } = require('../src/config/db');

const PASSWORD = 'clave12';
let clienteId;
let cookieCliente;

const RUTAS_ADMIN = [
  ['GET', '/api/admin/servicios'],
  ['POST', '/api/admin/servicios'],
  ['PUT', '/api/admin/servicios/999999'],
  ['POST', '/api/admin/feriados'],
  ['DELETE', '/api/admin/feriados/2099-01-01'],
  ['GET', '/api/admin/turnos'],
  ['POST', '/api/admin/turnos'],
  ['PATCH', '/api/admin/turnos/999999/estado'],
  ['PATCH', '/api/admin/turnos/999999/reprogramar'],
  ['POST', '/api/admin/turnos/999999/urgencia'],
  ['POST', '/api/admin/turnos/999999/atencion'],
  ['GET', '/api/admin/clientes'],
  ['POST', '/api/admin/clientes'],
  ['GET', '/api/admin/clientes/999999'],
  ['PUT', '/api/admin/clientes/999999'],
  ['POST', '/api/admin/clientes/999999/baja'],
  ['POST', '/api/admin/clientes/999999/desbloquear'],
  ['POST', '/api/admin/clientes/999999/anonimizar'],
  ['GET', '/api/admin/clientes/999999/mascotas'],
  ['POST', '/api/admin/clientes/999999/mascotas'],
  ['PUT', '/api/admin/mascotas/999999'],
  ['DELETE', '/api/admin/mascotas/999999'],
  ['GET', '/api/admin/mascotas/999999/historial'],
  ['POST', '/api/admin/atenciones/999999/notas'],
];

function pedir(metodo, ruta, cookie) {
  const req = request(app)[metodo.toLowerCase()](ruta);
  return cookie ? req.set('Cookie', cookie) : req;
}

beforeAll(async () => {
  const hash = await bcrypt.hash(PASSWORD, 4);
  const [cli] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, password_hash, estado_cuenta)
     VALUES ('cliente', 'AUTH5-CLI', 'Tester', 'Cliente', '1100000050', ?, 'con_cuenta')`,
    [hash]
  );
  clienteId = cli.insertId;
  const login = await request(app).post('/api/auth/login').send({ documento: 'AUTH5-CLI', password: PASSWORD });
  expect(login.status).toBe(200);
  cookieCliente = login.headers['set-cookie'][0].split(';')[0];
});

afterAll(async () => {
  await pool.execute("DELETE FROM usuarios WHERE documento LIKE 'AUTH5-%'");
  await pool.end();
});

describe('Rutas administrativas: el cliente recibe 403 en todas', () => {
  test.each(RUTAS_ADMIN)('%s %s con sesión de cliente → 403', async (metodo, ruta) => {
    const res = await pedir(metodo, ruta, cookieCliente);
    expect(res.status).toBe(403);
  });

  test.each(RUTAS_ADMIN)('%s %s sin sesión → 401', async (metodo, ruta) => {
    const res = await pedir(metodo, ruta, null);
    expect(res.status).toBe(401);
  });
});

describe('El rol se toma de la base, no del token', () => {
  test('un token firmado con rol admin para un cliente no da acceso administrativo', async () => {
    const [[fila]] = await pool.execute('SELECT token_version FROM usuarios WHERE id = ?', [clienteId]);
    const token = jwt.sign(
      { id: clienteId, rol: 'admin', tv: fila.token_version },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).get('/api/admin/clientes').set('Cookie', `token=${token}`);
    expect(res.status).toBe(403);
  });
});
