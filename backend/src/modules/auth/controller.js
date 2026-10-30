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

async function recuperar(req, res, next) {
  try {
    const resultado = await servicio.recuperarPorEmail(req.body.email);
    const base = { mensaje: 'Si el email existe, se ha enviado un enlace de recuperación. Revisa la consola.' };
    if (resultado.usuario) {
      base.token = resultado.token;
      base.expira = resultado.expira;
    } else {
      // Cuando el email no existe, aun así devolvemos token para que la
      // respuesta sea idéntica estructura aunque el token no sea usable.
      base.token = resultado.token;
      base.expira = resultado.expira;
    }
    res.json(base);
  } catch (err) {
    next(err);
  }
}

async function restablecer(req, res, next) {
  try {
    const resultado = await servicio.restablecerPorToken(req.body);
    res.json({ mensaje: 'Contraseña restablecida correctamente', cliente: resultado.cliente });
  } catch (err) {
    next(err);
  }
}

module.exports = { registro, login, logout, me, recuperar, restablecer };
