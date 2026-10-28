const servicio = require('./service');
const { ApiError } = require('../../utils/errores');

function parsearId(req) {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function listarActivos(req, res, next) {
  try {
    res.json(await servicio.listarActivos());
  } catch (err) {
    next(err);
  }
}

async function listarTodos(req, res, next) {
  try {
    res.json(await servicio.listarTodos());
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    res.status(201).json(await servicio.crear(req.body));
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const id = parsearId(req);
    if (!id) throw new ApiError(404, 'NO_ENCONTRADO', 'El servicio no existe');
    res.json(await servicio.actualizar(id, req.body));
  } catch (err) {
    next(err);
  }
}

module.exports = { listarActivos, listarTodos, crear, actualizar };
