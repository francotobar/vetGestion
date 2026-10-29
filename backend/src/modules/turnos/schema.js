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

const reprogramarTurnoSchema = z.object({
  fecha: z
    .string({ required_error: 'Falta la fecha' })
    .refine(esFechaValida, 'La fecha debe ser válida (YYYY-MM-DD)'),
  hora: z
    .string({ required_error: 'Falta la hora' })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe tener formato HH:MM'),
});

// GET /admin/turnos?desde=&hasta=&estado=
const agendaAdminQuerySchema = z.object({
  desde: z
    .string()
    .refine(esFechaValida, 'El parámetro "desde" debe ser una fecha válida (YYYY-MM-DD)')
    .optional(),
  hasta: z
    .string()
    .refine(esFechaValida, 'El parámetro "hasta" debe ser una fecha válida (YYYY-MM-DD)')
    .optional(),
  estado: z
    .enum(['pendiente', 'confirmado', 'atendido', 'ausente', 'cancelado'], {
      errorMap: () => ({ message: 'Estado de turno no válido' }),
    })
    .optional(),
});

// POST /admin/turnos (turno manual por admin, RF21)
const crearTurnoAdminSchema = z.object({
  usuario_id: enteroPositivo('usuario_id', 'El cliente'),
  mascota_id: enteroPositivo('mascota_id', 'La mascota'),
  servicio_id: enteroPositivo('servicio_id', 'El servicio'),
  fecha: z
    .string({ required_error: 'Falta la fecha' })
    .refine(esFechaValida, 'La fecha debe ser válida (YYYY-MM-DD)'),
  hora: z
    .string({ required_error: 'Falta la hora' })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe tener formato HH:MM'),
  canal: z.enum(['telefonico', 'presencial'], {
    errorMap: () => ({ message: 'El canal debe ser "telefonico" o "presencial"' }),
  }),
});

// PATCH /admin/turnos/:id/estado (admin, RF21, BE-11)
const cambiarEstadoSchema = z.object({
  estado: z.enum(['pendiente', 'confirmado', 'atendido', 'ausente', 'cancelado'], {
    errorMap: () => ({ message: 'Estado de turno no válido' }),
  }),
});

// POST /admin/turnos/:id/urgencia (admin, RF25, BE-11)
const urgenciaSchema = z
  .object({
    accion: z.enum(['cancelar', 'reprogramar'], {
      errorMap: () => ({ message: 'La acción debe ser "cancelar" o "reprogramar"' }),
    }),
    motivo: z
      .string({ required_error: 'El motivo es obligatorio' })
      .trim()
      .min(1, 'El motivo es obligatorio'),
    fecha: z
      .string()
      .refine(esFechaValida, 'La fecha debe ser válida (YYYY-MM-DD)')
      .optional(),
    hora: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe tener formato HH:MM')
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.accion === 'reprogramar') {
      if (!data.fecha) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fecha'],
          message: 'Falta la fecha para reprogramar por urgencia',
        });
      }
      if (!data.hora) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['hora'],
          message: 'Falta la hora para reprogramar por urgencia',
        });
      }
    }
  });

module.exports = {
  disponibilidadQuerySchema,
  crearTurnoSchema,
  reprogramarTurnoSchema,
  agendaAdminQuerySchema,
  crearTurnoAdminSchema,
  cambiarEstadoSchema,
  urgenciaSchema,
};
