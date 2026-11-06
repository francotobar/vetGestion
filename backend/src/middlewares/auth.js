const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { pool } = require('../config/db');

// Valida la cookie de sesión (JWT) y carga req.usuario con los datos públicos
// del usuario vigente (sin password ni intentos).
// La sesión es revocable: el JWT lleva la versión del usuario (tv) y debe
// coincidir con usuarios.token_version. Cerrar sesión, restablecer la
// contraseña o desbloquear con contraseña temporal incrementa esa versión.
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

    if (typeof datos.tv !== 'number') {
      return sesionRevocada(res);
    }

    const [[fila]] = await pool.execute(
      `SELECT id, rol, documento, nombre, apellido, telefono, email, token_version
         FROM usuarios
        WHERE id = ? AND estado_cuenta = 'con_cuenta' AND bloqueado = 0`,
      [datos.id]
    );
    if (!fila || fila.token_version !== datos.tv) {
      return sesionRevocada(res);
    }

    const { token_version: _version, ...usuario } = fila;
    req.usuario = usuario;
    next();
  } catch (err) {
    next(err);
  }
}

function sesionRevocada(res) {
  return res.status(401).json({
    codigo: 'SESION_REVOCADA',
    mensaje: 'La sesión ya no es válida. Iniciá sesión nuevamente',
  });
}

module.exports = { auth };
