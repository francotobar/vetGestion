// Resetea la base de datos: la elimina y la vuelve a crear con db/schema.sql.
// Uso: npm run db:reset
// Zona horaria del proyecto (regla 8 del plan): se fija en el código para que
// funcione en Windows, donde el prefijo TZ=... de npm no es válido.
process.env.TZ = 'America/Argentina/Buenos_Aires';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { env } = require('../src/config/env');

// Divide el archivo en sentencias interpretando las directivas DELIMITER
// (necesarias para los triggers de inmutabilidad de atenciones).
function dividirSentencias(sql) {
  const sentencias = [];
  let delimitador = ';';
  let buffer = [];

  for (const linea of sql.split(/\r?\n/)) {
    const recortada = linea.trim();
    const cambio = recortada.match(/^DELIMITER\s+(\S+)$/i);
    if (cambio) {
      delimitador = cambio[1];
      continue;
    }
    buffer.push(linea);
    if (recortada.endsWith(delimitador)) {
      const texto = buffer.join('\n').trim().slice(0, -delimitador.length).trim();
      if (texto) sentencias.push(texto);
      buffer = [];
    }
  }
  if (buffer.join('').trim()) sentencias.push(buffer.join('\n').trim());
  return sentencias;
}

async function main() {
  if (env.DB_SSL_CA) {
    throw new Error('Error: db:reset no se puede ejecutar con DB_SSL_CA configurado. Conéctate a la base local sin SSL o desactiva la variable.');
  }

  if (!/^[A-Za-z0-9_]+$/.test(env.DB_NAME)) {
    throw new Error(`Nombre de base inválido: ${env.DB_NAME}`);
  }

  const conexion = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    dateStrings: true,
  });

  try {
    await conexion.query(`DROP DATABASE IF EXISTS \`${env.DB_NAME}\``);

    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const sentencias = dividirSentencias(sql);
    for (const sentencia of sentencias) {
      await conexion.query(sentencia);
    }
    console.log(`Base "${env.DB_NAME}" recreada (${sentencias.length} sentencias ejecutadas).`);
  } finally {
    await conexion.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Error al resetear la base:', err.message);
    process.exit(1);
  });
}

module.exports = { dividirSentencias };
