const { z } = require('zod');

const textoRequerido = (max, nombre) =>
  z
    .string({ required_error: `Falta ${nombre}`, invalid_type_error: `${nombre} debe ser texto` })
    .trim()
    .min(1, `${nombre} no puede estar vacío`)
    .max(max, `${nombre} como máximo ${max} caracteres`);

// Alta asistida por el administrador (RF01b, RF24, BE-12).
// Obligatorios: nombre, apellido, documento, teléfono; email opcional.
const altaClienteSchema = z.object({
  documento: textoRequerido(20, 'El documento'),
  nombre: textoRequerido(60, 'El nombre'),
  apellido: textoRequerido(60, 'El apellido'),
  telefono: textoRequerido(30, 'El teléfono'),
  email: z.preprocess(
    (valor) => (valor === '' || valor === undefined || valor === null ? undefined : valor),
    z.string().trim().email('Email inválido').max(120, 'Email como máximo 120 caracteres').optional()
  ),
});

// Edición de cliente por admin (RF20, BE-12).
// Modificación de datos de perfil (nombre, apellido, teléfono, email).
const editarClienteSchema = z.object({
  nombre: textoRequerido(60, 'El nombre'),
  apellido: textoRequerido(60, 'El apellido'),
  telefono: textoRequerido(30, 'El teléfono'),
  email: z.preprocess(
    (valor) => (valor === '' || valor === undefined || valor === null ? undefined : valor),
    z.string().trim().email('Email inválido').max(120, 'Email como máximo 120 caracteres').optional()
  ),
});

module.exports = {
  altaClienteSchema,
  editarClienteSchema,
};
