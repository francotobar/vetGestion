// Carga los datos de demostración (ver db/datos-demo.js).
// Uso: npm run seed  (sobre una base creada con npm run db:reset)
// Se puede volver a correr: primero limpia las tablas en orden inverso a las FK.
// Zona horaria del proyecto (regla 8 del plan): se fija en el código para que
// funcione en Windows, donde el prefijo TZ=... de npm no es válido.
process.env.TZ = 'America/Argentina/Buenos_Aires';

const mysql = require('mysql2/promise');
const { env } = require('../src/config/env');
const { cargarDatosDemo, obtenerPasswordAdmin } = require('./datos-demo');

async function main() {
  if (env.DB_SSL_CA) {
    throw new Error('Error: npm run seed no se puede ejecutar con DB_SSL_CA configurado. Conéctate a la base local sin SSL o desactiva la variable.');
  }

  const passwordAdmin = obtenerPasswordAdmin({ requerida: false });

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
    // (son inmutables por RF19; para empezar de cero está demo:reset).
    const [[{ total: totalAtenciones }]] = await db.query('SELECT COUNT(*) AS total FROM atenciones');
    if (totalAtenciones > 0) {
      throw new Error('Hay atenciones cargadas en la base. Ejecutá npm run demo:reset antes de volver a correr el seed.');
    }

    // Limpieza para poder reejecutar el seed sin duplicar datos (orden inverso a las FK).
    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const tabla of ['notas_atencion', 'atenciones', 'turnos', 'mascotas', 'servicios', 'feriados', 'usuarios']) {
      await db.query(`DELETE FROM ${tabla}`);
    }
    await db.query('SET FOREIGN_KEY_CHECKS = 1');

    await cargarDatosDemo(db, { passwordAdmin });
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error('Error al sembrar la base:', err.message);
  process.exit(1);
});
