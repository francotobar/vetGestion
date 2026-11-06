// Tests de concurrencia sobre turnos existentes (observación 3 del docente).
// Las mutaciones de estado o de fecha de un turno son condicionadas: el UPDATE
// exige el estado que se leyó. Si otra operación lo cambió entre la lectura y
// el UPDATE, no se modifica ninguna fila y se responde 409 CONFLICTO_ESTADO.
// Así nunca un "atendido" queda pisado por una cancelación o reprogramación.
//
// Dos formas de probarlo:
// - Determinista: la ventana entre lectura y UPDATE se fuerza con un espía sobre
//   pool.execute. Tras la primera lectura del turno, se ejecuta la operación
//   competidora directamente en la base.
// - Simultánea: dos peticiones con Promise.all sobre el mismo turno.
//
// Reglas: datos propios con prefijo OBS3-, fechas únicas por test, limpieza en afterAll.
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const PASSWORD = 'clave12';
const DOC_ADMIN = 'OBS3-ADM';
const DOC_CLIENTE = 'OBS3-CLI';

let adminId;
let clienteId;
let mascotaId;
let servicioId;
let cookieAdmin;
let cookieCliente;

const usadas = new Set();

function aFecha(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Primer día hábil, sin feriado y sin usar, a partir de hoy + desdeDias.
// Las reservas admiten hasta 60 días: se corta antes para no pasar ese plazo.
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

async function insertarTurno(estado = 'confirmado') {
  const fecha = await diaLibre();
  const [res] = await pool.execute(
    `INSERT INTO turnos (usuario_id, mascota_id, servicio_id, fecha_hora, estado, canal, creado_por)
     VALUES (?, ?, ?, ?, ?, 'telefonico', ?)`,
    [clienteId, mascotaId, servicioId, `${fecha} 10:00:00`, estado, adminId]
  );
  return { id: res.insertId, fecha };
}

async function leerTurno(id) {
  const [[t]] = await pool.execute(
    "SELECT estado, DATE_FORMAT(fecha_hora, '%Y-%m-%d') AS fecha, es_urgencia FROM turnos WHERE id = ?",
    [id]
  );
  return t;
}

// Fuerza la ventana entre la lectura y el UPDATE de la operación bajo prueba:
// en cuanto el servicio lee el turno (primer SELECT sobre turnos), se ejecuta
// la operación competidora directamente contra la base. El UPDATE del servicio
// llega entonces con un estado distinto al leído. Registra las filas afectadas
// por cada UPDATE del servicio.
function forzarVentana(sqlCompetencia, paramsCompetencia) {
  const original = pool.execute.bind(pool);
  const registro = { filasAfectadas: [] };
  let disparada = false;
  const espia = jest.spyOn(pool, 'execute').mockImplementation(async (sql, params) => {
    const resultado = await original(sql, params);
    if (/^\s*UPDATE turnos/i.test(sql)) {
      registro.filasAfectadas.push(resultado[0].affectedRows);
    }
    if (!disparada && /^\s*SELECT/i.test(sql) && /FROM turnos/i.test(sql)) {
      disparada = true;
      await original(sqlCompetencia, paramsCompetencia);
    }
    return resultado;
  });
  return { registro, restaurar: () => espia.mockRestore() };
}

beforeAll(async () => {
  const hash = await bcrypt.hash(PASSWORD, 4);
  const [adm] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, password_hash, estado_cuenta)
     VALUES ('admin', ?, 'AdminObs3', 'Root', '1100000005', ?, 'con_cuenta')`,
    [DOC_ADMIN, hash]
  );
  adminId = adm.insertId;
  const [cli] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, password_hash, estado_cuenta)
     VALUES ('cliente', ?, 'Obs3', 'Cliente', '1100000006', ?, 'con_cuenta')`,
    [DOC_CLIENTE, hash]
  );
  clienteId = cli.insertId;
  const [masc] = await pool.execute(
    `INSERT INTO mascotas (usuario_id, nombre, especie, raza, sexo, fecha_nacimiento, esterilizado)
     VALUES (?, 'OBS3-Pampa', 'gato', 'Siamés', 'hembra', '2020-05-01', 1)`,
    [clienteId]
  );
  mascotaId = masc.insertId;
  const [srv] = await pool.execute(
    "INSERT INTO servicios (nombre, descripcion, activo) VALUES ('OBS3S-Consulta', 'Consulta test obs3', 1)"
  );
  servicioId = srv.insertId;

  cookieAdmin = await login(DOC_ADMIN);
  cookieCliente = await login(DOC_CLIENTE);
});

afterAll(async () => {
  await pool.execute(
    "DELETE FROM turnos WHERE usuario_id IN (SELECT id FROM usuarios WHERE documento LIKE 'OBS3-%')"
  );
  await pool.execute(
    "DELETE FROM mascotas WHERE usuario_id IN (SELECT id FROM usuarios WHERE documento LIKE 'OBS3-%')"
  );
  await pool.execute(
    "UPDATE usuarios SET creado_por = NULL, modificado_por = NULL WHERE documento LIKE 'OBS3-%'"
  );
  await pool.execute("DELETE FROM usuarios WHERE documento LIKE 'OBS3-%'");
  await pool.execute("DELETE FROM servicios WHERE nombre LIKE 'OBS3S-%'");
  await pool.end();
});

describe('Ventana forzada entre lectura y UPDATE (determinista)', () => {
  test('control: sin competencia, la cancelación del cliente se aplica (1 fila)', async () => {
    const { id } = await insertarTurno('confirmado');
    const { registro, restaurar } = forzarVentana('SELECT 1', []);
    try {
      const res = await request(app).patch(`/api/turnos/${id}/cancelar`).set('Cookie', cookieCliente);
      expect(res.status).toBe(200);
      expect(registro.filasAfectadas).toEqual([1]);
    } finally {
      restaurar();
    }
    expect((await leerTurno(id)).estado).toBe('cancelado');
  });

  test('cancelar (cliente) contra atendido (admin): 409 CONFLICTO_ESTADO y el atendido se conserva', async () => {
    const { id } = await insertarTurno('confirmado');
    const { registro, restaurar } = forzarVentana(
      "UPDATE turnos SET estado = 'atendido', modificado_por = ? WHERE id = ?",
      [adminId, id]
    );
    try {
      const res = await request(app).patch(`/api/turnos/${id}/cancelar`).set('Cookie', cookieCliente);
      expect(res.status).toBe(409);
      expect(res.body.codigo).toBe('CONFLICTO_ESTADO');
      expect(registro.filasAfectadas).toEqual([0]);
    } finally {
      restaurar();
    }
    expect((await leerTurno(id)).estado).toBe('atendido');
  });

  test('reprogramar (cliente) contra atendido (admin): 409 y la fecha original no cambia', async () => {
    const { id, fecha } = await insertarTurno('confirmado');
    const nueva = await diaLibre();
    const { registro, restaurar } = forzarVentana(
      "UPDATE turnos SET estado = 'atendido', modificado_por = ? WHERE id = ?",
      [adminId, id]
    );
    try {
      const res = await request(app)
        .patch(`/api/turnos/${id}/reprogramar`)
        .set('Cookie', cookieCliente)
        .send({ fecha: nueva, hora: '11:00' });
      expect(res.status).toBe(409);
      expect(res.body.codigo).toBe('CONFLICTO_ESTADO');
      expect(registro.filasAfectadas).toEqual([0]);
    } finally {
      restaurar();
    }
    const t = await leerTurno(id);
    expect(t.estado).toBe('atendido');
    expect(t.fecha).toBe(fecha);
  });

  test('cambiar a atendido (admin) contra cancelación (cliente): el cancelado no se pisa', async () => {
    const { id } = await insertarTurno('confirmado');
    const { registro, restaurar } = forzarVentana(
      "UPDATE turnos SET estado = 'cancelado', modificado_por = ? WHERE id = ?",
      [clienteId, id]
    );
    try {
      const res = await request(app)
        .patch(`/api/admin/turnos/${id}/estado`)
        .set('Cookie', cookieAdmin)
        .send({ estado: 'atendido' });
      expect(res.status).toBe(409);
      expect(res.body.codigo).toBe('CONFLICTO_ESTADO');
      expect(registro.filasAfectadas).toEqual([0]);
    } finally {
      restaurar();
    }
    expect((await leerTurno(id)).estado).toBe('cancelado');
  });

  test('reprogramar (admin) contra atendido (admin): 409 y la fecha no cambia', async () => {
    const { id, fecha } = await insertarTurno('confirmado');
    const nueva = await diaLibre();
    const { registro, restaurar } = forzarVentana(
      "UPDATE turnos SET estado = 'atendido', modificado_por = ? WHERE id = ?",
      [adminId, id]
    );
    try {
      const res = await request(app)
        .patch(`/api/admin/turnos/${id}/reprogramar`)
        .set('Cookie', cookieAdmin)
        .send({ fecha: nueva, hora: '12:00' });
      expect(res.status).toBe(409);
      expect(res.body.codigo).toBe('CONFLICTO_ESTADO');
      expect(registro.filasAfectadas).toEqual([0]);
    } finally {
      restaurar();
    }
    const t = await leerTurno(id);
    expect(t.estado).toBe('atendido');
    expect(t.fecha).toBe(fecha);
  });

  test('urgencia cancelar (admin) contra atendido: 409 y el turno no queda con es_urgencia', async () => {
    const { id } = await insertarTurno('confirmado');
    const { registro, restaurar } = forzarVentana(
      "UPDATE turnos SET estado = 'atendido', modificado_por = ? WHERE id = ?",
      [adminId, id]
    );
    try {
      const res = await request(app)
        .post(`/api/admin/turnos/${id}/urgencia`)
        .set('Cookie', cookieAdmin)
        .send({ accion: 'cancelar', motivo: 'Prueba OBS3' });
      expect(res.status).toBe(409);
      expect(res.body.codigo).toBe('CONFLICTO_ESTADO');
      expect(registro.filasAfectadas).toEqual([0]);
    } finally {
      restaurar();
    }
    const t = await leerTurno(id);
    expect(t.estado).toBe('atendido');
    expect(t.es_urgencia).toBe(0);
  });

  test('urgencia reprogramar (admin) contra atendido: 409 y la fecha no cambia', async () => {
    const { id, fecha } = await insertarTurno('confirmado');
    const nueva = await diaLibre();
    const { registro, restaurar } = forzarVentana(
      "UPDATE turnos SET estado = 'atendido', modificado_por = ? WHERE id = ?",
      [adminId, id]
    );
    try {
      const res = await request(app)
        .post(`/api/admin/turnos/${id}/urgencia`)
        .set('Cookie', cookieAdmin)
        .send({ accion: 'reprogramar', motivo: 'Prueba OBS3', fecha: nueva, hora: '13:00' });
      expect(res.status).toBe(409);
      expect(res.body.codigo).toBe('CONFLICTO_ESTADO');
      expect(registro.filasAfectadas).toEqual([0]);
    } finally {
      restaurar();
    }
    const t = await leerTurno(id);
    expect(t.estado).toBe('atendido');
    expect(t.fecha).toBe(fecha);
  });
});

describe('Acciones simultáneas sobre el mismo turno (Promise.all)', () => {
  test('cancelar y marcar atendido a la vez: exactamente una tiene éxito y el estado es coherente', async () => {
    for (let ronda = 0; ronda < 3; ronda++) {
      const { id } = await insertarTurno('confirmado');
      const [cancelacion, atencion] = await Promise.all([
        request(app).patch(`/api/turnos/${id}/cancelar`).set('Cookie', cookieCliente),
        request(app).patch(`/api/admin/turnos/${id}/estado`).set('Cookie', cookieAdmin).send({ estado: 'atendido' }),
      ]);

      const exitosas = [cancelacion, atencion].filter((r) => r.status === 200);
      expect(exitosas).toHaveLength(1);

      const perdedora = exitosas[0] === cancelacion ? atencion : cancelacion;
      expect([409, 422]).toContain(perdedora.status);
      expect(['CONFLICTO_ESTADO', 'TRANSICION_INVALIDA']).toContain(perdedora.body.codigo);

      const esperado = exitosas[0] === cancelacion ? 'cancelado' : 'atendido';
      expect((await leerTurno(id)).estado).toBe(esperado);
    }
  });

  test('reprogramar y marcar atendido a la vez: o se reprograma o queda atendido, nunca ambos', async () => {
    for (let ronda = 0; ronda < 3; ronda++) {
      const { id, fecha } = await insertarTurno('confirmado');
      const nueva = await diaLibre();
      const [reprogramacion, atencion] = await Promise.all([
        request(app)
          .patch(`/api/turnos/${id}/reprogramar`)
          .set('Cookie', cookieCliente)
          .send({ fecha: nueva, hora: '15:00' }),
        request(app).patch(`/api/admin/turnos/${id}/estado`).set('Cookie', cookieAdmin).send({ estado: 'atendido' }),
      ]);

      const exitosas = [reprogramacion, atencion].filter((r) => r.status === 200);
      expect(exitosas).toHaveLength(1);

      const t = await leerTurno(id);
      if (exitosas[0] === reprogramacion) {
        expect(t.estado).toBe('pendiente');
        expect(t.fecha).toBe(nueva);
        expect(atencion.body.codigo).toMatch(/CONFLICTO_ESTADO|TRANSICION_INVALIDA/);
      } else {
        expect(t.estado).toBe('atendido');
        expect(t.fecha).toBe(fecha);
        expect(reprogramacion.body.codigo).toMatch(/CONFLICTO_ESTADO|TRANSICION_INVALIDA/);
      }
    }
  });
});
