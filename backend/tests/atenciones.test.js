// Tests de BE-14: Atenciones e historial clínico.
// POST /api/admin/turnos/:id/atencion
// GET /api/mascotas/:id/historial (cliente) y GET /api/admin/mascotas/:id/historial (admin)
// POST /api/admin/atenciones/:id/notas
//
// Criterios de aceptación:
// - Dado una atención guardada, cuando se intenta modificarla por SQL, entonces el trigger la rechaza.
// - Dado el cliente A, cuando pide el historial de una mascota ajena, entonces 404.
//
// Reglas del plan:
// - No existen endpoints PUT/DELETE de atenciones.
// - Las atenciones son inmutables (RF26): los triggers impiden UPDATE y DELETE.
//   Ningún test hace DELETE FROM atenciones. Todo lo que escribe atenciones lo
//   hace dentro de una transacción con ROLLBACK para no dejar residuos que
//   impidan volver a correr `npm run seed` (el seed se niega si hay atenciones).
const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const servicio = require('../src/modules/atenciones/service');

const DOC_ADMIN = 'TEST14-ADM';
const DOC_CLIENTE_A = 'TEST14-CLIA';
const DOC_CLIENTE_B = 'TEST14-CLIB';

let adminId;
let clienteAId;
let clienteBId;
let mascotaAId;
let mascotaBId;
let servicioId;
let turnoAtendidoId;
let cookieAdmin;
let cookieA;
let cookieB;

async function insertarUsuario(rol, documento, nombre, apellido, telefono, email) {
  const hash = await bcrypt.hash('clave12', 4);
  const [res] = await pool.execute(
    `INSERT INTO usuarios (rol, documento, nombre, apellido, telefono, email, password_hash, estado_cuenta)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'con_cuenta')`,
    [rol, documento, nombre, apellido, telefono, email, hash]
  );
  return res.insertId;
}

async function login(documento) {
  const res = await request(app).post('/api/auth/login').send({ documento, password: 'clave12' });
  expect(res.status).toBe(200);
  return res.headers['set-cookie'][0];
}

async function insertarTurno({ usuarioId, mascotaId, fechaHora, estado }) {
  const [res] = await pool.execute(
    `INSERT INTO turnos (usuario_id, mascota_id, servicio_id, fecha_hora, estado, canal, creado_por)
     VALUES (?, ?, ?, ?, ?, 'web', ?)`,
    [usuarioId, mascotaId, servicioId, fechaHora, estado, usuarioId]
  );
  return res.insertId;
}

// Ejecuta fn dentro de una transacción y SIEMPRE hace rollback: ningún residuo en la base.
async function conTransaccion(fn) {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const resultado = await fn(conn);
    await conn.rollback();
    return resultado;
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      // ignore
    }
    throw err;
  } finally {
    await conn.release();
  }
}

beforeAll(async () => {
  adminId = await insertarUsuario('admin', DOC_ADMIN, 'Admin', 'Catorce', '1100000014', 'adm14@test.local');
  clienteAId = await insertarUsuario('cliente', DOC_CLIENTE_A, 'Cliente', 'A', '1100000015', 'clia14@test.local');
  clienteBId = await insertarUsuario('cliente', DOC_CLIENTE_B, 'Cliente', 'B', '1100000016', 'clib14@test.local');

  const [mascA] = await pool.execute(
    `INSERT INTO mascotas (usuario_id, nombre, especie, raza, sexo, fecha_nacimiento, creado_por)
     VALUES (?, 'MascotaA14', 'perro', 'Cruza', 'hembra', '2020-01-01', ?)`,
    [clienteAId, adminId]
  );
  mascotaAId = mascA.insertId;
  const [mascB] = await pool.execute(
    `INSERT INTO mascotas (usuario_id, nombre, especie, raza, sexo, fecha_nacimiento, creado_por)
     VALUES (?, 'MascotaB14', 'gato', 'Siamés', 'macho', '2019-01-01', ?)`,
    [clienteBId, adminId]
  );
  mascotaBId = mascB.insertId;

  const [srv] = await pool.execute(
    `INSERT INTO servicios (nombre, descripcion, activo) VALUES ('TEST14S-Consulta', 'Consulta test 14', 1)`
  );
  servicioId = srv.insertId;

  turnoAtendidoId = await insertarTurno({
    usuarioId: clienteAId,
    mascotaId: mascotaAId,
    fechaHora: '2026-11-02 09:00:00',
    estado: 'atendido',
  });

  cookieAdmin = await login(DOC_ADMIN);
  cookieA = await login(DOC_CLIENTE_A);
  cookieB = await login(DOC_CLIENTE_B);
});

afterAll(async () => {
  // Solo se borran tablas borrables. Nunca DELETE FROM atenciones (trigger lo impide);
  // toda atención escrita en los tests va en transacciones con rollback.
  await pool.execute(
    'DELETE FROM turnos WHERE usuario_id IN (SELECT id FROM usuarios WHERE documento LIKE ?)',
    ['TEST14-%']
  );
  await pool.execute(
    'DELETE FROM notas_atencion WHERE atencion_id IN (SELECT id FROM atenciones WHERE creado_por IN (SELECT id FROM usuarios WHERE documento LIKE ?))',
    ['TEST14-%']
  );
  await pool.execute(
    'DELETE FROM mascotas WHERE usuario_id IN (SELECT id FROM usuarios WHERE documento LIKE ?)',
    ['TEST14-%']
  );
  await pool.execute('DELETE FROM servicios WHERE nombre LIKE ?', ['TEST14S-%']);
  await pool.execute('DELETE FROM usuarios WHERE documento LIKE ?', ['TEST14-%']);
  await pool.end();
});

describe('Autorización en endpoints de atención (BE-14)', () => {
  test('sin sesión → 401 NO_AUTENTICADO', async () => {
    const res = await request(app)
      .post(`/api/admin/turnos/${turnoAtendidoId}/atencion`)
      .send({ profesional_nombre: 'Juan Pérez' });
    expect(res.status).toBe(401);
    expect(res.body.codigo).toBe('NO_AUTENTICADO');
  });

  test('un cliente no puede cargar atención → 403 SIN_PERMISO', async () => {
    const res = await request(app)
      .post(`/api/admin/turnos/${turnoAtendidoId}/atencion`)
      .set('Cookie', cookieA)
      .send({ profesional_nombre: 'Juan Pérez' });
    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('SIN_PERMISO');
  });

  test('un cliente no puede agregar notas → 403 SIN_PERMISO', async () => {
    const res = await request(app)
      .post('/api/admin/atenciones/1/notas')
      .set('Cookie', cookieA)
      .send({ texto: 'Nota' });
    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('SIN_PERMISO');
  });

  test('un cliente no puede ver el historial admin de una mascota → 403', async () => {
    const res = await request(app)
      .get(`/api/admin/mascotas/${mascotaAId}/historial`)
      .set('Cookie', cookieA);
    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('SIN_PERMISO');
  });
});

describe('POST /api/admin/turnos/:id/atencion (cargar atención)', () => {
  test('turno inexistente → 404 NO_ENCONTRADO', async () => {
    const res = await request(app)
      .post('/api/admin/turnos/999999/atencion')
      .set('Cookie', cookieAdmin)
      .send({ profesional_nombre: 'Juan Pérez' });
    expect(res.status).toBe(404);
    expect(res.body.codigo).toBe('NO_ENCONTRADO');
  });

  test('turno que no está atendido → 422 TURNO_NO_ATENDIDO', async () => {
    const turnoPendiente = await insertarTurno({
      usuarioId: clienteAId,
      mascotaId: mascotaAId,
      fechaHora: '2026-11-02 10:00:00',
      estado: 'pendiente',
    });
    const res = await request(app)
      .post(`/api/admin/turnos/${turnoPendiente}/atencion`)
      .set('Cookie', cookieAdmin)
      .send({ profesional_nombre: 'Juan Pérez' });
    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('TURNO_NO_ATENDIDO');
  });

  test('datos inválidos → 400 DATOS_INVALIDOS', async () => {
    const res = await request(app)
      .post(`/api/admin/turnos/${turnoAtendidoId}/atencion`)
      .set('Cookie', cookieAdmin)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('DATOS_INVALIDOS');
  });
});

describe('Atenciones (service, transacción con rollback - sin residuos)', () => {
  test('carga una atención para un turno atendido y la devuelve completa', async () => {
    const atencion = await conTransaccion(async (conn) => {
      return await servicio.cargarAtencion(
        adminId,
        turnoAtendidoId,
        {
          profesional_nombre: 'Dra. García',
          anamnesis: 'Tos persistente',
          diagnostico: 'Bronquitis',
          tratamiento: 'Reposo',
          medicacion: 'Jarabe',
          vacunas: 'Ninguna',
          observaciones: 'Control en 15 días',
        },
        conn
      );
    });

    expect(atencion.id).toBeDefined();
    expect(atencion.turno_id).toBe(turnoAtendidoId);
    expect(atencion.profesional_nombre).toBe('Dra. García');
    expect(atencion.anamnesis).toBe('Tos persistente');
    expect(atencion.diagnostico).toBe('Bronquitis');
    expect(atencion.tratamiento).toBe('Reposo');
    expect(atencion.medicacion).toBe('Jarabe');
    expect(atencion.vacunas).toBe('Ninguna');
    expect(atencion.observaciones).toBe('Control en 15 días');
    expect(atencion.creado_por).toBe(adminId);
    expect(atencion.notas).toEqual([]);
  });

  test('no permite dos atenciones para el mismo turno → 409 ATENCION_YA_EXISTE', async () => {
    let error;
    await conTransaccion(async (conn) => {
      await servicio.cargarAtencion(adminId, turnoAtendidoId, { profesional_nombre: 'Primera' }, conn);
      try {
        await servicio.cargarAtencion(adminId, turnoAtendidoId, { profesional_nombre: 'Segunda' }, conn);
      } catch (err) {
        error = err;
      }
    });
    expect(error).toMatchObject({ status: 409, codigo: 'ATENCION_YA_EXISTE' });

    // Tras el rollback no debe quedar rastro de atención para este turno
    const [[existente]] = await pool.execute(
      'SELECT id FROM atenciones WHERE turno_id = ?',
      [turnoAtendidoId]
    );
    expect(existente).toBeUndefined();
  });

  test('rechaza turno que no está atendido', async () => {
    const turnoConfirmado = await insertarTurno({
      usuarioId: clienteAId,
      mascotaId: mascotaAId,
      fechaHora: '2026-11-02 11:00:00',
      estado: 'confirmado',
    });
    let error;
    await conTransaccion(async (conn) => {
      try {
        await servicio.cargarAtencion(adminId, turnoConfirmado, { profesional_nombre: 'X' }, conn);
      } catch (err) {
        error = err;
      }
    });
    expect(error).toMatchObject({ status: 422, codigo: 'TURNO_NO_ATENDIDO' });
  });

  test('agrega una nota aclaratoria a una atención', async () => {
    const resultado = await conTransaccion(async (conn) => {
      const atencion = await servicio.cargarAtencion(
        adminId,
        turnoAtendidoId,
        { profesional_nombre: 'Dr. Nota' },
        conn
      );
      const nota = await servicio.agregarNota(adminId, atencion.id, { texto: 'Nota aclaratoria' }, conn);
      return { atencion, nota };
    });

    expect(resultado.nota.id).toBeDefined();
    expect(resultado.nota.texto).toBe('Nota aclaratoria');
    expect(resultado.nota.creado_por).toBe(adminId);
  });

  test('nota sobre atención inexistente → 404 NO_ENCONTRADO', async () => {
    let error;
    await conTransaccion(async (conn) => {
      try {
        await servicio.agregarNota(adminId, 999999, { texto: 'Nota' }, conn);
      } catch (err) {
        error = err;
      }
    });
    expect(error).toMatchObject({ status: 404, codigo: 'NO_ENCONTRADO' });
  });

  test('trigger rechaza UPDATE y DELETE sobre atenciones (RF26)', async () => {
    let atencionId;
    await conTransaccion(async (conn) => {
      const atencion = await servicio.cargarAtencion(adminId, turnoAtendidoId, { profesional_nombre: 'Dr. X' }, conn);
      atencionId = atencion.id;

      let errUpd;
      try {
        await conn.execute('UPDATE atenciones SET anamnesis = ? WHERE id = ?', ['cambio prohibido', atencionId]);
      } catch (e) {
        errUpd = e;
      }
      expect(errUpd).toBeDefined();
      expect(errUpd.code).toBe('ER_SIGNAL_EXCEPTION');
      expect(errUpd.sqlState).toBe('45000');
      expect(errUpd.message).toContain('inmutables');

      let errDel;
      try {
        await conn.execute('DELETE FROM atenciones WHERE id = ?', [atencionId]);
      } catch (e) {
        errDel = e;
      }
      expect(errDel).toBeDefined();
      expect(errDel.code).toBe('ER_SIGNAL_EXCEPTION');
      expect(errDel.sqlState).toBe('45000');
      expect(errDel.message).toContain('no se eliminan');
    });

    // Tras el rollback no queda rastro de la atención
    const [[fila]] = await pool.execute('SELECT id FROM atenciones WHERE id = ?', [atencionId]);
    expect(fila).toBeUndefined();
  });
});

describe('Historial clínico', () => {
  test('cliente A pide el historial de una mascota ajena → 404 NO_ENCONTRADO', async () => {
    const res = await request(app)
      .get(`/api/mascotas/${mascotaBId}/historial`)
      .set('Cookie', cookieA);
    expect(res.status).toBe(404);
    expect(res.body.codigo).toBe('NO_ENCONTRADO');
  });

  test('mascota sin atenciones → historial vacío (200, [])', async () => {
    const res = await request(app).get(`/api/mascotas/${mascotaBId}/historial`).set('Cookie', cookieB);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('devuelve atenciones con notas en orden cronológico inverso', async () => {
    const historial = await conTransaccion(async (conn) => {
      const turnoViejo = await insertarTurnoConConexion(
        conn,
        clienteAId,
        mascotaAId,
        '2026-11-02 12:00:00',
        'atendido'
      );
      const turnoNuevo = await insertarTurnoConConexion(
        conn,
        clienteAId,
        mascotaAId,
        '2026-11-02 12:30:00',
        'atendido'
      );
      await conn.execute(
        `INSERT INTO atenciones (turno_id, mascota_id, profesional_nombre, creado_por, creado_en)
         VALUES (?, ?, ?, ?, '2026-11-02 09:00:00')`,
        [turnoViejo, mascotaAId, 'Veterinario Viejo', adminId]
      );
      const [atencionNueva] = await conn.execute(
        `INSERT INTO atenciones (turno_id, mascota_id, profesional_nombre, diagnostico, creado_por, creado_en)
         VALUES (?, ?, ?, ?, ?, '2026-11-02 10:00:00')`,
        [turnoNuevo, mascotaAId, 'Veterinario Nuevo', 'Diagnóstico nuevo', adminId]
      );
      const atencionNuevaId = atencionNueva.insertId;
      await conn.execute(
        `INSERT INTO notas_atencion (atencion_id, texto, creado_por)
         VALUES (?, 'Nota aclaratoria nueva', ?)`,
        [atencionNuevaId, adminId]
      );
      const historialAdmin = await servicio.obtenerHistorial(mascotaAId, {}, conn);
      const historialCliente = await servicio.obtenerHistorial(
        mascotaAId,
        { usuarioId: clienteAId },
        conn
      );
      return { historialAdmin, historialCliente };
    });

    expect(historial.historialAdmin.length).toBe(2);
    expect(historial.historialCliente.length).toBe(2);
    expect(historial.historialAdmin[0].profesional_nombre).toBe('Veterinario Nuevo');
    expect(historial.historialAdmin[0].diagnostico).toBe('Diagnóstico nuevo');
    expect(historial.historialAdmin[0].servicio_nombre).toBe('TEST14S-Consulta');
    expect(historial.historialAdmin[0].notas).toHaveLength(1);
    expect(historial.historialAdmin[0].notas[0].texto).toBe('Nota aclaratoria nueva');
    expect(historial.historialAdmin[0].notas[0].creado_por).toBe(adminId);
    expect(historial.historialAdmin[1].profesional_nombre).toBe('Veterinario Viejo');

    // El servicio respeta la propiedad del cliente: mascota ajena → 404 (datos de mascota están comprometidos, no hace falta transacción)
    let errorAjeno;
    try {
      await servicio.obtenerHistorial(mascotaBId, { usuarioId: clienteAId });
    } catch (err) {
      errorAjeno = err;
    }
    expect(errorAjeno).toMatchObject({ status: 404, codigo: 'NO_ENCONTRADO' });
  });
});

// Helper que inserta un turno usando una conexión dada (dentro de transacción).
async function insertarTurnoConConexion(conn, usuarioId, mascotaId, fechaHora, estado) {
  const [res] = await conn.execute(
    `INSERT INTO turnos (usuario_id, mascota_id, servicio_id, fecha_hora, estado, canal, creado_por)
     VALUES (?, ?, ?, ?, ?, 'web', ?)`,
    [usuarioId, mascotaId, servicioId, fechaHora, estado, usuarioId]
  );
  return res.insertId;
}
