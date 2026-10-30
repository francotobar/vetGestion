const servicio = require('./service');
const { ApiError } = require('../../utils/errores');
const { esFechaValida } = require('../../utils/fechas');

async function listar(req, res, next) {
  try {
    res.json(await servicio.listar());
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

async function eliminar(req, res, next) {
  try {
    // El :fecha de la ruta debe ser una fecha válida; si no lo es, es un 400.
    if (!esFechaValida(req.params.fecha)) {
      throw new ApiError(400, 'DATOS_INVALIDOS', 'La fecha debe ser válida (YYYY-MM-DD)');
    }
    res.json(await servicio.eliminar(req.params.fecha));
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, crear, eliminar };
