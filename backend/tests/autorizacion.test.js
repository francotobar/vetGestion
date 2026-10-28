// Tests de autorización (BE-04): un cliente no puede llamar a /admin/* (403)
// ni ver recursos ajenos (404, nunca 403 — sección 6 del plan).
//
// Los endpoints reales de admin (BE-10) y de mascotas (BE-05) todavía no
// existen: acá se montan rutas mínimas SOLO para probar los middlewares
// auth y roles, reutilizando el router real de /api/auth para las sesiones.
//
// Regla: no alteran los datos del seed. Usuarios con prefijo "TEST04-",
// eliminados al terminar la suite.
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');
const { auth } = require('../src/middlewares/auth');
const { roles } = require('../src/middlewares/roles');
const { manejarErrores } = require('../src/middlewares/errores');

// --- App mínima solo para el test -----------------------------------------
const appPrueba = express();
appPrueba.use(express.json());
appPrueba.use(cookieParser());
appPrueba.use('/api/auth', require('../src/modules/auth/routes'));

// Ruta mínima tipo /api/admin/* (cuando exista BE-10 llevará este middleware).
appPrueba.get('/api/admin/clientes', auth, roles('admin'), (req, res) => {
  res.json({ ok: true, rol: req.usuario.rol });
});

// Ruta mínima tipo mascota propia (cuando exista BE-05 llevará esta regla):
// filtra siempre por req.usuario.id; un recurso ajeno responde 404.
appPrueba.get('/api/mascotas/:id', auth, roles('cliente'), async (req, res, next) => {
  try {
    const [[mascota]] = await pool.execute(
      'SELECT id FROM mascotas WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.usuario.id]
    );
    if (!mascota) {
      return res.status(404).json({ codigo: 'NO_ENCONTRADO', mensaje: 'La mascota no existe' });
    }
    res.json({ id: mascota.id });
  } catch (err) {
    next(err);
  }
});

appPrueba.use(manejarErrores);

// --- Datos propios de la suite --------------------------------------------
const DOC_CLIENTE = 'TEST04-CLI';
const DOC_ADMIN = 'TEST04-ADM';
const DOC_OTRO = 'TEST04-OTRO';

let idCliente;
let idMascotaPropia;
let idMascotaAjena;
let cookieCliente;
let cookieAdmin;

async function crearUsuario(documento, rol) {
  const hash = await bcrypt.hash('clave12', 10);
  const [alta] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, password_hash, estado_cuenta, consentimiento_at)
     VALUES (?, ?, 'Test', 'Autorizacion', '1100000090', ?, 'con_cuenta', NOW())`,
    [rol, documento, hash]
  );
  return alta.insertId;
}

async function crearMascota(usuarioId, nombre) {
  const [alta] = await pool.execute(
    `INSERT INTO mascotas (usuario_id, nombre, especie, raza, sexo, fecha_nacimiento)
     VALUES (?, ?, 'perro', 'Mestizo', 'macho', '2024-01-15')`,
    [usuarioId, nombre]
  );
  return alta.insertId;
}

async function cookieDe(documento) {
  const login = await request(appPrueba)
    .post('/api/auth/login')
    .send({ documento, password: 'clave12' });
  expect(login.status).toBe(200);
  return login.headers['set-cookie'][0];
}

beforeAll(async () => {
  idCliente = await crearUsuario(DOC_CLIENTE, 'cliente');
  const idAdmin = await crearUsuario(DOC_ADMIN, 'admin');
  const idOtro = await crearUsuario(DOC_OTRO, 'cliente');
  idMascotaPropia = await crearMascota(idCliente, 'Mascota Propia');
  idMascotaAjena = await crearMascota(idOtro, 'Mascota Ajena');
  cookieCliente = await cookieDe(DOC_CLIENTE);
  cookieAdmin = await cookieDe(DOC_ADMIN);
});

afterAll(async () => {
  // Limpieza en orden inverso a las FK; solo toca filas TEST04-*.
  await pool.execute(
    'DELETE FROM mascotas WHERE usuario_id IN (SELECT id FROM usuarios WHERE documento LIKE ?)',
    ['TEST04-%']
  );
  await pool.execute('DELETE FROM usuarios WHERE documento LIKE ?', ['TEST04-%']);
  await pool.end();
});

describe('autorización por rol (/admin/*)', () => {
  test('sin sesión responde 401 NO_AUTENTICADO', async () => {
    const res = await request(appPrueba).get('/api/admin/clientes');
    expect(res.status).toBe(401);
    expect(res.body.codigo).toBe('NO_AUTENTICADO');
  });

  test('un cliente no puede llamar a /admin/* → 403 SIN_PERMISO', async () => {
    const res = await request(appPrueba).get('/api/admin/clientes').set('Cookie', cookieCliente);
    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('SIN_PERMISO');
  });

  test('un admin sí puede llamar a /admin/* (control positivo)', async () => {
    const res = await request(appPrueba).get('/api/admin/clientes').set('Cookie', cookieAdmin);
    expect(res.status).toBe(200);
    expect(res.body.rol).toBe('admin');
  });
});

describe('recursos ajenos (404, no 403)', () => {
  test('el cliente ve su propia mascota', async () => {
    const res = await request(appPrueba)
      .get(`/api/mascotas/${idMascotaPropia}`)
      .set('Cookie', cookieCliente);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(idMascotaPropia);
  });

  test('la mascota de otro cliente responde 404 y nunca 403', async () => {
    const res = await request(appPrueba)
      .get(`/api/mascotas/${idMascotaAjena}`)
      .set('Cookie', cookieCliente);
    expect(res.status).toBe(404);
    expect(res.status).not.toBe(403);
    expect(res.body.codigo).toBe('NO_ENCONTRADO');
  });

  test('sin sesión, la mascota propia también es 401', async () => {
    const res = await request(appPrueba).get(`/api/mascotas/${idMascotaPropia}`);
    expect(res.status).toBe(401);
  });
});
