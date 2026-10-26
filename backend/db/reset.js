// Resetea la base de datos: la elimina y la vuelve a crear con db/schema.sql.
// Uso: npm run db:reset
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
  if (!/^[A-Za-z0-9_]+$/.test(env.DB_NAME)) {
    throw new Error(`Nombre de base inválido: ${env.DB_NAME}`);
  }

  const conexion = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
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

main().catch((err) => {
  console.error('Error al resetear la base:', err.message);
  process.exit(1);
});
