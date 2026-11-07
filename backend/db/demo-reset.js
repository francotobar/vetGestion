// Restablece la base de demostración: borra sus tablas en orden seguro, vuelve a
// aplicar db/schema.sql (con token_version y los triggers de atenciones) y carga
// los datos de demostración. Uso: npm run demo:reset
// - Borra tablas, no la base: no requiere privilegio DROP DATABASE.
// - Antes de borrar nada: comprueba que el usuario puede crear triggers.
// - Muestra host y base (nunca contraseñas) y pide escribir el nombre de la base.
// - Con DB_SSL_CA (base remota) exige SEED_ADMIN_PASSWORD. Llama a la carga de
//   datos directamente; la guarda de npm run seed no se aplica a este script.
// Zona horaria del proyecto (regla 8 del plan): se fija en el código para que
// funcione en Windows, donde el prefijo TZ=... de npm no es válido.
process.env.TZ = 'America/Argentina/Buenos_Aires';

const fs = require('fs');
const path = require('path');
const readline = require('readline/promises');
const mysql = require('mysql2/promise');
const { env } = require('../src/config/env');
const { opcionesSSL } = require('../src/config/ssl');
const { dividirSentencias } = require('./reset');
const { cargarDatosDemo, obtenerPasswordAdmin } = require('./datos-demo');

// Orden seguro: primero las tablas que dependen de otras (hijas) y después las referenciadas.
const TABLAS = ['notas_atencion', 'atenciones', 'turnos', 'mascotas', 'servicios', 'feriados', 'usuarios'];

function configuracionConexion(extra = {}) {
  return {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl: opcionesSSL(env.DB_SSL_CA),
    dateStrings: true,
    ...extra,
  };
}

// schema.sql crea triggers. Con el binlog activo MySQL exige SUPER o
// log_bin_trust_function_creators. Se comprueba antes de borrar nada.
async function verificarPermisoParaTriggers(conexion) {
  await conexion.query('DROP TABLE IF EXISTS demo_reset_prueba');
  try {
    await conexion.query('CREATE TABLE demo_reset_prueba (id INT)');
    await conexion.query(
      'CREATE TRIGGER demo_reset_prueba_t BEFORE INSERT ON demo_reset_prueba FOR EACH ROW SET NEW.id = NEW.id'
    );
  } catch (err) {
    throw new Error(
      `el usuario no puede crear triggers (${err.message}). No se borró nada. ` +
        'Con el binlog activo se necesita SUPER o log_bin_trust_function_creators=1.'
    );
  } finally {
    await conexion.query('DROP TABLE IF EXISTS demo_reset_prueba');
  }
}

async function main() {
  if (env.DB_NAME !== 'vetgestion') {
    throw new Error(`schema.sql crea y usa la base "vetgestion" y DB_NAME es "${env.DB_NAME}".`);
  }

  // Se valida antes de pedir confirmación: si falta la contraseña, no se empieza.
  const passwordAdmin = obtenerPasswordAdmin({ requerida: Boolean(env.DB_SSL_CA) });

  console.log(`Host: ${env.DB_HOST}   Base: ${env.DB_NAME}   SSL: ${env.DB_SSL_CA ? 'sí' : 'no'}`);
  console.log('Se borran todas las tablas de esta base y se cargan datos de demostración.');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const respuesta = (await rl.question('Para confirmar, escribí el nombre de la base: ')).trim();
  rl.close();
  if (respuesta !== env.DB_NAME) {
    throw new Error('El nombre no coincide. No se hizo ningún cambio.');
  }

  const conexionBase = await mysql.createConnection(configuracionConexion({ database: env.DB_NAME }));
  try {
    await verificarPermisoParaTriggers(conexionBase);
    for (const tabla of TABLAS) {
      await conexionBase.query(`DROP TABLE IF EXISTS \`${tabla}\``);
    }
  } finally {
    await conexionBase.end();
  }

  // schema.sql incluye CREATE DATABASE y USE: se aplica sin base seleccionada.
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const conexionEsquema = await mysql.createConnection(configuracionConexion());
  try {
    for (const sentencia of dividirSentencias(sql)) {
      await conexionEsquema.query(sentencia);
    }
  } finally {
    await conexionEsquema.end();
  }
  console.log('Esquema aplicado.');

  const conexionDatos = await mysql.createConnection(configuracionConexion({ database: env.DB_NAME }));
  try {
    await cargarDatosDemo(conexionDatos, { passwordAdmin });
  } finally {
    await conexionDatos.end();
  }
  console.log('Base de demostración lista.');
}

main().catch((err) => {
  console.error('Error al restablecer la base de demostración:', err.message);
  process.exit(1);
});
