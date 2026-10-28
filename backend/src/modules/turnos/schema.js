const { z } = require('zod');
const { esFechaValida } = require('../../utils/fechas');

// GET /turnos/disponibilidad?fecha=YYYY-MM-DD
const disponibilidadQuerySchema = z.object({
  fecha: z
    .string({ required_error: 'Falta la fecha' })
    .refine(esFechaValida, 'La fecha debe ser válida (YYYY-MM-DD)'),
});

module.exports = { disponibilidadQuerySchema };
