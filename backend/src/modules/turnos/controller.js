const servicio = require('./service');
const { ApiError } = require('../../utils/errores');
const { disponibilidadQuerySchema } = require('./schema');

// El :id de la ruta debe ser un entero positivo; si no lo es, responde 404 NO_ENCONTRADO.
function parsearId(req) {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function idInvalido() {
  return new ApiError(404, 'NO_ENCONTRADO', 'El turno no existe');
}

// GET /turnos/disponibilidad?fecha=YYYY-MM-DD (cliente y admin, sección 6).
async function disponibilidad(req, res, next) {
  try {
    const consulta = disponibilidadQuerySchema.safeParse(req.query);
    if (!consulta.success) {
      throw new ApiError(400, 'DATOS_INVALIDOS', 'La fecha es obligatoria y debe ser válida (YYYY-MM-DD)');
    }
    res.json(await servicio.disponibilidad(consulta.data.fecha));
  } catch (err) {
    next(err);
  }
}

// POST /turnos (reserva del cliente, RF09).
async function crear(req, res, next) {
  try {
    res.status(201).json(await servicio.crearComoCliente(req.usuario.id, req.body));
  } catch (err) {
    next(err);
  }
}

// GET /turnos/mios (cliente, RF10).
async function misTurnos(req, res, next) {
  try {
    res.json(await servicio.misTurnos(req.usuario.id));
  } catch (err) {
    next(err);
  }
}

// PATCH /turnos/:id/cancelar (cliente, RF11).
async function cancelar(req, res, next) {
  try {
    const id = parsearId(req);
    if (!id) throw idInvalido();
    res.json(await servicio.cancelarComoCliente(req.usuario.id, id));
  } catch (err) {
    next(err);
  }
}

// PATCH /turnos/:id/reprogramar (cliente, RF11).
async function reprogramar(req, res, next) {
  try {
    const id = parsearId(req);
    if (!id) throw idInvalido();
    res.json(await servicio.reprogramarComoCliente(req.usuario.id, id, req.body));
  } catch (err) {
    next(err);
  }
}

// GET /admin/turnos?desde=&hasta=&estado= (admin, RF21, BE-10).
async function agendaAdmin(req, res, next) {
  try {
    const { agendaAdminQuerySchema } = require('./schema');
    const consulta = agendaAdminQuerySchema.safeParse(req.query);
    if (!consulta.success) {
      const mensaje = consulta.error.issues.map((i) => i.message).join(' | ');
      throw new ApiError(400, 'DATOS_INVALIDOS', mensaje);
    }
    res.json(await servicio.listarAgendaAdmin(consulta.data));
  } catch (err) {
    next(err);
  }
}

// POST /admin/turnos (admin, RF21, BE-10).
async function crearAdmin(req, res, next) {
  try {
    res.status(201).json(await servicio.crearComoAdmin(req.usuario.id, req.body));
  } catch (err) {
    next(err);
  }
}

// PATCH /admin/turnos/:id/estado (admin, RF21, BE-11).
async function cambiarEstadoAdmin(req, res, next) {
  try {
    const id = parsearId(req);
    if (!id) throw idInvalido();
    res.json(await servicio.cambiarEstado(req.usuario.id, id, req.body.estado));
  } catch (err) {
    next(err);
  }
}

// PATCH /admin/turnos/:id/reprogramar (admin, RF21, BE-11).
async function reprogramarAdmin(req, res, next) {
  try {
    const id = parsearId(req);
    if (!id) throw idInvalido();
    res.json(await servicio.reprogramarComoAdmin(req.usuario.id, id, req.body));
  } catch (err) {
    next(err);
  }
}

// POST /admin/turnos/:id/urgencia (admin, RF25, BE-11).
async function urgenciaAdmin(req, res, next) {
  try {
    const id = parsearId(req);
    if (!id) throw idInvalido();
    res.json(await servicio.urgencia(req.usuario.id, id, req.body));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  disponibilidad,
  crear,
  misTurnos,
  cancelar,
  reprogramar,
  agendaAdmin,
  crearAdmin,
  cambiarEstadoAdmin,
  reprogramarAdmin,
  urgenciaAdmin,
};
