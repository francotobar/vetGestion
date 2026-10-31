// Tests para BE-11: Estados, reprogramación admin y urgencias.
// PATCH /api/admin/turnos/:id/estado
// PATCH /api/admin/turnos/:id/reprogramar
// POST /api/admin/turnos/:id/urgencia
//
// Criterios de aceptación:
// - Dado un turno atendido, cuando se intenta cancelar, entonces 422 TRANSICION_INVALIDA.
// - Dado una urgencia con acción cancelar, entonces el turno queda cancelado con es_urgencia=1,
//   el motivo guardado, y la respuesta incluye el teléfono del cliente.
//
// Reglas del plan y requerimientos de usuario:
// - Datos propios con prefijo único (TEST11-).
// - Fechas únicas por test (evitar colisiones y respetar franjas válidas).
// - Limpieza de datos en afterAll.
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const DOC_ADMIN = 'TEST11-ADM';
const DOC_CLIENTE = 'TEST11-CLI';

let adminId;
let clienteId;
let mascotaId;
let servicioId;
let cookieAdmin;
let cookieCliente;

// Helper para crear turnos de prueba directamente en la base
async function insertarTurno({
  fechaHora,
  estado = 'pendiente',
  canal = 'web',
  esUrgencia = 0,
  motivo = null,
}) {
  const [res] = await pool.execute(
    `INSERT INTO turnos (usuario_id, mascota_id, servicio_id, fecha_hora, estado, canal, es_urgencia, motivo, creado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [clienteId, mascotaId, servicioId, fechaHora, estado, canal, esUrgencia, motivo, clienteId]
  );
  return res.insertId;
}

beforeAll(async () => {
  const hash = await bcrypt.hash('clave12', 4);

  // Admin propio
  const [adm] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, email, password_hash, estado_cuenta)
     VALUES ('admin', ?, 'AdminTest11', 'Root', '1144440000', 'adm11@test.com', ?, 'con_cuenta')`,
    [DOC_ADMIN, hash]
  );
  adminId = adm.insertId;

  // Cliente propio
  const [cli] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, email, password_hash, estado_cuenta)
     VALUES ('cliente', ?, 'ClienteTest11', 'Lopez', '1155556666', 'cli11@test.com', ?, 'con_cuenta')`,
    [DOC_CLIENTE, hash]
  );
  clienteId = cli.insertId;

  // Mascota propia
  const [masc] = await pool.execute(
    `INSERT INTO mascotas (usuario_id, nombre, especie, raza, sexo, fecha_nacimiento, creado_por)
     VALUES (?, 'Bobi11', 'perro', 'Labrador', 'macho', '2020-01-01', ?)`,
    [clienteId, clienteId]
  );
  mascotaId = masc.insertId;

  // Servicio propio
  const [srv] = await pool.execute(
    `INSERT INTO servicios (nombre, descripcion, activo)
     VALUES ('TEST11S-Clinica', 'Consulta clinica 11', 1)`
  );
  servicioId = srv.insertId;

  // Login admin
  const logAdm = await request(app).post('/api/auth/login').send({ documento: DOC_ADMIN, password: 'clave12' });
  expect(logAdm.status).toBe(200);
  cookieAdmin = logAdm.headers['set-cookie'][0];

  // Login cliente
  const logCli = await request(app).post('/api/auth/login').send({ documento: DOC_CLIENTE, password: 'clave12' });
  expect(logCli.status).toBe(200);
  cookieCliente = logCli.headers['set-cookie'][0];
});

afterAll(async () => {
  await pool.execute(
    'DELETE FROM turnos WHERE usuario_id IN (SELECT id FROM usuarios WHERE documento LIKE ?)',
    ['TEST11-%']
  );
  await pool.execute(
    'DELETE FROM turnos WHERE creado_por IN (SELECT id FROM usuarios WHERE documento LIKE ?)',
    ['TEST11-%']
  );
  await pool.execute(
    'DELETE FROM mascotas WHERE usuario_id IN (SELECT id FROM usuarios WHERE documento LIKE ?)',
    ['TEST11-%']
  );
  await pool.execute('DELETE FROM servicios WHERE nombre LIKE ?', ['TEST11S-%']);
  await pool.execute('DELETE FROM usuarios WHERE documento LIKE ?', ['TEST11-%']);
  await pool.end();
});

describe('Autorización en endpoints de admin BE-11', () => {
  test('un cliente no puede cambiar estado (403)', async () => {
    const res = await request(app)
      .patch('/api/admin/turnos/9999/estado')
      .set('Cookie', cookieCliente)
      .send({ estado: 'confirmado' });
    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('SIN_PERMISO');
  });

  test('un cliente no puede reprogramar como admin (403)', async () => {
    const res = await request(app)
      .patch('/api/admin/turnos/9999/reprogramar')
      .set('Cookie', cookieCliente)
      .send({ fecha: '2026-11-20', hora: '10:00' });
    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('SIN_PERMISO');
  });

  test('un cliente no puede registrar urgencia (403)', async () => {
    const res = await request(app)
      .post('/api/admin/turnos/9999/urgencia')
      .set('Cookie', cookieCliente)
      .send({ accion: 'cancelar', motivo: 'Urgencia perro atropellado' });
    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('SIN_PERMISO');
  });
});

describe('PATCH /api/admin/turnos/:id/estado (cambiarEstado)', () => {
  test('transición válida: pendiente -> confirmado', async () => {
    const turnoId = await insertarTurno({ fechaHora: '2026-11-02 09:00:00', estado: 'pendiente' });

    const res = await request(app)
      .patch(`/api/admin/turnos/${turnoId}/estado`)
      .set('Cookie', cookieAdmin)
      .send({ estado: 'confirmado' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(turnoId);
    expect(res.body.estado).toBe('confirmado');
    expect(res.body.modificado_por).toBe(adminId);
  });

  test('transición válida: confirmado -> atendido', async () => {
    const turnoId = await insertarTurno({ fechaHora: '2026-11-02 09:30:00', estado: 'confirmado' });

    const res = await request(app)
      .patch(`/api/admin/turnos/${turnoId}/estado`)
      .set('Cookie', cookieAdmin)
      .send({ estado: 'atendido' });

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('atendido');
  });

  test('transición válida: confirmado -> ausente', async () => {
    const turnoId = await insertarTurno({ fechaHora: '2026-11-02 10:00:00', estado: 'confirmado' });

    const res = await request(app)
      .patch(`/api/admin/turnos/${turnoId}/estado`)
      .set('Cookie', cookieAdmin)
      .send({ estado: 'ausente' });

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('ausente');
  });

  test('transición válida: confirmado -> cancelado', async () => {
    const turnoId = await insertarTurno({ fechaHora: '2026-11-02 10:30:00', estado: 'confirmado' });

    const res = await request(app)
      .patch(`/api/admin/turnos/${turnoId}/estado`)
      .set('Cookie', cookieAdmin)
      .send({ estado: 'cancelado' });

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('cancelado');
  });

  test('Criterio de aceptación: dado un turno atendido, cuando se intenta cancelar, responde 422', async () => {
    const turnoId = await insertarTurno({ fechaHora: '2026-11-02 11:00:00', estado: 'atendido' });

    const res = await request(app)
      .patch(`/api/admin/turnos/${turnoId}/estado`)
      .set('Cookie', cookieAdmin)
      .send({ estado: 'cancelado' });

    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('TRANSICION_INVALIDA');
  });

  test('transiciones inválidas: ausente -> cancelado o cancelado -> confirmado', async () => {
    const tAusente = await insertarTurno({ fechaHora: '2026-11-02 11:30:00', estado: 'ausente' });
    const resAus = await request(app)
      .patch(`/api/admin/turnos/${tAusente}/estado`)
      .set('Cookie', cookieAdmin)
      .send({ estado: 'cancelado' });
    expect(resAus.status).toBe(422);
    expect(resAus.body.codigo).toBe('TRANSICION_INVALIDA');

    const tCancelado = await insertarTurno({ fechaHora: '2026-11-02 12:00:00', estado: 'cancelado' });
    const resCanc = await request(app)
      .patch(`/api/admin/turnos/${tCancelado}/estado`)
      .set('Cookie', cookieAdmin)
      .send({ estado: 'confirmado' });
    expect(resCanc.status).toBe(422);
    expect(resCanc.body.codigo).toBe('TRANSICION_INVALIDA');
  });

  test('intento de transición sobre turno inexistente responde 404', async () => {
    const res = await request(app)
      .patch('/api/admin/turnos/999999/estado')
      .set('Cookie', cookieAdmin)
      .send({ estado: 'confirmado' });
    expect(res.status).toBe(404);
    expect(res.body.codigo).toBe('NO_ENCONTRADO');
  });

  test('estado inválido en el body responde 400', async () => {
    const res = await request(app)
      .patch('/api/admin/turnos/1/estado')
      .set('Cookie', cookieAdmin)
      .send({ estado: 'invalido' });
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('DATOS_INVALIDOS');
  });
});

describe('PATCH /api/admin/turnos/:id/reprogramar (reprogramarComoAdmin)', () => {
  test('reprograma turno sin antelación mínima y conserva estado confirmado', async () => {
    // Turno para dentro de 2 horas (el cliente no podría por antelacion_hs=24)
    const turnoId = await insertarTurno({ fechaHora: '2026-11-02 12:30:00', estado: 'confirmado' });

    const res = await request(app)
      .patch(`/api/admin/turnos/${turnoId}/reprogramar`)
      .set('Cookie', cookieAdmin)
      .send({ fecha: '2026-11-03', hora: '14:00' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(turnoId);
    expect(res.body.estado).toBe('confirmado'); // Conserva el estado
    expect(res.body.fecha_hora).toBe('2026-11-03 14:00:00');
    expect(res.body.modificado_por).toBe(adminId);
  });

  test('reprograma turno conservando estado pendiente', async () => {
    const turnoId = await insertarTurno({ fechaHora: '2026-11-02 13:00:00', estado: 'pendiente' });

    const res = await request(app)
      .patch(`/api/admin/turnos/${turnoId}/reprogramar`)
      .set('Cookie', cookieAdmin)
      .send({ fecha: '2026-11-03', hora: '14:30' });

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('pendiente');
    expect(res.body.fecha_hora).toBe('2026-11-03 14:30:00');
  });

  test('no permite reprogramar si el turno está atendido o cancelado (422)', async () => {
    const tAtendido = await insertarTurno({ fechaHora: '2026-11-02 13:30:00', estado: 'atendido' });

    const res = await request(app)
      .patch(`/api/admin/turnos/${tAtendido}/reprogramar`)
      .set('Cookie', cookieAdmin)
      .send({ fecha: '2026-11-03', hora: '15:00' });

    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('TRANSICION_INVALIDA');
  });

  test('falla con 409 FRANJA_OCUPADA si la franja destino está ocupada', async () => {
    await insertarTurno({ fechaHora: '2026-11-03 15:30:00', estado: 'pendiente' });
    const turnoId = await insertarTurno({ fechaHora: '2026-11-02 14:00:00', estado: 'confirmado' });

    const res = await request(app)
      .patch(`/api/admin/turnos/${turnoId}/reprogramar`)
      .set('Cookie', cookieAdmin)
      .send({ fecha: '2026-11-03', hora: '15:30' });

    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('FRANJA_OCUPADA');

    // El turno original queda intacto
    const [[turno]] = await pool.execute('SELECT fecha_hora FROM turnos WHERE id = ?', [turnoId]);
    expect(turno.fecha_hora).toBe('2026-11-02 14:00:00');
  });

  test('falla con 422 FRANJA_INVALIDA si la franja es fin de semana', async () => {
    const turnoId = await insertarTurno({ fechaHora: '2026-11-02 14:30:00', estado: 'confirmado' });

    const res = await request(app)
      .patch(`/api/admin/turnos/${turnoId}/reprogramar`)
      .set('Cookie', cookieAdmin)
      .send({ fecha: '2026-11-07', hora: '10:00' }); // Sábado

    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('FRANJA_INVALIDA');
  });
});

describe('POST /api/admin/turnos/:id/urgencia (urgencia)', () => {
  test('Criterio de aceptación: urgencia con acción cancelar pone cancelado, es_urgencia=1, motivo guardado y devuelve contacto del cliente', async () => {
    const turnoId = await insertarTurno({ fechaHora: '2026-11-02 15:00:00', estado: 'confirmado' });

    const res = await request(app)
      .post(`/api/admin/turnos/${turnoId}/urgencia`)
      .set('Cookie', cookieAdmin)
      .send({
        accion: 'cancelar',
        motivo: 'Cirugía de emergencia por politraumatismo canino',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('turno');
    expect(res.body).toHaveProperty('cliente');

    // Turno actualizado
    expect(res.body.turno.id).toBe(turnoId);
    expect(res.body.turno.estado).toBe('cancelado');
    expect(res.body.turno.es_urgencia).toBe(1);
    expect(res.body.turno.motivo).toBe('Cirugía de emergencia por politraumatismo canino');
    expect(res.body.turno.modificado_por).toBe(adminId);

    // Datos del cliente para avisar
    expect(res.body.cliente).toEqual({
      nombre: 'ClienteTest11',
      apellido: 'Lopez',
      telefono: '1155556666',
      email: 'cli11@test.com',
    });
  });

  test('urgencia con acción reprogramar cambia fecha_hora, conserva estado, pone es_urgencia=1 y devuelve contacto', async () => {
    const turnoId = await insertarTurno({ fechaHora: '2026-11-02 15:30:00', estado: 'confirmado' });

    const res = await request(app)
      .post(`/api/admin/turnos/${turnoId}/urgencia`)
      .set('Cookie', cookieAdmin)
      .send({
        accion: 'reprogramar',
        motivo: 'Urgencia felina: obstrucción uretral',
        fecha: '2026-11-03',
        hora: '16:00',
      });

    expect(res.status).toBe(200);
    expect(res.body.turno.estado).toBe('confirmado'); // Conserva el estado
    expect(res.body.turno.fecha_hora).toBe('2026-11-03 16:00:00');
    expect(res.body.turno.es_urgencia).toBe(1);
    expect(res.body.turno.motivo).toBe('Urgencia felina: obstrucción uretral');
    expect(res.body.cliente.telefono).toBe('1155556666');
  });

  test('urgencia con acción reprogramar a franja ocupada devuelve 409 FRANJA_OCUPADA', async () => {
    await insertarTurno({ fechaHora: '2026-12-14 16:30:00', estado: 'pendiente' });
    const turnoId = await insertarTurno({ fechaHora: '2026-11-02 16:00:00', estado: 'confirmado' });

    const res = await request(app)
      .post(`/api/admin/turnos/${turnoId}/urgencia`)
      .set('Cookie', cookieAdmin)
      .send({
        accion: 'reprogramar',
        motivo: 'Urgencia respiratoria',
        fecha: '2026-12-14',
        hora: '16:30',
      });

    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('FRANJA_OCUPADA');

    // No modificó el turno
    const [[turno]] = await pool.execute('SELECT fecha_hora, es_urgencia FROM turnos WHERE id = ?', [turnoId]);
    expect(turno.fecha_hora).toBe('2026-11-02 16:00:00');
    expect(turno.es_urgencia).toBe(0);
  });

  test('no se puede aplicar urgencia a un turno ya cancelado o atendido (422)', async () => {
    const tCanc = await insertarTurno({ fechaHora: '2026-11-02 16:30:00', estado: 'cancelado' });

    const res = await request(app)
      .post(`/api/admin/turnos/${tCanc}/urgencia`)
      .set('Cookie', cookieAdmin)
      .send({
        accion: 'cancelar',
        motivo: 'Urgencia',
      });

    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('TRANSICION_INVALIDA');
  });

  test('validación zod: motivo obligatorio y falta de fecha/hora en reprogramar (400)', async () => {
    const turnoId = await insertarTurno({ fechaHora: '2026-11-02 17:00:00', estado: 'confirmado' });

    // Sin motivo
    const res1 = await request(app)
      .post(`/api/admin/turnos/${turnoId}/urgencia`)
      .set('Cookie', cookieAdmin)
      .send({
        accion: 'cancelar',
      });
    expect(res1.status).toBe(400);
    expect(res1.body.codigo).toBe('DATOS_INVALIDOS');

    // Reprogramar sin fecha ni hora
    const res2 = await request(app)
      .post(`/api/admin/turnos/${turnoId}/urgencia`)
      .set('Cookie', cookieAdmin)
      .send({
        accion: 'reprogramar',
        motivo: 'Reubicación por urgencia',
      });
    expect(res2.status).toBe(400);
    expect(res2.body.codigo).toBe('DATOS_INVALIDOS');
  });
});
