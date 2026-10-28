const servicio = require('./service');
const { ApiError } = require('../../utils/errores');
const { disponibilidadQuerySchema } = require('./schema');

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

module.exports = { disponibilidad, crear };
