// Datos de demostración: admin, servicios, feriados, clientes, mascotas, turnos
// en todos los estados y atenciones con nota aclaratoria. Todos ficticios
// (dominio example.com, documentos 9000000X). Las fechas de los turnos son
// relativas a la fecha de ejecución. Lo usan npm run seed y npm run demo:reset.
const bcrypt = require('bcryptjs');

const FERIADOS = [
  { fecha: '2026-12-08', motivo: 'Inmaculada Concepción' },
  { fecha: '2026-12-25', motivo: 'Navidad' },
];
const REGLA_PASSWORD = /^(?=(?:.*\d){2,}).{6,}$/;

function aFecha(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function esHabil(d) {
  const dia = d.getDay();
  return dia !== 0 && dia !== 6 && !FERIADOS.some((f) => f.fecha === aFecha(d));
}

// n > 0: n-ésimo día hábil a partir de mañana. n < 0: n-ésimo día hábil anterior a hoy.
function diaHabil(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const paso = n > 0 ? 1 : -1;
  let restantes = Math.abs(n);
  while (restantes > 0) {
    d.setDate(d.getDate() + paso);
    if (esHabil(d)) restantes -= 1;
  }
  return aFecha(d);
}

// Contraseña del administrador: SEED_ADMIN_PASSWORD si está definida (validada
// con la regla de contraseña), o la contraseña de demo local. Con requerida = true
// (bases con SSL) la variable es obligatoria.
function obtenerPasswordAdmin({ requerida }) {
  const valor = process.env.SEED_ADMIN_PASSWORD;
  if (!valor) {
    if (requerida) {
      throw new Error('Falta SEED_ADMIN_PASSWORD. Con DB_SSL_CA configurada debe definirse (6 caracteres y 2 números).');
    }
    return 'Admin12';
  }
  if (!REGLA_PASSWORD.test(valor)) {
    throw new Error('SEED_ADMIN_PASSWORD debe tener al menos 6 caracteres y 2 números.');
  }
  return valor;
}

// Carga los datos de demostración sobre una base con el esquema ya aplicado y vacía.
async function cargarDatosDemo(db, { passwordAdmin }) {
  // --- Admin inicial ---
  const hashAdmin = await bcrypt.hash(passwordAdmin, 10);
  const [altaAdmin] = await db.execute(
    `INSERT INTO usuarios
       (rol, documento, nombre, apellido, telefono, email, password_hash, estado_cuenta, consentimiento_at)
     VALUES ('admin', ?, ?, ?, ?, ?, ?, 'con_cuenta', NOW())`,
    ['00000000', 'Administrador', 'Demo', '1100000000', 'admin@example.com', hashAdmin]
  );
  const adminId = altaAdmin.insertId;

  // --- Catálogo de servicios (RF13) ---
  const idsServicios = {};
  for (const nombre of ['Consulta general', 'Vacunación', 'Control de peso', 'Desparasitación', 'Castración (consulta)']) {
    const [alta] = await db.execute('INSERT INTO servicios (nombre) VALUES (?)', [nombre]);
    idsServicios[nombre] = alta.insertId;
  }

  // --- Feriados de ejemplo (RF16) ---
  for (const feriado of FERIADOS) {
    await db.execute('INSERT INTO feriados (fecha, motivo) VALUES (?, ?)', [feriado.fecha, feriado.motivo]);
  }

  // --- Clientes con cuenta (contraseña de demo Demo12) ---
  const hashDemo = await bcrypt.hash('Demo12', 10);
  async function crearClienteConCuenta({ documento, nombre, apellido, telefono, email }) {
    const [alta] = await db.execute(
      `INSERT INTO usuarios
         (rol, documento, nombre, apellido, telefono, email, password_hash, estado_cuenta, consentimiento_at, creado_por)
       VALUES ('cliente', ?, ?, ?, ?, ?, ?, 'con_cuenta', NOW(), ?)`,
      [documento, nombre, apellido, telefono, email, hashDemo, adminId]
    );
    return alta.insertId;
  }

  const laura = await crearClienteConCuenta({
    documento: '90000001', nombre: 'Laura', apellido: 'Ejemplo',
    telefono: '1100000001', email: 'laura.ejemplo@example.com',
  });
  const tomas = await crearClienteConCuenta({
    documento: '90000002', nombre: 'Tomás', apellido: 'Prueba',
    telefono: '1100000002', email: 'tomas.prueba@example.com',
  });
  // Cliente con cuenta y sin mascotas (para mostrar la ficha vacía).
  await crearClienteConCuenta({
    documento: '90000003', nombre: 'Carla', apellido: 'Demo',
    telefono: '1100000003', email: 'carla.demo@example.com',
  });

  // --- Cliente sin cuenta (alta asistida RF01b): sin email ni contraseña ---
  const [altaSinCuenta] = await db.execute(
    `INSERT INTO usuarios
       (rol, documento, nombre, apellido, telefono, email, password_hash, estado_cuenta, creado_por)
     VALUES ('cliente', ?, ?, ?, ?, NULL, NULL, 'sin_cuenta', ?)`,
    ['90000004', 'Sofía', 'Ficticia', '1100000004', adminId]
  );
  const sofia = altaSinCuenta.insertId;

  // --- Mascotas (RF06) ---
  async function crearMascota({ usuarioId, nombre, especie, raza, sexo, fechaNacimiento, peso, esterilizado, microchip, alergias }) {
    const [alta] = await db.execute(
      `INSERT INTO mascotas
         (usuario_id, nombre, especie, raza, sexo, fecha_nacimiento, peso_kg, esterilizado, microchip, alergias_condiciones, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [usuarioId, nombre, especie, raza, sexo, fechaNacimiento, peso, esterilizado, microchip || null, alergias || null, adminId]
    );
    return alta.insertId;
  }

  const mora = await crearMascota({
    usuarioId: laura, nombre: 'Mora', especie: 'perro', raza: 'Mestiza', sexo: 'hembra',
    fechaNacimiento: '2020-03-15', peso: 18.5, esterilizado: 1,
  });
  const simon = await crearMascota({
    usuarioId: laura, nombre: 'Simón', especie: 'gato', raza: 'Siamés', sexo: 'macho',
    fechaNacimiento: '2019-07-02', peso: 4.2, esterilizado: 0, microchip: '900000000000001',
  });
  const toby = await crearMascota({
    usuarioId: tomas, nombre: 'Toby', especie: 'perro', raza: 'Labrador', sexo: 'macho',
    fechaNacimiento: '2022-11-20', peso: 28.9, esterilizado: 0,
    alergias: 'Alergia a la picadura de pulgas',
  });
  const luna = await crearMascota({
    usuarioId: tomas, nombre: 'Luna', especie: 'gato', raza: 'Común europeo', sexo: 'hembra',
    fechaNacimiento: '2021-05-10', peso: 3.8, esterilizado: 1,
  });
  // Mascota dada de baja (baja lógica, RF05): no aparece en la ficha ni recibe reservas.
  await db.execute('UPDATE mascotas SET activa = 0, modificado_por = ? WHERE id = ?', [adminId, luna]);
  const rufo = await crearMascota({
    usuarioId: sofia, nombre: 'Rufo', especie: 'perro', raza: 'Mestizo', sexo: 'macho',
    fechaNacimiento: '2018-01-30', peso: 12.0, esterilizado: 0,
  });

  // --- Turnos de ejemplo (insertados por SQL). Hora en franjas de 30 min. ---
  async function crearTurno({ usuarioId, mascotaId, servicioId, fecha, hora, estado, canal, creadoPor, motivo }) {
    const [alta] = await db.execute(
      `INSERT INTO turnos
         (usuario_id, mascota_id, servicio_id, fecha_hora, estado, canal, motivo, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [usuarioId, mascotaId, servicioId, `${fecha} ${hora}:00`, estado, canal, motivo || null, creadoPor]
    );
    return alta.insertId;
  }

  async function registrarAtencion({ turnoId, mascotaId, profesional, anamnesis, diagnostico, tratamiento, medicacion, vacunas, observaciones }) {
    const [alta] = await db.execute(
      `INSERT INTO atenciones
         (turno_id, mascota_id, profesional_nombre, anamnesis, diagnostico, tratamiento, medicacion, vacunas, observaciones, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [turnoId, mascotaId, profesional, anamnesis, diagnostico, tratamiento, medicacion, vacunas, observaciones, adminId]
    );
    return alta.insertId;
  }

  async function agregarNota(atencionId, texto) {
    await db.execute(
      'INSERT INTO notas_atencion (atencion_id, texto, creado_por) VALUES (?, ?, ?)',
      [atencionId, texto, adminId]
    );
  }

  const consulta = idsServicios['Consulta general'];
  const vacunacion = idsServicios['Vacunación'];
  const control = idsServicios['Control de peso'];
  const desparasitacion = idsServicios['Desparasitación'];

  // Futuros (próximos días hábiles):
  await crearTurno({
    usuarioId: laura, mascotaId: mora, servicioId: consulta,
    fecha: diaHabil(1), hora: '09:00', estado: 'pendiente', canal: 'web', creadoPor: laura,
  });
  await crearTurno({
    usuarioId: laura, mascotaId: simon, servicioId: control,
    fecha: diaHabil(2), hora: '14:00', estado: 'confirmado', canal: 'telefonico', creadoPor: adminId,
  });
  await crearTurno({
    usuarioId: laura, mascotaId: mora, servicioId: consulta,
    fecha: diaHabil(2), hora: '17:30', estado: 'cancelado', canal: 'web', creadoPor: laura,
    motivo: 'Cancelado por el cliente',
  });
  await crearTurno({
    usuarioId: tomas, mascotaId: toby, servicioId: vacunacion,
    fecha: diaHabil(3), hora: '18:00', estado: 'confirmado', canal: 'presencial', creadoPor: adminId,
  });
  await crearTurno({
    usuarioId: tomas, mascotaId: toby, servicioId: desparasitacion,
    fecha: diaHabil(4), hora: '09:00', estado: 'pendiente', canal: 'web', creadoPor: tomas,
  });
  await crearTurno({
    usuarioId: sofia, mascotaId: rufo, servicioId: consulta,
    fecha: diaHabil(5), hora: '14:00', estado: 'confirmado', canal: 'telefonico', creadoPor: adminId,
  });

  // Pasados, con atención cargada y nota aclaratoria:
  const turnoMora = await crearTurno({
    usuarioId: laura, mascotaId: mora, servicioId: consulta,
    fecha: diaHabil(-5), hora: '09:00', estado: 'atendido', canal: 'web', creadoPor: laura,
  });
  const atencionMora = await registrarAtencion({
    turnoId: turnoMora, mascotaId: mora, profesional: 'Profesional Demo',
    anamnesis: 'Control general. Mucosas rosadas y buen estado general.',
    diagnostico: 'Sin hallazgos relevantes.',
    tratamiento: 'Ninguno.',
    medicacion: 'Ninguna.',
    vacunas: 'Antirrábica al día (dato de demostración).',
    observaciones: 'Control anual. Próximo control en 12 meses.',
  });
  await agregarNota(atencionMora, 'Peso corregido: 18,3 kg (dato de demostración).');

  const turnoToby = await crearTurno({
    usuarioId: tomas, mascotaId: toby, servicioId: vacunacion,
    fecha: diaHabil(-3), hora: '18:00', estado: 'atendido', canal: 'presencial', creadoPor: adminId,
  });
  await registrarAtencion({
    turnoId: turnoToby, mascotaId: toby, profesional: 'Profesional Demo',
    anamnesis: 'Vacunación antirrábica anual.',
    diagnostico: 'Paciente sano.',
    tratamiento: 'Ninguno.',
    medicacion: 'Ninguna.',
    vacunas: 'Antirrábica aplicada.',
    observaciones: null,
  });

  // Pasados sin atención: ausente.
  await crearTurno({
    usuarioId: tomas, mascotaId: luna, servicioId: control,
    fecha: diaHabil(-4), hora: '14:00', estado: 'ausente', canal: 'telefonico', creadoPor: adminId,
  });
  await crearTurno({
    usuarioId: laura, mascotaId: simon, servicioId: control,
    fecha: diaHabil(-6), hora: '17:30', estado: 'ausente', canal: 'web', creadoPor: laura,
  });
}

module.exports = { cargarDatosDemo, obtenerPasswordAdmin, FERIADOS };
