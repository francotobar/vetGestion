// Tests de disponibilidad (BE-07). Aceptación: un feriado, un sábado o una
// fecha pasada devuelven []; una franja con turno pendiente no aparece y, si
// ese turno se cancela, vuelve a aparecer.
//
// No alteran el seed: usuarios "TEST07-*", una mascota propia, turnos propios
// sobre fechas sin turnos del seed (2026-11-09 y 2026-11-10) y limpieza al
// terminar la suite. Los feriados y servicios del seed solo se leen.
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { generarFranjas } = require('../src/utils/fechas');
const servicio = require('../src/modules/turnos/service');

const DOC_CLI = 'TEST07-CLI';
const DOC_ADM = 'TEST07-ADM';
const FECHA_OCUPADA = '2026-11-09'; // lunes (laborable, sin feriados ni turnos del seed)
const FECHA_LIBRE = '2026-11-10'; // martes, sin turnos

async function crearAdmin(documento) {
  const hash = await bcrypt.hash('clave12', 10);
  await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, password_hash, estado_cuenta, consentimiento_at)
     VALUES ('admin', ?, 'Test', 'Disponibilidad', '1100000098', ?, 'con_cuenta', NOW())`,
    [documento, hash]
  );
}

async function cookieDe(documento) {
  const login = await request(app).post('/api/auth/login').send({ documento, password: 'clave12' });
  expect(login.status).toBe(200);
  return login.headers['set-cookie'][0];
}

let cookieCliente;
let cookieAdmin;
let idCliente;
let idMascota;
let idTurnoPendiente;

beforeAll(async () => {
  const registro = await request(app).post('/api/auth/registro').send({
    documento: DOC_CLI,
    nombre: 'Test',
    apellido: 'Disponibilidad',
    telefono: '1100000098',
    password: 'clave12',
    consentimiento: true,
  });
  expect(registro.status).toBe(201);
  await crearAdmin(DOC_ADM);

  cookieCliente = await cookieDe(DOC_CLI);
  cookieAdmin = await cookieDe(DOC_ADM);

  const [[cliente]] = await pool.execute('SELECT id FROM usuarios WHERE documento = ?', [DOC_CLI]);
  idCliente = cliente.id;

  const mascota = await request(app)
    .post('/api/mascotas')
    .set('Cookie', cookieCliente)
    .send({
      nombre: 'Test',
      especie: 'perro',
      raza: 'Mestizo',
      sexo: 'macho',
      fecha_nacimiento: '2020-01-01',
    });
  expect(mascota.status).toBe(201);
  idMascota = mascota.body.id;

  // Un servicio activo del catálogo (referencia de solo lectura, sin modificar).
  const [[servicioActivo]] = await pool.execute(
    'SELECT id FROM servicios WHERE activo = 1 ORDER BY id LIMIT 1'
  );

  // Dos turnos que ocupan franjas del lunes: uno pendiente y otro confirmado.
  const [alta] = await pool.execute(
    `INSERT INTO turnos (usuario_id, mascota_id, servicio_id, fecha_hora, estado, canal, creado_por)
     VALUES (?, ?, ?, ?, 'pendiente', 'web', ?)`,
    [idCliente, idMascota, servicioActivo.id, `${FECHA_OCUPADA} 10:00:00`, idCliente]
  );
  idTurnoPendiente = alta.insertId;
  await pool.execute(
    `INSERT INTO turnos (usuario_id, mascota_id, servicio_id, fecha_hora, estado, canal, creado_por)
     VALUES (?, ?, ?, ?, 'confirmado', 'telefonico', ?)`,
    [idCliente, idMascota, servicioActivo.id, `${FECHA_OCUPADA} 11:00:00`, idCliente]
  );
});

afterAll(async () => {
  // Limpieza en orden inverso a las FK; solo filas TEST07-*.
  await pool.execute(
    'DELETE FROM turnos WHERE usuario_id IN (SELECT id FROM usuarios WHERE documento LIKE ?)',
    ['TEST07-%']
  );
  await pool.execute(
    'DELETE FROM mascotas WHERE usuario_id IN (SELECT id FROM usuarios WHERE documento LIKE ?)',
    ['TEST07-%']
  );
  await pool.execute('DELETE FROM usuarios WHERE documento LIKE ?', ['TEST07-%']);
  await pool.end();
});

describe('disponibilidad', () => {
  test('sábado, domingo, feriado del seed y fecha pasada → []', async () => {
    for (const fecha of ['2026-11-07', '2026-11-08', '2026-12-08', '2020-05-11']) {
      const res = await request(app)
        .get('/api/turnos/disponibilidad')
        .query({ fecha })
        .set('Cookie', cookieCliente);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    }
  });

  test('fecha ausente o inválida → 400; sin sesión → 401; admin también consulta', async () => {
    for (const fecha of [undefined, 'ayer', '2026-13-40']) {
      const consulta = request(app).get('/api/turnos/disponibilidad');
      if (fecha !== undefined) consulta.query({ fecha });
      const res = await consulta.set('Cookie', cookieCliente);
      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('DATOS_INVALIDOS');
    }

    const sinSesion = await request(app).get('/api/turnos/disponibilidad').query({ fecha: FECHA_LIBRE });
    expect(sinSesion.status).toBe(401);

    const comoAdmin = await request(app)
      .get('/api/turnos/disponibilidad')
      .query({ fecha: FECHA_LIBRE })
      .set('Cookie', cookieAdmin);
    expect(comoAdmin.status).toBe(200);
    expect(Array.isArray(comoAdmin.body)).toBe(true);
  });

  test('una franja con turno pendiente o confirmado no aparece; al cancelar el pendiente, vuelve', async () => {
    const antes = await request(app)
      .get('/api/turnos/disponibilidad')
      .query({ fecha: FECHA_OCUPADA })
      .set('Cookie', cookieCliente);
    expect(antes.status).toBe(200);
    expect(antes.body).not.toContain('10:00'); // turno pendiente
    expect(antes.body).not.toContain('11:00'); // turno confirmado
    expect(antes.body.every((h) => generarFranjas().includes(h))).toBe(true);

    // El cliente cancela su turno (BE-08 expondrá PATCH /turnos/:id/cancelar;
    // hasta entonces se simula el mismo UPDATE que hará el service).
    await pool.execute("UPDATE turnos SET estado = 'cancelado', modificado_por = ? WHERE id = ?", [
      idCliente,
      idTurnoPendiente,
    ]);

    const despues = await request(app)
      .get('/api/turnos/disponibilidad')
      .query({ fecha: FECHA_OCUPADA })
      .set('Cookie', cookieCliente);
    expect(despues.status).toBe(200);
    expect(despues.body).toContain('10:00'); // cancelado → la franja se libera
    expect(despues.body).not.toContain('11:00'); // el confirmado sigue ocupando
  });

  test('si el día es hoy, descarta las franjas ya pasadas (servicio con ahora fijo)', async () => {
    // "hoy" simulado: martes 2026-11-10 a las 12:00:30.
    const franjas = await servicio.disponibilidad(FECHA_LIBRE, new Date(2026, 10, 10, 12, 0, 30));
    expect(franjas).toEqual(generarFranjas().filter((h) => h >= '12:30'));

    // Cerrado el día: sin franjas.
    const noche = await servicio.disponibilidad(FECHA_LIBRE, new Date(2026, 10, 10, 23, 59, 59));
    expect(noche).toEqual([]);

    // Una fecha que ya pasó respecto del "ahora" también devuelve [].
    const pasada = await servicio.disponibilidad(FECHA_OCUPADA, new Date(2026, 10, 11, 9, 0, 0));
    expect(pasada).toEqual([]);
  });
});
