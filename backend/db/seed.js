// Datos iniciales: admin, servicios, feriados y datos demo (DB-01 del plan).
// Uso: npm run seed  (sobre una base creada con npm run db:reset)
// Se puede volver a correr: primero limpia las tablas en orden inverso a las FK.
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const { env } = require('../src/config/env');

async function main() {
  const db = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    dateStrings: true,
  });

  try {
    // Reejecución segura: si hay atenciones cargadas no se toca nada
    // (son inmutables por RF26; para empezar de cero está db:reset).
    const [[{ total: totalAtenciones }]] = await db.query('SELECT COUNT(*) AS total FROM atenciones');
    if (totalAtenciones > 0) {
      throw new Error('Hay atenciones cargadas en la base. Ejecutá npm run db:reset antes de volver a correr el seed.');
    }

    // Limpieza para poder reejecutar el seed sin duplicar datos (orden inverso a las FK).
    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const tabla of ['notas_atencion', 'atenciones', 'turnos', 'mascotas', 'servicios', 'feriados', 'usuarios']) {
      await db.query(`DELETE FROM ${tabla}`);
    }
    await db.query('SET FOREIGN_KEY_CHECKS = 1');

    // --- Admin inicial (RF22): documento 00000000 / Admin12 ---
    const hashAdmin = await bcrypt.hash('Admin12', 10);
    const [altaAdmin] = await db.execute(
      `INSERT INTO usuarios
         (rol, documento, nombre, apellido, telefono, email, password_hash, estado_cuenta, consentimiento_at)
       VALUES ('admin', ?, ?, ?, ?, ?, ?, 'con_cuenta', NOW())`,
      ['00000000', 'Admin', 'General', '1100000000', 'admin@vetgestion.local', hashAdmin]
    );
    const adminId = altaAdmin.insertId;

    // --- Catálogo de servicios (RF19) ---
    const idsServicios = {};
    for (const nombre of ['Consulta general', 'Vacunación', 'Control de peso', 'Desparasitación', 'Castración (consulta)']) {
      const [alta] = await db.execute('INSERT INTO servicios (nombre) VALUES (?)', [nombre]);
      idsServicios[nombre] = alta.insertId;
    }

    // --- Feriados de ejemplo (RF23) ---
    await db.execute('INSERT INTO feriados (fecha, motivo) VALUES (?, ?)', ['2026-12-08', 'Inmaculada Concepción']);
    await db.execute('INSERT INTO feriados (fecha, motivo) VALUES (?, ?)', ['2026-12-25', 'Navidad']);

    // --- Clientes demo con cuenta (contraseña Demo12) ---
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

    const cliente1 = await crearClienteConCuenta({
      documento: '28765432', nombre: 'Luciana', apellido: 'García',
      telefono: '1144332210', email: 'luciana.garcia@example.com',
    });
    const cliente2 = await crearClienteConCuenta({
      documento: '31999888', nombre: 'Martín', apellido: 'Ferreyra',
      telefono: '1155667788', email: 'martin.ferreyra@example.com',
    });

    // --- Cliente sin cuenta (alta asistida RF01b): sin email ni contraseña ---
    const [altaSinCuenta] = await db.execute(
      `INSERT INTO usuarios
         (rol, documento, nombre, apellido, telefono, email, password_hash, estado_cuenta, creado_por)
       VALUES ('cliente', ?, ?, ?, ?, NULL, NULL, 'sin_cuenta', ?)`,
      ['35123456', 'Sofía', 'Peralta', '1166778899', adminId]
    );
    const clienteSinCuenta = altaSinCuenta.insertId;

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
      usuarioId: cliente1, nombre: 'Mora', especie: 'perro', raza: 'Mestiza', sexo: 'hembra',
      fechaNacimiento: '2020-03-15', peso: 18.5, esterilizado: 1,
    });
    const simon = await crearMascota({
      usuarioId: cliente1, nombre: 'Simón', especie: 'gato', raza: 'Siamés', sexo: 'macho',
      fechaNacimiento: '2019-07-02', peso: 4.2, esterilizado: 0, microchip: '981098101234567',
    });
    const toby = await crearMascota({
      usuarioId: cliente2, nombre: 'Toby', especie: 'perro', raza: 'Labrador', sexo: 'macho',
      fechaNacimiento: '2022-11-20', peso: 28.9, esterilizado: 0,
      alergias: 'Alergia a la picadura de pulgas',
    });

    // --- Turnos de ejemplo (insertados directamente por SQL, ver DB-01) ---
    async function crearTurno({ usuarioId, mascotaId, servicioId, fechaHora, estado, canal, creadoPor, motivo }) {
      await db.execute(
        `INSERT INTO turnos
           (usuario_id, mascota_id, servicio_id, fecha_hora, estado, canal, motivo, creado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [usuarioId, mascotaId, servicioId, fechaHora, estado, canal, motivo || null, creadoPor]
      );
    }

    // Pasados, en estado atendido:
    await crearTurno({
      usuarioId: cliente1, mascotaId: mora, servicioId: idsServicios['Consulta general'],
      fechaHora: '2026-10-22 10:00:00', estado: 'atendido', canal: 'web', creadoPor: cliente1,
    });
    await crearTurno({
      usuarioId: cliente2, mascotaId: toby, servicioId: idsServicios['Vacunación'],
      fechaHora: '2026-10-23 16:00:00', estado: 'atendido', canal: 'web', creadoPor: cliente2,
    });
    // Futuros:
    await crearTurno({
      usuarioId: cliente1, mascotaId: simon, servicioId: idsServicios['Control de peso'],
      fechaHora: '2026-10-28 09:30:00', estado: 'pendiente', canal: 'web', creadoPor: cliente1,
    });
    await crearTurno({
      usuarioId: cliente2, mascotaId: toby, servicioId: idsServicios['Desparasitación'],
      fechaHora: '2026-10-29 11:00:00', estado: 'confirmado', canal: 'telefonico', creadoPor: adminId,
    });
    // Cancelado (libera la franja):
    await crearTurno({
      usuarioId: cliente1, mascotaId: mora, servicioId: idsServicios['Consulta general'],
      fechaHora: '2026-10-30 15:00:00', estado: 'cancelado', canal: 'web', creadoPor: cliente1,
      motivo: 'El cliente canceló por teléfono',
    });

    
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error('Error al sembrar la base:', err.message);
  process.exit(1);
});
