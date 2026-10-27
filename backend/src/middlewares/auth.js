const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { pool } = require('../config/db');

// Valida la cookie de sesión (JWT) y carga req.usuario con los datos públicos
// del usuario vigente (sin password ni intentos).
async function auth(req, res, next) {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ codigo: 'NO_AUTENTICADO', mensaje: 'Debe iniciar sesión' });
    }

    let datos;
    try {
      datos = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ codigo: 'NO_AUTENTICADO', mensaje: 'La sesión es inválida o expiró' });
    }

    const [[usuario]] = await pool.execute(
      `SELECT id, rol, documento, nombre, apellido, telefono, email
         FROM usuarios
        WHERE id = ? AND estado_cuenta = 'con_cuenta' AND bloqueado = 0`,
      [datos.id]
    );
    if (!usuario) {
      return res.status(401).json({ codigo: 'NO_AUTENTICADO', mensaje: 'La sesión es inválida o expiró' });
    }

    req.usuario = usuario;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { auth };
