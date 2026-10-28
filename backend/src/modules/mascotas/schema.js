const { z } = require('zod');

// Reglas de la ficha (RF06) y validación de BE-05: especie perro|gato, sexo,
// fecha de nacimiento no futura y peso > 0.
const especieSchema = z.enum(['perro', 'gato'], {
  errorMap: () => ({ message: 'La especie debe ser "perro" o "gato"' }),
});

const sexoSchema = z.enum(['macho', 'hembra'], {
  errorMap: () => ({ message: 'El sexo debe ser "macho" o "hembra"' }),
});

function fechaValida(fecha) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) return false;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const obj = new Date(anio, mes - 1, dia);
  return obj.getFullYear() === anio && obj.getMonth() === mes - 1 && obj.getDate() === dia;
}

const fechaNacimientoSchema = z
  .string({ required_error: 'Falta la fecha de nacimiento' })
  .refine(fechaValida, 'La fecha de nacimiento debe ser una fecha válida (YYYY-MM-DD)')
  .refine((fecha) => {
    const [anio, mes, dia] = fecha.split('-').map(Number);
    return new Date(anio, mes - 1, dia) <= new Date();
  }, 'La fecha de nacimiento no puede ser futura');

const textoRequerido = (max, nombre) =>
  z
    .string({ required_error: `Falta ${nombre}`, invalid_type_error: `${nombre} debe ser texto` })
    .trim()
    .min(1, `${nombre} no puede estar vacío`)
    .max(max, `${nombre} como máximo ${max} caracteres`);

const opcional = (max, nombre) =>
  z
    .string()
    .trim()
    .max(max, `${nombre} como máximo ${max} caracteres`)
    .nullish();

// Alta y edición: los campos del centro de la ficha son obligatorios;
// peso, esterilización, microchip y alergias son opcionales.
const mascotaSchema = z.object({
  nombre: textoRequerido(60, 'El nombre'),
  especie: especieSchema,
  raza: textoRequerido(60, 'La raza'),
  sexo: sexoSchema,
  fecha_nacimiento: fechaNacimientoSchema,
  peso_kg: z.preprocess(
    (valor) => (valor === '' || valor === null ? undefined : valor),
    z
      .number({ invalid_type_error: 'El peso debe ser un número' })
      .positive('El peso debe ser mayor a 0')
      .max(999.99, 'El peso máximo es 999,99 kg')
      .optional()
  ),
  esterilizado: z.boolean().optional().default(false),
  microchip: opcional(30, 'El microchip'),
  alergias_condiciones: opcional(5000, 'Las alergias o condiciones'),
});

module.exports = { mascotaSchema };
