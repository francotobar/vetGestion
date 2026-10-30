const servicio = require('./service');
const { ApiError } = require('../../utils/errores');

function parsearId(req) {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function idInvalido(recurso) {
  return new ApiError(404, 'NO_ENCONTRADO', `El ${recurso} no existe`);
}

// POST /admin/turnos/:id/atencion (RF26, BE-14).
async function cargarAtencion(req, res, next) {
  try {
    const turnoId = parsearId(req);
    if (!turnoId) throw idInvalido('turno');
    res.status(201).json(await servicio.cargarAtencion(req.usuario.id, turnoId, req.body));
  } catch (err) {
    next(err);
  }
}

// GET /api/mascotas/:id/historial (cliente) y GET /admin/mascotas/:id/historial (admin).
async function historial(req, res, next) {
  try {
    const mascotaId = parsearId(req);
    if (!mascotaId) throw idInvalido('mascota');
    const esAdmin = req.usuario.rol === 'admin';
    res.json(await servicio.obtenerHistorial(mascotaId, esAdmin ? {} : { usuarioId: req.usuario.id }));
  } catch (err) {
    next(err);
  }
}

// POST /admin/atenciones/:id/notas (RF27, BE-14).
async function agregarNota(req, res, next) {
  try {
    const atencionId = parsearId(req);
    if (!atencionId) throw idInvalido('atención');
    res.status(201).json(await servicio.agregarNota(req.usuario.id, atencionId, req.body));
  } catch (err) {
    next(err);
  }
}

module.exports = { cargarAtencion, historial, agregarNota };
