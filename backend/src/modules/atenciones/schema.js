const { z } = require('zod');

// POST /admin/turnos/:id/atencion (RF26, BE-14). Zod valida solo el formato;
// las reglas de negocio (turno 'atendido', sin atención previa) viven en el service.
const cargarAtencionSchema = z.object({
  profesional_nombre: z
    .string({ required_error: 'El nombre del profesional es obligatorio' })
    .trim()
    .min(1, 'El nombre del profesional es obligatorio')
    .max(100, 'El nombre del profesional es demasiado largo'),
  anamnesis: z.string().optional(),
  diagnostico: z.string().optional(),
  tratamiento: z.string().optional(),
  medicacion: z.string().optional(),
  vacunas: z.string().optional(),
  observaciones: z.string().optional(),
});

// POST /admin/atenciones/:id/notas (RF27, BE-14).
const notaSchema = z.object({
  texto: z
    .string({ required_error: 'El texto de la nota es obligatorio' })
    .trim()
    .min(1, 'El texto de la nota es obligatorio'),
});

module.exports = { cargarAtencionSchema, notaSchema };
