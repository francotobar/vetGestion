// Tests de la carrera entre reservas y baja de mascota (observación del docente,
// paso 1). Reservas y reprogramaciones bloquean la fila de la mascota con
// SELECT ... FOR UPDATE antes de validar y escribir. Una baja que confirma entre
// la lectura y el INSERT no puede dejar un turno futuro activo de una mascota
// inactiva: la reserva espera el bloqueo y, al continuar, ve activa = 0.
//
// Cómo se fuerza la carrera: una conexión toma el bloqueo de la mascota y lo
// retiene. Mientras la retiene, la operación bajo prueba no puede terminar (lo
// impide el motor, no el tiempo). Se espera un plazo acotado: si la operación
// terminó, significa que no quedó bloqueada y el test falla. Luego se libera la
// conexión (opcionalmente dando de baja la mascota) y se comprueba el resultado.
// El usuario de la base no tiene PROCESS ni acceso a performance_schema, por eso
// no se consulta innodb_trx para confirmar la espera.
//
// Reglas: datos propios con prefijo OBS4-, fechas únicas por test, limpieza en afterAll.
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const PASSWORD = 'clave12';
const DOC_ADMIN = 'OBS4-ADM';
const DOC_CLIENTE = 'OBS4-CLI';
const PLAZO_ESPERA_MS = 600;

let adminId;
let clienteId;
let servicioId;
let cookieAdmin;
let cookieCliente;

const usadas = new Set();

function aFecha(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function diaLibre(desdeDias = 5) {
  const [feriados] = await pool.execute('SELECT fecha FROM feriados');
  const fechasFeriados = feriados.map((f) => f.fecha);
  for (let i = desdeDias; i <= 58; i++) {
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
  throw new Error('No quedan días hábiles libres para el test');
}

async function login(documento) {
  const res = await request(app).post('/api/auth/login').send({ documento, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.headers['set-cookie'][0].split(';')[0];
}

async function crearMascota(nombre) {
  const [res] = await pool.execute(
    `INSERT INTO mascotas (usuario_id, nombre, especie, raza, sexo, fecha_nacimiento, esterilizado)
     VALUES (?, ?, 'gato', 'Mestizo', 'macho', '2019-08-20', 0)`,
    [clienteId, nombre]
  );
  return res.insertId;
}

async function insertarTurno(mascotaId, fecha, hora, estado = 'pendiente') {
  const [res] = await pool.execute(
    `INSERT INTO turnos (usuario_id, mascota_id, servicio_id, fecha_hora, estado, canal, creado_por)
     VALUES (?, ?, ?, ?, ?, 'web', ?)`,
    [clienteId, mascotaId, servicioId, `${fecha} ${hora}:00`, estado, clienteId]
  );
  return res.insertId;
}

// Una conexión toma el bloqueo de la mascota y lo retiene hasta liberar().
// Con desactivar = true simula una baja que confirma: activa = 0 antes de commit.
// liberar() es idempotente: el afterEach lo llama aunque el test haya fallado.
async function retenerBloqueoDeMascota(mascotaId, { desactivar }) {
  const conn = await pool.getConnection();
  let liberada = false;
  try {
    await conn.beginTransaction();
    await conn.execute('SELECT id FROM mascotas WHERE id = ? FOR UPDATE', [mascotaId]);
  } catch (err) {
    conn.release();
    throw err;
  }
  return {
    async liberar() {
      if (liberada) return;
      liberada = true;
      try {
        if (desactivar) {
          await conn.execute('UPDATE mascotas SET activa = 0 WHERE id = ?', [mascotaId]);
        }
        await conn.commit();
      } finally {
        conn.release();
      }
    },
  };
}

// Lanza la operación y devuelve un objeto que registra si ya terminó.
function lanzar(peticion) {
  const estado = { terminada: false, respuesta: null };
  estado.promesa = peticion.then((r) => {
    estado.terminada = true;
    estado.respuesta = r;
    return r;
  });
  return estado;
}

async function expectBloqueada(estado) {
  await new Promise((resolver) => setTimeout(resolver, PLAZO_ESPERA_MS));
  expect(estado.terminada).toBe(false);
}

async function turnosActivosFuturos(mascotaId) {
  const [[fila]] = await pool.execute(
    `SELECT COUNT(*) AS n FROM turnos
      WHERE mascota_id = ? AND estado IN ('pendiente', 'confirmado') AND fecha_hora > NOW()`,
    [mascotaId]
  );
  return fila.n;
}

let bloqueos = [];

afterEach(async () => {
  for (const b of bloqueos) {
    await b.liberar().catch(() => {});
  }
  bloqueos = [];
});

beforeAll(async () => {
  const hash = await bcrypt.hash(PASSWORD, 4);
  const [adm] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, password_hash, estado_cuenta)
     VALUES ('admin', ?, 'AdminObs4', 'Root', '1100000007', ?, 'con_cuenta')`,
    [DOC_ADMIN, hash]
  );
  adminId = adm.insertId;
  const [cli] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, password_hash, estado_cuenta)
     VALUES ('cliente', ?, 'Obs4', 'Cliente', '1100000008', ?, 'con_cuenta')`,
    [DOC_CLIENTE, hash]
  );
  clienteId = cli.insertId;
  const [srv] = await pool.execute(
    "INSERT INTO servicios (nombre, descripcion, activo) VALUES ('OBS4S-Consulta', 'Consulta test obs4', 1)"
  );
  servicioId = srv.insertId;
  cookieAdmin = await login(DOC_ADMIN);
  cookieCliente = await login(DOC_CLIENTE);
});

afterAll(async () => {
  await pool.execute(
    "DELETE FROM turnos WHERE usuario_id IN (SELECT id FROM usuarios WHERE documento LIKE 'OBS4-%')"
  );
  await pool.execute(
    "DELETE FROM mascotas WHERE usuario_id IN (SELECT id FROM usuarios WHERE documento LIKE 'OBS4-%')"
  );
  await pool.execute(
    "UPDATE usuarios SET creado_por = NULL, modificado_por = NULL WHERE documento LIKE 'OBS4-%'"
  );
  await pool.execute("DELETE FROM usuarios WHERE documento LIKE 'OBS4-%'");
  await pool.execute("DELETE FROM servicios WHERE nombre LIKE 'OBS4S-%'");
  await pool.end();
});

describe('Reserva concurrente con la baja de la mascota', () => {
  test('reserva del cliente: si la baja confirma mientras espera, responde 422 y no queda turno activo', async () => {
    const mascotaId = await crearMascota('OBS4-Rocco');
    const fecha = await diaLibre();

    const bloqueo = await retenerBloqueoDeMascota(mascotaId, { desactivar: true });
    bloqueos.push(bloqueo);
    const reserva = lanzar(
      request(app)
        .post('/api/turnos')
        .set('Cookie', cookieCliente)
        .send({ mascota_id: mascotaId, servicio_id: servicioId, fecha, hora: '10:00' })
    );

    await expectBloqueada(reserva);
    await bloqueo.liberar();

    const res = await reserva.promesa;
    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('MASCOTA_INACTIVA');
    expect(await turnosActivosFuturos(mascotaId)).toBe(0);
  });

  test('control: si la baja no confirma, la reserva espera el bloqueo y luego se crea (201)', async () => {
    const mascotaId = await crearMascota('OBS4-Mia');
    const fecha = await diaLibre();

    const bloqueo = await retenerBloqueoDeMascota(mascotaId, { desactivar: false });
    bloqueos.push(bloqueo);
    const reserva = lanzar(
      request(app)
        .post('/api/turnos')
        .set('Cookie', cookieCliente)
        .send({ mascota_id: mascotaId, servicio_id: servicioId, fecha, hora: '10:30' })
    );

    await expectBloqueada(reserva);
    await bloqueo.liberar();

    const res = await reserva.promesa;
    expect(res.status).toBe(201);
    expect(await turnosActivosFuturos(mascotaId)).toBe(1);
  });

  test('turno manual del administrador: si la baja confirma mientras espera, responde 422', async () => {
    const mascotaId = await crearMascota('OBS4-Lola');
    const fecha = await diaLibre();

    const bloqueo = await retenerBloqueoDeMascota(mascotaId, { desactivar: true });
    bloqueos.push(bloqueo);
    const alta = lanzar(
      request(app)
        .post('/api/admin/turnos')
        .set('Cookie', cookieAdmin)
        .send({
          usuario_id: clienteId,
          mascota_id: mascotaId,
          servicio_id: servicioId,
          fecha,
          hora: '11:00',
          canal: 'telefonico',
        })
    );

    await expectBloqueada(alta);
    await bloqueo.liberar();

    const res = await alta.promesa;
    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('MASCOTA_INACTIVA');
    expect(await turnosActivosFuturos(mascotaId)).toBe(0);
  });

  test('reprogramación del cliente: si la baja confirma mientras espera, el turno no se mueve', async () => {
    const mascotaId = await crearMascota('OBS4-Nube');
    const fecha = await diaLibre();
    const nueva = await diaLibre();
    const turnoId = await insertarTurno(mascotaId, fecha, '12:00', 'confirmado');

    const bloqueo = await retenerBloqueoDeMascota(mascotaId, { desactivar: true });
    bloqueos.push(bloqueo);
    const reprogramacion = lanzar(
      request(app)
        .patch(`/api/turnos/${turnoId}/reprogramar`)
        .set('Cookie', cookieCliente)
        .send({ fecha: nueva, hora: '13:00' })
    );

    await expectBloqueada(reprogramacion);
    await bloqueo.liberar();

    const res = await reprogramacion.promesa;
    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('MASCOTA_INACTIVA');
    const [[t]] = await pool.execute(
      "SELECT estado, DATE_FORMAT(fecha_hora, '%Y-%m-%d') AS fecha FROM turnos WHERE id = ?",
      [turnoId]
    );
    expect(t.fecha).toBe(fecha);
    expect(t.estado).toBe('confirmado');
  });
});
