const { z } = require('zod');

// Catálogo de servicios (RF19): nombre único, descripción opcional y
// activar/desactivar como baja lógica.
const servicioSchema = z.object({
  nombre: z
    .string({ required_error: 'Falta el nombre', invalid_type_error: 'El nombre debe ser texto' })
    .trim()
    .min(1, 'El nombre no puede estar vacío')
    .max(80, 'El nombre como máximo 80 caracteres'),
  descripcion: z.string().trim().max(255, 'La descripción como máximo 255 caracteres').nullish(),
  activo: z.boolean().optional().default(true),
});

module.exports = { servicioSchema };
