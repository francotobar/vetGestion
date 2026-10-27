const { z } = require('zod');

// Regla de contraseña (sección 1 del plan): ≥ 6 caracteres y ≥ 2 números.
const passwordSchema = z
  .string({ required_error: 'Falta la contraseña' })
  .regex(/^(?=(?:.*\d){2,}).{6,}$/, 'La contraseña debe tener al menos 6 caracteres y 2 números');

const textoRequerido = (max, nombre) =>
  z
    .string({ required_error: `Falta ${nombre}`, invalid_type_error: `${nombre} debe ser texto` })
    .trim()
    .min(1, `${nombre} no puede estar vacío`)
    .max(max, `${nombre} como máximo ${max} caracteres`);

const registroSchema = z.object({
  documento: textoRequerido(20, 'El documento'),
  nombre: textoRequerido(60, 'El nombre'),
  apellido: textoRequerido(60, 'El apellido'),
  telefono: textoRequerido(30, 'El teléfono'),
  // Email opcional: string vacío o ausente cuenta como sin email.
  email: z.preprocess(
    (valor) => (valor === '' || valor === undefined ? undefined : valor),
    z.string().trim().email('Email inválido').max(120, 'Email como máximo 120 caracteres').optional()
  ),
  password: passwordSchema,
  consentimiento: z
    .boolean({ required_error: 'Debe aceptar el consentimiento de datos personales' })
    .refine((valor) => valor === true, {
      message: 'Debe aceptar el consentimiento de datos personales',
    }),
});

const loginSchema = z.object({
  documento: z.string({ required_error: 'Falta el documento' }).trim().min(1, 'Falta el documento'),
  password: z.string({ required_error: 'Falta la contraseña' }).min(1, 'Falta la contraseña'),
});

module.exports = { registroSchema, loginSchema };
