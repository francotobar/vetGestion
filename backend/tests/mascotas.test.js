// Tests del CRUD de mascotas (BE-05). Regla de aceptación: un cliente no ve
// ni toca las mascotas de otro cliente (404, nunca 403).
//
// No alteran el seed: usuarios con prefijo "TEST05-", creados por la API de
// registro y eliminados con sus mascotas al terminar la suite.
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const DOC_A = 'TEST05-CLI-A';
const DOC_B = 'TEST05-CLI-B';
const DOC_ADMIN = 'TEST05-ADM';

const MASCOTA = {
  nombre: 'Firu',
  especie: 'perro',
  raza: 'Mestizo',
  sexo: 'macho',
  fecha_nacimiento: '2020-05-10',
  peso_kg: 12.5,
  esterilizado: true,
  microchip: '981098101234567',
  alergias_condiciones: 'Ninguna',
};

async function crearCliente(documento) {
  const registro = await request(app).post('/api/auth/registro').send({
    documento,
    nombre: 'Test',
    apellido: 'Mascotas',
    telefono: '1100000095',
    password: 'clave12',
    consentimiento: true,
  });
  expect(registro.status).toBe(201);

  const login = await request(app).post('/api/auth/login').send({ documento, password: 'clave12' });
  expect(login.status).toBe(200);
  return login.headers['set-cookie'][0];
}

// Admin propio de la suite: no se usa el del seed para no tocar sus datos.
async function crearAdmin(documento) {
  const hash = await bcrypt.hash('clave12', 10);
  await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, password_hash, estado_cuenta, consentimiento_at)
     VALUES ('admin', ?, 'Test', 'Mascotas', '1100000095', ?, 'con_cuenta', NOW())`,
    [documento, hash]
  );
  const login = await request(app).post('/api/auth/login').send({ documento, password: 'clave12' });
  expect(login.status).toBe(200);
  return login.headers['set-cookie'][0];
}

let cookieA;
let cookieB;
let cookieAdmin;
let idPropia;
let idAjena;

beforeAll(async () => {
  cookieA = await crearCliente(DOC_A);
  cookieB = await crearCliente(DOC_B);
  cookieAdmin = await crearAdmin(DOC_ADMIN);

  const propia = await request(app).post('/api/mascotas').set('Cookie', cookieA).send(MASCOTA);
  expect(propia.status).toBe(201);
  idPropia = propia.body.id;

  const ajena = await request(app)
    .post('/api/mascotas')
    .set('Cookie', cookieB)
    .send({ ...MASCOTA, nombre: 'Ajena' });
  expect(ajena.status).toBe(201);
  idAjena = ajena.body.id;
});

afterAll(async () => {
  // Limpieza en orden inverso a las FK; solo filas TEST05-*.
  await pool.execute(
    'DELETE FROM mascotas WHERE usuario_id IN (SELECT id FROM usuarios WHERE documento LIKE ?)',
    ['TEST05-%']
  );
  await pool.execute('DELETE FROM usuarios WHERE documento LIKE ?', ['TEST05-%']);
  await pool.end();
});

describe('CRUD de mascotas propias', () => {
  test('alta, listado, edición y baja lógica', async () => {
    // Alta (ya hecha en beforeAll): se refleja en el listado y en la ficha.
    const lista = await request(app).get('/api/mascotas').set('Cookie', cookieA);
    expect(lista.status).toBe(200);
    expect(lista.body.map((m) => m.id)).toContain(idPropia);

    const ficha = await request(app).get(`/api/mascotas/${idPropia}`).set('Cookie', cookieA);
    expect(ficha.status).toBe(200);
    expect(ficha.body).toMatchObject({ nombre: 'Firu', especie: 'perro', sexo: 'macho' });
    expect(ficha.body.esterilizado).toBe(true);
    expect(ficha.body.fecha_nacimiento).toBe('2020-05-10');

    // Edición
    const edicion = await request(app)
      .put(`/api/mascotas/${idPropia}`)
      .set('Cookie', cookieA)
      .send({ ...MASCOTA, nombre: 'Firulfo', peso_kg: 13.2 });
    expect(edicion.status).toBe(200);
    expect(edicion.body.nombre).toBe('Firulfo');
    expect(edicion.body.peso_kg).toBeCloseTo(13.2);

    // Baja lógica: desaparece del listado y la ficha responde 404.
    const baja = await request(app).delete(`/api/mascotas/${idPropia}`).set('Cookie', cookieA);
    expect(baja.status).toBe(200);

    const trasBaja = await request(app).get(`/api/mascotas/${idPropia}`).set('Cookie', cookieA);
    expect(trasBaja.status).toBe(404);

    const listaTrasBaja = await request(app).get('/api/mascotas').set('Cookie', cookieA);
    expect(listaTrasBaja.body.map((m) => m.id)).not.toContain(idPropia);

    // La baja es lógica: la fila sigue existiendo en la BD (solo activa = 0).
    const [[fila]] = await pool.execute('SELECT activa FROM mascotas WHERE id = ?', [idPropia]);
    expect(fila.activa).toBe(0);
  });

  test('validaciones de la ficha → 400', async () => {
    const casos = [
      { ...MASCOTA, especie: 'loro' },
      { ...MASCOTA, sexo: 'desconocido' },
      { ...MASCOTA, fecha_nacimiento: '2999-12-31' }, // futura
      { ...MASCOTA, fecha_nacimiento: '10/05/2020' }, // formato inválido
      { ...MASCOTA, peso_kg: 0 },
      { ...MASCOTA, peso_kg: -3 },
      { ...MASCOTA, nombre: '' },
    ];
    for (const cuerpo of casos) {
      const res = await request(app).post('/api/mascotas').set('Cookie', cookieA).send(cuerpo);
      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('DATOS_INVALIDOS');
    }
  });
});

describe('mascotas ajenas (regla de la sección 6)', () => {
  test('el cliente A no puede ver, editar ni dar de baja la mascota del cliente B → 404', async () => {
    const ver = await request(app).get(`/api/mascotas/${idAjena}`).set('Cookie', cookieA);
    expect(ver.status).toBe(404);
    expect(ver.status).not.toBe(403);

    const editar = await request(app)
      .put(`/api/mascotas/${idAjena}`)
      .set('Cookie', cookieA)
      .send({ ...MASCOTA, nombre: 'Hackeada' });
    expect(editar.status).toBe(404);

    const borrar = await request(app).delete(`/api/mascotas/${idAjena}`).set('Cookie', cookieA);
    expect(borrar.status).toBe(404);

    // La mascota de B sigue intacta y activa.
    const fichaB = await request(app).get(`/api/mascotas/${idAjena}`).set('Cookie', cookieB);
    expect(fichaB.status).toBe(200);
    expect(fichaB.body.nombre).toBe('Ajena');
    const [[fila]] = await pool.execute('SELECT activa FROM mascotas WHERE id = ?', [idAjena]);
    expect(fila.activa).toBe(1);
  });

  test('sin sesión → 401; con sesión de admin → 403', async () => {
    const sinSesion = await request(app).get('/api/mascotas');
    expect(sinSesion.status).toBe(401);

    const comoAdmin = await request(app).get('/api/mascotas').set('Cookie', cookieAdmin);
    expect(comoAdmin.status).toBe(403);
  });
});
