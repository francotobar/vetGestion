const { z } = require('zod');
const { esFechaValida } = require('../../utils/fechas');

// Feriados (RF23): una fecha única (clave primaria) con su motivo.
const feriadoSchema = z.object({
  fecha: z
    .string({ required_error: 'Falta la fecha' })
    .refine(esFechaValida, 'La fecha debe ser válida (YYYY-MM-DD)'),
  motivo: z
    .string({ required_error: 'Falta el motivo', invalid_type_error: 'El motivo debe ser texto' })
    .trim()
    .min(1, 'El motivo no puede estar vacío')
    .max(120, 'El motivo como máximo 120 caracteres'),
});

module.exports = { feriadoSchema };
