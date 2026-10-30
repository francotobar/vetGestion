// Tests del catálogo de servicios (BE-06). Aceptación: un servicio inactivo
// no aparece para el cliente.
//
// No alteran el seed: usuarios "TEST06S-*", servicios "TEST06S-*" y limpieza
// al terminar la suite.
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const DOC_ADMIN = 'TEST06S-ADM';
const DOC_CLI = 'TEST06S-CLI';

async function crearAdmin(documento) {
  const hash = await bcrypt.hash('clave12', 10);
  await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, password_hash, estado_cuenta, consentimiento_at)
     VALUES ('admin', ?, 'Test', 'Servicios', '1100000096', ?, 'con_cuenta', NOW())`,
    [documento, hash]
  );
}

async function cookieDe(documento) {
  const login = await request(app).post('/api/auth/login').send({ documento, password: 'clave12' });
  expect(login.status).toBe(200);
  return login.headers['set-cookie'][0];
}

let cookieAdmin;
let cookieCliente;
let idActivo;
let idInactivo;

beforeAll(async () => {
  await crearAdmin(DOC_ADMIN);
  const registro = await request(app).post('/api/auth/registro').send({
    documento: DOC_CLI,
    nombre: 'Test',
    apellido: 'Servicios',
    telefono: '1100000096',
    password: 'clave12',
    consentimiento: true,
  });
  expect(registro.status).toBe(201);

  cookieAdmin = await cookieDe(DOC_ADMIN);
  cookieCliente = await cookieDe(DOC_CLI);

  const activo = await request(app)
    .post('/api/admin/servicios')
    .set('Cookie', cookieAdmin)
    .send({ nombre: 'TEST06S-Activo', descripcion: 'Para el test' });
  expect(activo.status).toBe(201);
  idActivo = activo.body.id;

  const inactivo = await request(app)
    .post('/api/admin/servicios')
    .set('Cookie', cookieAdmin)
    .send({ nombre: 'TEST06S-Inactivo', activo: false });
  expect(inactivo.status).toBe(201);
  idInactivo = inactivo.body.id;
});

afterAll(async () => {
  await pool.execute('DELETE FROM servicios WHERE nombre LIKE ?', ['TEST06S-%']);
  await pool.execute('DELETE FROM usuarios WHERE documento LIKE ?', ['TEST06S-%']);
  await pool.end();
});

describe('servicios', () => {
  test('el cliente ve solo los activos (un inactivo no aparece)', async () => {
    const res = await request(app).get('/api/servicios').set('Cookie', cookieCliente);
    expect(res.status).toBe(200);

    const ids = res.body.map((s) => s.id);
    expect(ids).toContain(idActivo);
    expect(ids).not.toContain(idInactivo);
    // Los servicios del seed siguen intactos y visibles.
    expect(res.body.some((s) => s.nombre === 'Consulta general')).toBe(true);
    expect(res.body.every((s) => s.activo)).toBe(true);
  });

  test('el admin ve el catálogo completo (activos e inactivos)', async () => {
    const res = await request(app).get('/api/admin/servicios').set('Cookie', cookieAdmin);
    expect(res.status).toBe(200);
    const ids = res.body.map((s) => s.id);
    expect(ids).toContain(idActivo);
    expect(ids).toContain(idInactivo);
  });

  test('edición: renombrar y activar/desactivar', async () => {
    const editar = await request(app)
      .put(`/api/admin/servicios/${idInactivo}`)
      .set('Cookie', cookieAdmin)
      .send({ nombre: 'TEST06S-Reactivado', descripcion: null, activo: true });
    expect(editar.status).toBe(200);
    expect(editar.body.nombre).toBe('TEST06S-Reactivado');
    expect(editar.body.activo).toBe(true);

    // Ahora sí aparece para el cliente.
    const cliente = await request(app).get('/api/servicios').set('Cookie', cookieCliente);
    expect(cliente.body.map((s) => s.id)).toContain(idInactivo);

    // Volver a desactivar.
    const desactivar = await request(app)
      .put(`/api/admin/servicios/${idInactivo}`)
      .set('Cookie', cookieAdmin)
      .send({ nombre: 'TEST06S-Reactivado', activo: false });
    expect(desactivar.status).toBe(200);
    expect(desactivar.body.activo).toBe(false);
  });

  test('nombre duplicado (propio o del seed) → 409 SERVICIO_DUPLICADO', async () => {
    const propio = await request(app)
      .post('/api/admin/servicios')
      .set('Cookie', cookieAdmin)
      .send({ nombre: 'TEST06S-Activo' });
    expect(propio.status).toBe(409);
    expect(propio.body.codigo).toBe('SERVICIO_DUPLICADO');

    const delSeed = await request(app)
      .put(`/api/admin/servicios/${idActivo}`)
      .set('Cookie', cookieAdmin)
      .send({ nombre: 'Consulta general' }); // nombre real del seed; no se modifica
    expect(delSeed.status).toBe(409);
  });

  test('validaciones → 400', async () => {
    const sinNombre = await request(app)
      .post('/api/admin/servicios')
      .set('Cookie', cookieAdmin)
      .send({ nombre: '' });
    expect(sinNombre.status).toBe(400);

    const activoInvalido = await request(app)
      .put(`/api/admin/servicios/${idActivo}`)
      .set('Cookie', cookieAdmin)
      .send({ nombre: 'TEST06S-Activo', activo: 'sí' });
    expect(activoInvalido.status).toBe(400);
  });

  test('permisos: sin sesión 401, cliente en /admin/* 403, inexistente 404', async () => {
    const sinSesion = await request(app).get('/api/servicios');
    expect(sinSesion.status).toBe(401);

    const clienteEnAdmin = await request(app)
      .post('/api/admin/servicios')
      .set('Cookie', cookieCliente)
      .send({ nombre: 'TEST06S-NoPuede' });
    expect(clienteEnAdmin.status).toBe(403);

    const inexistente = await request(app)
      .put('/api/admin/servicios/999999')
      .set('Cookie', cookieAdmin)
      .send({ nombre: 'TEST06S-Nada' });
    expect(inexistente.status).toBe(404);
  });
});
