// Tests de feriados (BE-06). RF23: el admin da de alta y de baja; el
// cliente/admin consulta la lista.
//
// No alteran el seed: usuarios "TEST06F-*" y un feriado propio
// (2026-11-10) que se elimina en la propia prueba y en la limpieza final.
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const DOC_ADMIN = 'TEST06F-ADM';
const DOC_CLI = 'TEST06F-CLI';
const FERIADO_PROPIO = '2026-11-10';

async function crearAdmin(documento) {
  const hash = await bcrypt.hash('clave12', 10);
  await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, password_hash, estado_cuenta, consentimiento_at)
     VALUES ('admin', ?, 'Test', 'Feriados', '1100000097', ?, 'con_cuenta', NOW())`,
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

beforeAll(async () => {
  await crearAdmin(DOC_ADMIN);
  const registro = await request(app).post('/api/auth/registro').send({
    documento: DOC_CLI,
    nombre: 'Test',
    apellido: 'Feriados',
    telefono: '1100000097',
    password: 'clave12',
    consentimiento: true,
  });
  expect(registro.status).toBe(201);

  cookieAdmin = await cookieDe(DOC_ADMIN);
  cookieCliente = await cookieDe(DOC_CLI);
});

afterAll(async () => {
  await pool.execute('DELETE FROM feriados WHERE fecha = ?', [FERIADO_PROPIO]);
  await pool.execute('DELETE FROM usuarios WHERE documento LIKE ?', ['TEST06F-%']);
  await pool.end();
});

describe('feriados', () => {
  test('alta por el admin y listado (aparece para el cliente, con los del seed)', async () => {
    const alta = await request(app)
      .post('/api/admin/feriados')
      .set('Cookie', cookieAdmin)
      .send({ fecha: FERIADO_PROPIO, motivo: 'TEST06F feriado de prueba' });
    expect(alta.status).toBe(201);
    expect(alta.body).toEqual({ fecha: FERIADO_PROPIO, motivo: 'TEST06F feriado de prueba' });

    const lista = await request(app).get('/api/feriados').set('Cookie', cookieCliente);
    expect(lista.status).toBe(200);

    const fechas = lista.body.map((f) => f.fecha);
    expect(fechas).toContain(FERIADO_PROPIO);
    // Los feriados del seed siguen intactos (solo lectura).
    expect(fechas).toContain('2026-12-08');
    expect(fechas).toContain('2026-12-25');
    // Ordenados por fecha.
    expect([...fechas].sort()).toEqual(fechas);
  });

  test('fecha duplicada (propia o del seed) → 409 FERIADO_DUPLICADO', async () => {
    const delSeed = await request(app)
      .post('/api/admin/feriados')
      .set('Cookie', cookieAdmin)
      .send({ fecha: '2026-12-25', motivo: 'Otro Navidad' }); // no se modifica el seed
    expect(delSeed.status).toBe(409);
    expect(delSeed.body.codigo).toBe('FERIADO_DUPLICADO');

    const propio = await request(app)
      .post('/api/admin/feriados')
      .set('Cookie', cookieAdmin)
      .send({ fecha: FERIADO_PROPIO, motivo: 'Repetido' });
    expect(propio.status).toBe(409);
  });

  test('baja: se elimina, desaparece de la lista y repetir da 404', async () => {
    const baja = await request(app)
      .delete(`/api/admin/feriados/${FERIADO_PROPIO}`)
      .set('Cookie', cookieAdmin);
    expect(baja.status).toBe(200);

    const lista = await request(app).get('/api/feriados').set('Cookie', cookieCliente);
    expect(lista.body.map((f) => f.fecha)).not.toContain(FERIADO_PROPIO);

    const repetir = await request(app)
      .delete(`/api/admin/feriados/${FERIADO_PROPIO}`)
      .set('Cookie', cookieAdmin);
    expect(repetir.status).toBe(404);
  });

  test('validaciones → 400 y fecha inexistente → 404', async () => {
    const fechaInvalida = await request(app)
      .post('/api/admin/feriados')
      .set('Cookie', cookieAdmin)
      .send({ fecha: '2026-13-40', motivo: 'No existe' });
    expect(fechaInvalida.status).toBe(400);

    const sinMotivo = await request(app)
      .post('/api/admin/feriados')
      .set('Cookie', cookieAdmin)
      .send({ fecha: FERIADO_PROPIO, motivo: '' });
    expect(sinMotivo.status).toBe(400);

    const rutaInvalida = await request(app)
      .delete('/api/admin/feriados/no-es-fecha')
      .set('Cookie', cookieAdmin);
    expect(rutaInvalida.status).toBe(400);

    const inexistente = await request(app)
      .delete('/api/admin/feriados/1900-01-01')
      .set('Cookie', cookieAdmin);
    expect(inexistente.status).toBe(404);
  });

  test('permisos: sin sesión 401 en la lista y cliente en /admin/* 403', async () => {
    const sinSesion = await request(app).get('/api/feriados');
    expect(sinSesion.status).toBe(401);

    const clienteEnAdmin = await request(app)
      .post('/api/admin/feriados')
      .set('Cookie', cookieCliente)
      .send({ fecha: '2026-11-11', motivo: 'No puede' });
    expect(clienteEnAdmin.status).toBe(403);
  });
});
