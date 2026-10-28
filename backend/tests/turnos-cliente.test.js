// Tests de Mis turnos, cancelar y reprogramar (cliente, BE-09).
// Aceptación:
// 1. Dado un turno dentro de las próximas 24 h, cuando el cliente intenta cancelar,
//    entonces 422 ANTELACION_INSUFICIENTE.
// 2. Dado un turno a 48 h, cuando reprograma a una franja ocupada,
//    entonces 409 FRANJA_OCUPADA y el turno original queda intacto.
//
// No alteran el seed: prefijo "TEST09-*", mascotas propias, servicios propios
// y limpieza garantizada al final en orden inverso de claves foráneas.
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const DOC_CLIENTE = 'TEST09-CLI';
const DOC_OTRO = 'TEST09-OTRO';
const DOC_ADMIN = 'TEST09-ADM';

async function crearCliente(documento) {
  const reg = await request(app).post('/api/auth/registro').send({
    documento,
    nombre: 'Test',
    apellido: 'Turnos09',
    telefono: '1100000088',
    password: 'clave12',
    consentimiento: true,
  });
  expect(reg.status).toBe(201);
  const log = await request(app).post('/api/auth/login').send({ documento, password: 'clave12' });
  expect(log.status).toBe(200);
  return log.headers['set-cookie'][0];
}

async function crearMascota(cookie, nombre = 'Firulais') {
  const res = await request(app).post('/api/mascotas').set('Cookie', cookie).send({
    nombre,
    especie: 'perro',
    raza: 'Cruza',
    sexo: 'macho',
    fecha_nacimiento: '2021-01-01',
  });
  expect(res.status).toBe(201);
  return res.body.id;
}

let cookieCliente;
let cookieOtro;
let cookieAdmin;
let clienteId;
let otroId;
let mascotaId;
let mascotaOtroId;
let servicioId;

beforeAll(async () => {
  cookieCliente = await crearCliente(DOC_CLIENTE);
  cookieOtro = await crearCliente(DOC_OTRO);

  // Obtener IDs de usuarios creados
  const [[usrCli]] = await pool.execute('SELECT id FROM usuarios WHERE documento = ?', [DOC_CLIENTE]);
  clienteId = usrCli.id;
  const [[usrOtro]] = await pool.execute('SELECT id FROM usuarios WHERE documento = ?', [DOC_OTRO]);
  otroId = usrOtro.id;

  mascotaId = await crearMascota(cookieCliente, 'Mascota09');
  mascotaOtroId = await crearMascota(cookieOtro, 'MascotaOtro09');

  // Servicio propio para la suite
  const [altaServ] = await pool.execute(
    "INSERT INTO servicios (nombre, descripcion, activo) VALUES ('TEST09S-Consulta', 'Servicio test', 1)"
  );
  servicioId = altaServ.insertId;

  // Admin propio para verificar roles
  const hash = await bcrypt.hash('clave12', 10);
  await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, password_hash, estado_cuenta, consentimiento_at)
     VALUES ('admin', ?, 'Admin', 'Test09', '1100000088', ?, 'con_cuenta', NOW())`,
    [DOC_ADMIN, hash]
  );
  const logAdm = await request(app).post('/api/auth/login').send({ documento: DOC_ADMIN, password: 'clave12' });
  expect(logAdm.status).toBe(200);
  cookieAdmin = logAdm.headers['set-cookie'][0];
});

afterAll(async () => {
  // Limpieza en orden inverso de dependencias FK
  await pool.execute(
    'DELETE FROM turnos WHERE usuario_id IN (SELECT id FROM usuarios WHERE documento LIKE ?)',
    ['TEST09-%']
  );
  await pool.execute(
    'DELETE FROM mascotas WHERE usuario_id IN (SELECT id FROM usuarios WHERE documento LIKE ?)',
    ['TEST09-%']
  );
  await pool.execute('DELETE FROM servicios WHERE nombre LIKE ?', ['TEST09S-%']);
  await pool.execute('DELETE FROM usuarios WHERE documento LIKE ?', ['TEST09-%']);
  await pool.end();
});

// Helper para insertar turnos con estados y fechas específicos
async function insertarTurnoDirecto({ usuarioId, mascotaId, servicioId, fechaHora, estado, canal = 'web' }) {
  const [res] = await pool.execute(
    `INSERT INTO turnos (usuario_id, mascota_id, servicio_id, fecha_hora, estado, canal, creado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [usuarioId, mascotaId, servicioId, fechaHora, estado, canal, usuarioId]
  );
  return res.insertId;
}

describe('GET /turnos/mios (cliente)', () => {
  test('devuelve solo los turnos del cliente autenticado con mascota y servicio', async () => {
    // Insertamos un turno para el cliente y otro para "otro"
    await insertarTurnoDirecto({
      usuarioId: clienteId,
      mascotaId,
      servicioId,
      fechaHora: '2026-11-20 10:00:00',
      estado: 'pendiente',
    });
    await insertarTurnoDirecto({
      usuarioId: otroId,
      mascotaId: mascotaOtroId,
      servicioId,
      fechaHora: '2026-11-20 11:00:00',
      estado: 'pendiente',
    });

    const res = await request(app).get('/api/turnos/mios').set('Cookie', cookieCliente);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    // Todos los turnos deben corresponder a mascotaId del cliente y mostrar nombre de mascota y servicio
    for (const t of res.body) {
      expect(t.mascota_id).toBe(mascotaId);
      expect(t.mascota_nombre).toBe('Mascota09');
      expect(t.servicio_nombre).toBe('TEST09S-Consulta');
    }
  });

  test('sin sesión → 401; admin → 403', async () => {
    const sinSesion = await request(app).get('/api/turnos/mios');
    expect(sinSesion.status).toBe(401);

    const comoAdmin = await request(app).get('/api/turnos/mios').set('Cookie', cookieAdmin);
    expect(comoAdmin.status).toBe(403);
  });
});

describe('PATCH /turnos/:id/cancelar (cliente)', () => {
  test('criterio de aceptación 1: turno a < 24 h → 422 ANTELACION_INSUFICIENTE', async () => {
    // Calculamos una fechaHora dentro de las próximas 10 horas en un día hábil
    // Usamos el turno directamente en BD: por ejemplo, hoy + 5 horas
    const ahora = new Date();
    const dentroDe5Hs = new Date(ahora.getTime() + 5 * 3600 * 1000);
    const fechaHoraStr = dentroDe5Hs.toISOString().slice(0, 19).replace('T', ' ');

    const turnoId = await insertarTurnoDirecto({
      usuarioId: clienteId,
      mascotaId,
      servicioId,
      fechaHora: fechaHoraStr,
      estado: 'pendiente',
    });

    const res = await request(app)
      .patch(`/api/turnos/${turnoId}/cancelar`)
      .set('Cookie', cookieCliente);

    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('ANTELACION_INSUFICIENTE');

    // El estado del turno sigue siendo pendiente
    const [[turnoBD]] = await pool.execute('SELECT estado FROM turnos WHERE id = ?', [turnoId]);
    expect(turnoBD.estado).toBe('pendiente');
  });

  test('turno con antelación suficiente (≥ 24 h) → 200 cancelado y libera la franja', async () => {
    // Jueves laborable con fecha fija futura
    const turnoId = await insertarTurnoDirecto({
      usuarioId: clienteId,
      mascotaId,
      servicioId,
      fechaHora: '2026-11-26 14:00:00',
      estado: 'confirmado',
    });

    const res = await request(app)
      .patch(`/api/turnos/${turnoId}/cancelar`)
      .set('Cookie', cookieCliente);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(turnoId);
    expect(res.body.estado).toBe('cancelado');

    const [[turnoBD]] = await pool.execute(
      'SELECT estado, fecha_hora_activa, modificado_por FROM turnos WHERE id = ?',
      [turnoId]
    );
    expect(turnoBD.estado).toBe('cancelado');
    expect(turnoBD.fecha_hora_activa).toBeNull();
    expect(turnoBD.modificado_por).toBe(clienteId);

    // La disponibilidad de esa franja debe estar libre ahora
    const disp = await request(app)
      .get('/api/turnos/disponibilidad')
      .query({ fecha: '2026-11-26' })
      .set('Cookie', cookieCliente);
    expect(disp.status).toBe(200);
    expect(disp.body).toContain('14:00');
  });

  test('turno en estado atendido o ya cancelado → 422 TRANSICION_INVALIDA', async () => {
    const turnoAtendidoId = await insertarTurnoDirecto({
      usuarioId: clienteId,
      mascotaId,
      servicioId,
      fechaHora: '2026-11-26 15:00:00',
      estado: 'atendido',
    });

    const res = await request(app)
      .patch(`/api/turnos/${turnoAtendidoId}/cancelar`)
      .set('Cookie', cookieCliente);

    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('TRANSICION_INVALIDA');
  });

  test('turno ajeno o inexistente → 404 NO_ENCONTRADO (no filtra información)', async () => {
    const turnoOtro = await insertarTurnoDirecto({
      usuarioId: otroId,
      mascotaId: mascotaOtroId,
      servicioId,
      fechaHora: '2026-11-26 16:00:00',
      estado: 'pendiente',
    });

    const resAjeno = await request(app)
      .patch(`/api/turnos/${turnoOtro}/cancelar`)
      .set('Cookie', cookieCliente);
    expect(resAjeno.status).toBe(404);
    expect(resAjeno.body.codigo).toBe('NO_ENCONTRADO');

    const resInexistente = await request(app)
      .patch('/api/turnos/999999/cancelar')
      .set('Cookie', cookieCliente);
    expect(resInexistente.status).toBe(404);
  });
});

describe('PATCH /turnos/:id/reprogramar (cliente)', () => {
  test('criterio de aceptación 2: a 48 h, reprogramar a franja ocupada → 409 FRANJA_OCUPADA y original intacto', async () => {
    const fechaOriginal = '2026-11-24';
    const horaOriginal = '09:00';
    const fechaOcupada = '2026-11-24';
    const horaOcupada = '10:00';

    // Turno que queremos reprogramar
    const turnoId = await insertarTurnoDirecto({
      usuarioId: clienteId,
      mascotaId,
      servicioId,
      fechaHora: `${fechaOriginal} ${horaOriginal}:00`,
      estado: 'confirmado',
    });

    // Franja de destino ya ocupada por otro turno
    await insertarTurnoDirecto({
      usuarioId: otroId,
      mascotaId: mascotaOtroId,
      servicioId,
      fechaHora: `${fechaOcupada} ${horaOcupada}:00`,
      estado: 'confirmado',
    });

    const res = await request(app)
      .patch(`/api/turnos/${turnoId}/reprogramar`)
      .set('Cookie', cookieCliente)
      .send({ fecha: fechaOcupada, hora: horaOcupada });

    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('FRANJA_OCUPADA');

    // Verificar que el turno original quedó INTACTO
    const [[turnoBD]] = await pool.execute('SELECT fecha_hora, estado FROM turnos WHERE id = ?', [
      turnoId,
    ]);
    expect(turnoBD.fecha_hora).toBe(`${fechaOriginal} ${horaOriginal}:00`);
    expect(turnoBD.estado).toBe('confirmado');
  });

  test('reprogramación exitosa con ≥ 24 h → 200, vuelve a estado "pendiente" y actualiza la franja', async () => {
    const fechaOriginal = '2026-11-25';
    const horaOriginal = '09:00';
    const nuevaFecha = '2026-11-25';
    const nuevaHora = '11:00';

    const turnoId = await insertarTurnoDirecto({
      usuarioId: clienteId,
      mascotaId,
      servicioId,
      fechaHora: `${fechaOriginal} ${horaOriginal}:00`,
      estado: 'confirmado', // Estaba confirmado, al reprogramar cliente debe pasar a pendiente
    });

    const res = await request(app)
      .patch(`/api/turnos/${turnoId}/reprogramar`)
      .set('Cookie', cookieCliente)
      .send({ fecha: nuevaFecha, hora: nuevaHora });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(turnoId);
    expect(res.body.estado).toBe('pendiente');
    expect(res.body.fecha_hora).toBe(`${nuevaFecha} ${nuevaHora}:00`);

    const [[turnoBD]] = await pool.execute(
      'SELECT fecha_hora, estado, modificado_por FROM turnos WHERE id = ?',
      [turnoId]
    );
    expect(turnoBD.fecha_hora).toBe(`${nuevaFecha} ${nuevaHora}:00`);
    expect(turnoBD.estado).toBe('pendiente');
    expect(turnoBD.modificado_por).toBe(clienteId);

    // La franja original (09:00) quedó libre
    const disp = await request(app)
      .get('/api/turnos/disponibilidad')
      .query({ fecha: fechaOriginal })
      .set('Cookie', cookieCliente);
    expect(disp.status).toBe(200);
    expect(disp.body).toContain(horaOriginal);
    expect(disp.body).not.toContain(nuevaHora);
  });

  test('antelación insuficiente en reprogramación (< 24 h) → 422 ANTELACION_INSUFICIENTE', async () => {
    const ahora = new Date();
    const dentroDe5Hs = new Date(ahora.getTime() + 5 * 3600 * 1000);
    const fechaHoraStr = dentroDe5Hs.toISOString().slice(0, 19).replace('T', ' ');

    const turnoId = await insertarTurnoDirecto({
      usuarioId: clienteId,
      mascotaId,
      servicioId,
      fechaHora: fechaHoraStr,
      estado: 'pendiente',
    });

    const res = await request(app)
      .patch(`/api/turnos/${turnoId}/reprogramar`)
      .set('Cookie', cookieCliente)
      .send({ fecha: '2026-11-27', hora: '10:00' });

    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('ANTELACION_INSUFICIENTE');
  });

  test('nueva fecha inválida (feriado o fin de semana) → 422 FRANJA_INVALIDA', async () => {
    const turnoId = await insertarTurnoDirecto({
      usuarioId: clienteId,
      mascotaId,
      servicioId,
      fechaHora: '2026-11-27 10:00:00',
      estado: 'pendiente',
    });

    const resSabado = await request(app)
      .patch(`/api/turnos/${turnoId}/reprogramar`)
      .set('Cookie', cookieCliente)
      .send({ fecha: '2026-11-28', hora: '10:00' }); // sábado
    expect(resSabado.status).toBe(422);
    expect(resSabado.body.codigo).toBe('FRANJA_INVALIDA');

    const resFeriado = await request(app)
      .patch(`/api/turnos/${turnoId}/reprogramar`)
      .set('Cookie', cookieCliente)
      .send({ fecha: '2026-12-08', hora: '10:00' }); // feriado del seed
    expect(resFeriado.status).toBe(422);
    expect(resFeriado.body.codigo).toBe('FRANJA_INVALIDA');
  });

  test('datos mal formateados en el body → 400 DATOS_INVALIDOS', async () => {
    const turnoId = await insertarTurnoDirecto({
      usuarioId: clienteId,
      mascotaId,
      servicioId,
      fechaHora: '2026-11-27 11:00:00',
      estado: 'pendiente',
    });

    const res = await request(app)
      .patch(`/api/turnos/${turnoId}/reprogramar`)
      .set('Cookie', cookieCliente)
      .send({ fecha: 'fecha-invalida', hora: '99:99' });

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('DATOS_INVALIDOS');
  });

  test('reprogramar turno ajeno → 404 NO_ENCONTRADO', async () => {
    const turnoOtro = await insertarTurnoDirecto({
      usuarioId: otroId,
      mascotaId: mascotaOtroId,
      servicioId,
      fechaHora: '2026-11-27 12:00:00',
      estado: 'pendiente',
    });

    const res = await request(app)
      .patch(`/api/turnos/${turnoOtro}/reprogramar`)
      .set('Cookie', cookieCliente)
      .send({ fecha: '2026-11-27', hora: '14:00' });

    expect(res.status).toBe(404);
    expect(res.body.codigo).toBe('NO_ENCONTRADO');
  });
});
