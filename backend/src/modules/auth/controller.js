const servicio = require('./service');

async function registro(req, res, next) {
  try {
    await servicio.registro(req.body);
    // Decisión: el registro no crea sesión; el cliente inicia sesión después.
    res.status(201).json({ mensaje: 'Registro exitoso. Ya podés iniciar sesión.' });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const usuario = await servicio.login(req.body, res);
    res.json({ mensaje: 'Sesión iniciada', usuario });
  } catch (err) {
    next(err);
  }
}

function logout(req, res, next) {
  try {
    res.json(servicio.cerrarSesion(res));
  } catch (err) {
    next(err);
  }
}

function me(req, res) {
  res.json(req.usuario);
}

module.exports = { registro, login, logout, me };
