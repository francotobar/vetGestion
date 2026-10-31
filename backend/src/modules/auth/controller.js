const servicio = require('./service');
const { env } = require('../../config/env');

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
    // BE-16 (plan, sección 7): sin SMTP, el "envío" del enlace se simula
    // imprimiéndolo por la consola del servidor. Solo se imprime si el email
    // corresponde a una cuenta existente (para el resto no hay destinatario).
    if (resultado.usuario) {
      const enlace = `${env.FRONTEND_URL}/restablecer?token=${resultado.token}`;
      console.log(
        `[Recuperación de contraseña] Enlace para ${resultado.usuario.email}: ${enlace} (vence ${resultado.expira})`
      );
    }
    // Responde siempre lo mismo exista o no el email, y sin token en el
    // cuerpo: el enlace solo viaja por consola (plan, BE-16).
    res.json({ mensaje: 'Si el email existe, se ha enviado un enlace de recuperación. Revisa la consola.' });
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
