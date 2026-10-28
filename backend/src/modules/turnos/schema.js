const { z } = require('zod');
const { esFechaValida } = require('../../utils/fechas');

// GET /turnos/disponibilidad?fecha=YYYY-MM-DD
const disponibilidadQuerySchema = z.object({
  fecha: z
    .string({ required_error: 'Falta la fecha' })
    .refine(esFechaValida, 'La fecha debe ser válida (YYYY-MM-DD)'),
});

// POST /turnos (reserva del cliente, RF09). Zod valida solo el formato de los
// datos: las reglas de negocio (día laborable, feriado, plazo, franja libre)
// viven en turnos.service (sección 5) y responden 422 FRANJA_INVALIDA.
const enteroPositivo = (campo, nombre) =>
  z
    .number({ required_error: `Falta ${nombre}`, invalid_type_error: `${nombre} debe ser un número` })
    .int(`${nombre} debe ser un número entero`)
    .positive(`${nombre} debe ser un número positivo`);

const crearTurnoSchema = z.object({
  mascota_id: enteroPositivo('mascota_id', 'La mascota'),
  servicio_id: enteroPositivo('servicio_id', 'El servicio'),
  fecha: z
    .string({ required_error: 'Falta la fecha' })
    .refine(esFechaValida, 'La fecha debe ser válida (YYYY-MM-DD)'),
  hora: z
    .string({ required_error: 'Falta la hora' })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe tener formato HH:MM'),
});

module.exports = { disponibilidadQuerySchema, crearTurnoSchema };
