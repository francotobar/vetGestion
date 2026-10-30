const servicio = require('./service');
const { ApiError } = require('../../utils/errores');

// El :id de la ruta debe ser un entero positivo; si no lo es, es "no existe".
function parsearId(req) {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function idInvalido() {
  return new ApiError(404, 'NO_ENCONTRADO', 'La mascota no existe');
}

async function listar(req, res, next) {
  try {
    res.json(await servicio.listar(req.usuario.id));
  } catch (err) {
    next(err);
  }
}

async function obtener(req, res, next) {
  try {
    const id = parsearId(req);
    if (!id) throw idInvalido();
    res.json(await servicio.obtener(req.usuario.id, id));
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const mascota = await servicio.crear(req.usuario.id, req.body);
    res.status(201).json(mascota);
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const id = parsearId(req);
    if (!id) throw idInvalido();
    res.json(await servicio.actualizar(req.usuario.id, id, req.body));
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    const id = parsearId(req);
    if (!id) throw idInvalido();
    res.json(await servicio.eliminar(req.usuario.id, id));
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
