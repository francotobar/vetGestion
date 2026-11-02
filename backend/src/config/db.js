// Conexión a MySQL: un único pool para toda la aplicación.
// dateStrings: true → las fechas llegan como 'YYYY-MM-DD' / 'YYYY-MM-DD HH:mm:ss'
// (regla 8 del plan: guardar DATETIME locales sin zona).
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { env } = require('./env');

function obtenerSSLCA(sslCa) {
  if (!sslCa) return null;
  const esContenidoCertificado = sslCa.startsWith('-----BEGIN');
  if (esContenidoCertificado) {
    return sslCa.replace(/\\n/g, '\n');
  }
  try {
    return fs.readFileSync(path.resolve(sslCa), 'utf8');
  } catch {
    return sslCa;
  }
}

const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
  ssl: env.DB_SSL_CA ? { ca: obtenerSSLCA(env.DB_SSL_CA), rejectUnauthorized: true } : undefined,
});

async function probarConexion() {
  await pool.query('SELECT 1');
}

module.exports = { pool, probarConexion };
