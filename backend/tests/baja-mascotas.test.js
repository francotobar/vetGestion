// Tests de baja lógica de mascotas con turnos futuros (observación 2 del docente).
// DELETE /api/mascotas/:id (cliente) y DELETE /api/admin/mascotas/:id (admin).
// - La baja pone activa = 0 y cancela los turnos futuros pendiente/confirmado
//   (motivo "Baja de la mascota"), libera la franja y responde cuántos canceló.
// - No toca turnos pasados ni de otras mascotas.
// - Una mascota inactiva no recibe reservas ni reprogramaciones (422 MASCOTA_INACTIVA).
// - La baja del administrador exige rol admin (403 para el cliente).
//
// Reglas: datos propios con prefijo OBS2-, fechas calculadas y únicas por
// test (días hábiles futuros, sin feriados), limpieza en afterAll.
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const PASSWORD = 'clave12';
const DOC_ADMIN = 'OBS2-ADM';
const DOC_CLIENTE = 'OBS2-CLI';
const DOC_OTRO = 'OBS2-OTRO';

let adminId;
let clienteId;
let otroId;
let servicioId;
let cookieAdmin;
let cookieCliente;
let cookieOtro;

const usadas = new Set();

function aFecha(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Primer día hábil (lun-vie), sin feriado y sin usar en otro test, a partir de hoy + desdeDias.
async function diaLibre(desdeDias) {
  const [feriados] = await pool.execute('SELECT fecha FROM feriados');
  const fechasFeriados = feriados.map((f) => f.fecha);
  for (let i = desdeDias; ; i++) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    const fecha = aFecha(d);
    const laborable = d.getDay() !== 0 && d.getDay() !== 6;
    if (laborable && !fechasFeriados.includes(fecha) && !usadas.has(fecha)) {
      usadas.add(fecha);
      return fecha;
    }
  }
}

function diasAtras(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return aFecha(d);
}

async function login(documento) {
  const res = await request(app).post('/api/auth/login').send({ documento, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.headers['set-cookie'][0].split(';')[0];
}

async function crearMascota(usuarioId, nombre) {
  const [res] = await pool.execute(
    `INSERT INTO mascotas (usuario_id, nombre, especie, raza, sexo, fecha_nacimiento, esterilizado)
     VALUES (?, ?, 'perro', 'Mestiza', 'hembra', '2021-03-10', 0)`,
    [usuarioId, nombre]
  );
  return res.insertId;
}

async function insertarTurno({ mascotaId, usuario = clienteId, fecha, hora, estado = 'confirmado' }) {
  const [res] = await pool.execute(
    `INSERT INTO turnos (usuario_id, mascota_id, servicio_id, fecha_hora, estado, canal, creado_por)
     VALUES (?, ?, ?, ?, ?, 'web', ?)`,
    [usuario, mascotaId, servicioId, `${fecha} ${hora}:00`, estado, usuario]
  );
  return res.insertId;
}

async function estadoDe(turnoId) {
  const [[t]] = await pool.execute('SELECT estado, motivo, modificado_por FROM turnos WHERE id = ?', [turnoId]);
  return t;
}

async function franjasLibres(fecha, cookie) {
  const res = await request(app).get(`/api/turnos/disponibilidad?fecha=${fecha}`).set('Cookie', cookie);
  expect(res.status).toBe(200);
  return res.body;
}

beforeAll(async () => {
  const hash = await bcrypt.hash(PASSWORD, 4);
  const [adm] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, password_hash, estado_cuenta)
     VALUES ('admin', ?, 'AdminObs2', 'Root', '1100000002', ?, 'con_cuenta')`,
    [DOC_ADMIN, hash]
  );
  adminId = adm.insertId;
  const [cli] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, password_hash, estado_cuenta)
     VALUES ('cliente', ?, 'Obs2', 'Cliente', '1100000003', ?, 'con_cuenta')`,
    [DOC_CLIENTE, hash]
  );
  clienteId = cli.insertId;
  const [otro] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, password_hash, estado_cuenta)
     VALUES ('cliente', ?, 'Obs2', 'Otro', '1100000004', ?, 'con_cuenta')`,
    [DOC_OTRO, hash]
  );
  otroId = otro.insertId;
  const [srv] = await pool.execute(
    "INSERT INTO servicios (nombre, descripcion, activo) VALUES ('OBS2S-Consulta', 'Consulta test obs2', 1)"
  );
  servicioId = srv.insertId;

  cookieAdmin = await login(DOC_ADMIN);
  cookieCliente = await login(DOC_CLIENTE);
  cookieOtro = await login(DOC_OTRO);
});

afterAll(async () => {
  await pool.execute(
    "DELETE FROM turnos WHERE usuario_id IN (SELECT id FROM usuarios WHERE documento LIKE 'OBS2-%')"
  );
  await pool.execute(
    "DELETE FROM mascotas WHERE usuario_id IN (SELECT id FROM usuarios WHERE documento LIKE 'OBS2-%')"
  );
  await pool.execute(
    "UPDATE usuarios SET creado_por = NULL, modificado_por = NULL WHERE documento LIKE 'OBS2-%'"
  );
  await pool.execute("DELETE FROM usuarios WHERE documento LIKE 'OBS2-%'");
  await pool.execute("DELETE FROM servicios WHERE nombre LIKE 'OBS2S-%'");
  await pool.end();
});

describe('Baja de mascota por el administrador', () => {
  test('cancela los turnos futuros, libera la franja y responde cuántos canceló', async () => {
    const mascotaId = await crearMascota(clienteId, 'OBS2-Luna');
    const fecha = await diaLibre(5);
    const t1 = await insertarTurno({ mascotaId, fecha, hora: '10:00', estado: 'confirmado' });
    const t2 = await insertarTurno({ mascotaId, fecha, hora: '11:00', estado: 'pendiente' });

    const antes = await franjasLibres(fecha, cookieAdmin);
    expect(antes).not.toContain('10:00');
    expect(antes).not.toContain('11:00');

    const res = await request(app).delete(`/api/admin/mascotas/${mascotaId}`).set('Cookie', cookieAdmin);
    expect(res.status).toBe(200);
    expect(res.body.turnos_cancelados).toBe(2);

    const [[masc]] = await pool.execute('SELECT activa FROM mascotas WHERE id = ?', [mascotaId]);
    expect(masc.activa).toBe(0);

    for (const id of [t1, t2]) {
      const t = await estadoDe(id);
      expect(t.estado).toBe('cancelado');
      expect(t.motivo).toBe('Baja de la mascota');
      expect(t.modificado_por).toBe(adminId);
    }

    const despues = await franjasLibres(fecha, cookieAdmin);
    expect(despues).toContain('10:00');
    expect(despues).toContain('11:00');
  });

  test('no toca turnos pasados ni turnos de otras mascotas del mismo cliente', async () => {
    const mascotaBaja = await crearMascota(clienteId, 'OBS2-Simon');
    const otraMascota = await crearMascota(clienteId, 'OBS2-Kira');
    const fecha = await diaLibre(6);
    const futuroBaja = await insertarTurno({ mascotaId: mascotaBaja, fecha, hora: '12:00' });
    const futuroOtra = await insertarTurno({ mascotaId: otraMascota, fecha, hora: '15:00' });
    const pasado = await insertarTurno({
      mascotaId: mascotaBaja,
      fecha: diasAtras(20),
      hora: '13:30',
      estado: 'pendiente',
    });

    const res = await request(app).delete(`/api/admin/mascotas/${mascotaBaja}`).set('Cookie', cookieAdmin);
    expect(res.status).toBe(200);
    expect(res.body.turnos_cancelados).toBe(1);

    expect((await estadoDe(futuroBaja)).estado).toBe('cancelado');
    expect((await estadoDe(futuroOtra)).estado).toBe('confirmado');
    expect((await estadoDe(pasado)).estado).toBe('pendiente');
  });

  test('una mascota ya dada de baja o inexistente responde 404', async () => {
    const mascotaId = await crearMascota(clienteId, 'OBS2-Thor');
    await request(app).delete(`/api/admin/mascotas/${mascotaId}`).set('Cookie', cookieAdmin);

    const otra = await request(app).delete(`/api/admin/mascotas/${mascotaId}`).set('Cookie', cookieAdmin);
    expect(otra.status).toBe(404);

    const inexistente = await request(app).delete('/api/admin/mascotas/999999999').set('Cookie', cookieAdmin);
    expect(inexistente.status).toBe(404);
  });

  test('un cliente recibe 403 al intentar la baja por la vía de administración', async () => {
    const mascotaId = await crearMascota(clienteId, 'OBS2-Milo');
    const res = await request(app).delete(`/api/admin/mascotas/${mascotaId}`).set('Cookie', cookieCliente);
    expect(res.status).toBe(403);

    const [[masc]] = await pool.execute('SELECT activa FROM mascotas WHERE id = ?', [mascotaId]);
    expect(masc.activa).toBe(1);
  });
});

describe('Baja de mascota por el cliente', () => {
  test('el cliente da de baja su mascota y se cancelan sus turnos futuros', async () => {
    const mascotaId = await crearMascota(clienteId, 'OBS2-Bruno');
    const fecha = await diaLibre(7);
    const turnoId = await insertarTurno({ mascotaId, fecha, hora: '09:30' });

    const res = await request(app).delete(`/api/mascotas/${mascotaId}`).set('Cookie', cookieCliente);
    expect(res.status).toBe(200);
    expect(res.body.turnos_cancelados).toBe(1);
    expect((await estadoDe(turnoId)).estado).toBe('cancelado');
  });

  test('el cliente no puede dar de baja una mascota ajena (404) y no se toca', async () => {
    const mascotaAjena = await crearMascota(clienteId, 'OBS2-Nala');
    const fecha = await diaLibre(8);
    const turnoId = await insertarTurno({ mascotaId: mascotaAjena, fecha, hora: '16:00' });

    const res = await request(app).delete(`/api/mascotas/${mascotaAjena}`).set('Cookie', cookieOtro);
    expect(res.status).toBe(404);

    const [[masc]] = await pool.execute('SELECT activa FROM mascotas WHERE id = ?', [mascotaAjena]);
    expect(masc.activa).toBe(1);
    expect((await estadoDe(turnoId)).estado).toBe('confirmado');
  });
});

describe('Una mascota inactiva no recibe reservas ni reprogramaciones', () => {
  let mascotaInactiva;

  beforeAll(async () => {
    mascotaInactiva = await crearMascota(clienteId, 'OBS2-Inactiva');
    await pool.execute('UPDATE mascotas SET activa = 0 WHERE id = ?', [mascotaInactiva]);
  });

  test('el cliente no puede reservar con una mascota inactiva (422 MASCOTA_INACTIVA)', async () => {
    const fecha = await diaLibre(9);
    const res = await request(app)
      .post('/api/turnos')
      .set('Cookie', cookieCliente)
      .send({ mascota_id: mascotaInactiva, servicio_id: servicioId, fecha, hora: '10:00' });
    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('MASCOTA_INACTIVA');
  });

  test('el administrador no puede cargar un turno con una mascota inactiva (422 MASCOTA_INACTIVA)', async () => {
    const fecha = await diaLibre(10);
    const res = await request(app)
      .post('/api/admin/turnos')
      .set('Cookie', cookieAdmin)
      .send({
        usuario_id: clienteId,
        mascota_id: mascotaInactiva,
        servicio_id: servicioId,
        fecha,
        hora: '10:00',
        canal: 'telefonico',
      });
    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('MASCOTA_INACTIVA');
  });

  test('no se puede reprogramar un turno de una mascota inactiva (cliente, admin y urgencia)', async () => {
    const turnoId = await insertarTurno({
      mascotaId: mascotaInactiva,
      fecha: await diaLibre(11),
      hora: '11:00',
      estado: 'pendiente',
    });
    const fecha = await diaLibre(12);

    const cliente = await request(app)
      .patch(`/api/turnos/${turnoId}/reprogramar`)
      .set('Cookie', cookieCliente)
      .send({ fecha, hora: '10:00' });
    expect(cliente.status).toBe(422);
    expect(cliente.body.codigo).toBe('MASCOTA_INACTIVA');

    const admin = await request(app)
      .patch(`/api/admin/turnos/${turnoId}/reprogramar`)
      .set('Cookie', cookieAdmin)
      .send({ fecha, hora: '10:00' });
    expect(admin.status).toBe(422);
    expect(admin.body.codigo).toBe('MASCOTA_INACTIVA');

    const urgencia = await request(app)
      .post(`/api/admin/turnos/${turnoId}/urgencia`)
      .set('Cookie', cookieAdmin)
      .send({ accion: 'reprogramar', motivo: 'Prueba', fecha, hora: '10:00' });
    expect(urgencia.status).toBe(422);
    expect(urgencia.body.codigo).toBe('MASCOTA_INACTIVA');
  });

  test('una mascota ajena sigue respondiendo 404 (no 422)', async () => {
    const ajena = await crearMascota(otroId, 'OBS2-Ajena');
    const res = await request(app)
      .post('/api/turnos')
      .set('Cookie', cookieCliente)
      .send({ mascota_id: ajena, servicio_id: servicioId, fecha: await diaLibre(13), hora: '10:00' });
    expect(res.status).toBe(404);
  });
});
