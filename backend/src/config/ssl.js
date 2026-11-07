// Configuración SSL de MySQL compartida por el pool de la aplicación y los
// scripts de base (db/demo-reset.js). DB_SSL_CA puede ser una ruta al
// certificado o su contenido PEM.
const fs = require('fs');
const path = require('path');

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

function opcionesSSL(sslCa) {
  return sslCa ? { ca: obtenerSSLCA(sslCa), rejectUnauthorized: true } : undefined;
}

module.exports = { obtenerSSLCA, opcionesSSL };
