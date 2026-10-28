// Tests de crear turno como cliente (BE-08). Aceptación (concurrencia):
// dos usuarios que envían POST /turnos sobre la misma franja libre reciben
// exactamente [201, 409 FRANJA_OCUPADA] y en la BD queda un solo turno.
//
// No alteran el seed: usuarios "TEST08-*", servicios propios "TEST08S-*",
// mascotas propias y fechas sin turnos del seed; limpieza al final.
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const DOC_A = 'TEST08-CLI-A';
const DOC_B = 'TEST08-CLI-B';
const DOC_ADM = 'TEST08-ADM';
const FECHA = '2026-11-12'; // jueves (laborable, sin feriados)
const FRANJA = '09:00';
const FECHA_CONCURRENCIA = '2026-11-11'; // miércoles (laborable)
const FRANJA_CONCURRENCIA = '10:00';

async function crearCliente(documento) {
  const registro = await request(app).post('/api/auth/registro').send({
    documento,
    nombre: 'Test',
    apellido: 'Turnos',
    telefono: '1100000099',
    password: 'clave12',
    consentimiento: true,
  });
  expect(registro.status).toBe(201);
  const login = await request(app).post('/api/auth/login').send({ documento, password: 'clave12' });
  expect(login.status).toBe(200);
  return login.headers['set-cookie'][0];
}

async function crearMascota(cookie) {
  const res = await request(app).post('/api/mascotas').set('Cookie', cookie).send({
    nombre: 'Test',
    especie: 'perro',
    raza: 'Mestizo',
    sexo: 'macho',
    fecha_nacimiento: '2020-01-01',
  });
  expect(res.status).toBe(201);
  return res.body.id;
}

let cookieA;
let cookieB;
let cookieAdmin;
let idMascotaA;
let idMascotaB;
let idServicio;
let idServicioInactivo;

beforeAll(async () => {
  cookieA = await crearCliente(DOC_A);
  cookieB = await crearCliente(DOC_B);
  idMascotaA = await crearMascota(cookieA);
  idMascotaB = await crearMascota(cookieB);

  // Servicios propios de la suite (el catálogo del seed no se toca).
  const [altaActivo] = await pool.execute(
    "INSERT INTO servicios (nombre, descripcion, activo) VALUES ('TEST08S-Activo', 'Test', 1)"
  );
  idServicio = altaActivo.insertId;
  const [altaInactivo] = await pool.execute(
    "INSERT INTO servicios (nombre, descripcion, activo) VALUES ('TEST08S-Inactivo', 'Test', 0)"
  );
  idServicioInactivo = altaInactivo.insertId;

  // Admin propio para el test de permisos (nunca el del seed).
  const hash = await bcrypt.hash('clave12', 10);
  await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, password_hash, estado_cuenta, consentimiento_at)
     VALUES ('admin', ?, 'Test', 'Turnos', '1100000099', ?, 'con_cuenta', NOW())`,
    [DOC_ADM, hash]
  );
  const login = await request(app).post('/api/auth/login').send({ documento: DOC_ADM, password: 'clave12' });
  expect(login.status).toBe(200);
  cookieAdmin = login.headers['set-cookie'][0];
});

afterAll(async () => {
  // Limpieza en orden inverso a las FK; solo filas TEST08-*.
  await pool.execute(
    'DELETE FROM turnos WHERE usuario_id IN (SELECT id FROM usuarios WHERE documento LIKE ?)',
    ['TEST08-%']
  );
  await pool.execute(
    'DELETE FROM mascotas WHERE usuario_id IN (SELECT id FROM usuarios WHERE documento LIKE ?)',
    ['TEST08-%']
  );
  await pool.execute('DELETE FROM servicios WHERE nombre LIKE ?', ['TEST08S-%']);
  await pool.execute('DELETE FROM usuarios WHERE documento LIKE ?', ['TEST08-%']);
  await pool.end();
});

function reservar(cookie, cuerpo) {
  return request(app).post('/api/turnos').set('Cookie', cookie).send(cuerpo);
}

describe('crear turno (cliente)', () => {
  test('reserva válida → 201 pendiente y la franja deja de estar disponible', async () => {
    const res = await reservar(cookieA, {
      mascota_id: idMascotaA,
      servicio_id: idServicio,
      fecha: FECHA,
      hora: FRANJA,
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      mascota_id: idMascotaA,
      servicio_id: idServicio,
      estado: 'pendiente',
      fecha_hora: `${FECHA} ${FRANJA}:00`,
    });
    expect(res.body.id).toBeDefined();

    // Integración con BE-07: la franja reservada ya no figura como libre.
    const disp = await request(app)
      .get('/api/turnos/disponibilidad')
      .query({ fecha: FECHA })
      .set('Cookie', cookieA);
    expect(disp.status).toBe(200);
    expect(disp.body).not.toContain(FRANJA);
  });

  test('la misma franja reservada de nuevo → 409 FRANJA_OCUPADA', async () => {
    const res = await reservar(cookieB, {
      mascota_id: idMascotaB,
      servicio_id: idServicio,
      fecha: FECHA,
      hora: FRANJA,
    });
    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('FRANJA_OCUPADA');
  });

  test('mascota ajena/inactiva y servicio inexistente/inactivo → 404', async () => {
    const ajena = await reservar(cookieA, {
      mascota_id: idMascotaB, // del cliente B
      servicio_id: idServicio,
      fecha: FECHA,
      hora: '10:00',
    });
    expect(ajena.status).toBe(404);

    const inexistente = await reservar(cookieA, {
      mascota_id: 999999,
      servicio_id: idServicio,
      fecha: FECHA,
      hora: '10:00',
    });
    expect(inexistente.status).toBe(404);

    const servicioInexistente = await reservar(cookieA, {
      mascota_id: idMascotaA,
      servicio_id: 999999,
      fecha: FECHA,
      hora: '10:00',
    });
    expect(servicioInexistente.status).toBe(404);

    // Aceptación de BE-06: un servicio inactivo no se puede reservar.
    const servicioInactivo = await reservar(cookieA, {
      mascota_id: idMascotaA,
      servicio_id: idServicioInactivo,
      fecha: FECHA,
      hora: '10:00',
    });
    expect(servicioInactivo.status).toBe(404);
  });

  test('datos con formato inválido → 400', async () => {
    const casos = [
      { servicio_id: idServicio, fecha: FECHA, hora: FRANJA }, // falta mascota_id
      { mascota_id: 0, servicio_id: idServicio, fecha: FECHA, hora: FRANJA },
      { mascota_id: idMascotaA, servicio_id: idServicio, fecha: '2026-13-40', hora: FRANJA },
      { mascota_id: idMascotaA, servicio_id: idServicio, fecha: FECHA, hora: '25:00' },
      { mascota_id: idMascotaA, servicio_id: idServicio, fecha: FECHA, hora: 'a las diez' },
    ];
    for (const cuerpo of casos) {
      const res = await reservar(cookieA, cuerpo);
      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('DATOS_INVALIDOS');
    }
  });

  test('reglas de franja (sección 5) → 422 FRANJA_INVALIDA', async () => {
    const casos = [
      { fecha: '2026-11-14', hora: FRANJA }, // sábado
      { fecha: '2026-12-08', hora: FRANJA }, // feriado del seed (solo lectura)
      { fecha: '2020-05-11', hora: FRANJA }, // fecha pasada (lunes)
      { fecha: FECHA, hora: '12:15' }, // no es una franja del horario
      { fecha: '2099-01-05', hora: FRANJA }, // fuera de DIAS_MAX_RESERVA
    ];
    for (const extra of casos) {
      const res = await reservar(cookieA, {
        mascota_id: idMascotaA,
        servicio_id: idServicio,
        ...extra,
      });
      expect(res.status).toBe(422);
      expect(res.body.codigo).toBe('FRANJA_INVALIDA');
    }
  });

  test('permisos: sin sesión → 401; con sesión de admin → 403', async () => {
    const sinSesion = await request(app).post('/api/turnos').send({
      mascota_id: idMascotaA,
      servicio_id: idServicio,
      fecha: FECHA,
      hora: FRANJA,
    });
    expect(sinSesion.status).toBe(401);

    const comoAdmin = await reservar(cookieAdmin, {
      mascota_id: idMascotaA,
      servicio_id: idServicio,
      fecha: FECHA,
      hora: FRANJA,
    });
    expect(comoAdmin.status).toBe(403);
  });
});

describe('concurrencia (aceptación de BE-08)', () => {
  test('dos POST /turnos simultáneos sobre una franja libre: exactamente uno recibe 201', async () => {
    const cuerpoA = { mascota_id: idMascotaA, servicio_id: idServicio, fecha: FECHA_CONCURRENCIA, hora: FRANJA_CONCURRENCIA };
    const cuerpoB = { mascota_id: idMascotaB, servicio_id: idServicio, fecha: FECHA_CONCURRENCIA, hora: FRANJA_CONCURRENCIA };

    // Ambas peticiones vuelan en paralelo y compiten por el INSERT en MySQL.
    const [r1, r2] = await Promise.all([reservar(cookieA, cuerpoA), reservar(cookieB, cuerpoB)]);

    const estados = [r1.status, r2.status].sort((a, b) => a - b);
    expect(estados).toEqual([201, 409]);

    const perdedor = r1.status === 409 ? r1 : r2;
    expect(perdedor.body.codigo).toBe('FRANJA_OCUPADA');

    // Existe un solo turno en esa franja (los cancelados no cuentan).
    const [[cuenta]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM turnos WHERE fecha_hora = ? AND estado <> 'cancelado'",
      [`${FECHA_CONCURRENCIA} ${FRANJA_CONCURRENCIA}:00`]
    );
    expect(Number(cuenta.total)).toBe(1);
  });
});
