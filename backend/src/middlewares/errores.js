// Manejador de errores central. Formato de la API (regla 7 del plan):
// { "codigo": "FRANJA_OCUPADA", "mensaje": "La franja ya fue reservada" }

function noEncontrado(req, res, next) {
  res.status(404).json({
    codigo: 'RUTA_NO_ENCONTRADA',
    mensaje: 'La ruta solicitada no existe',
  });
}

function manejarErrores(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    codigo: err.codigo || 'ERROR_INTERNO',
    mensaje: status === 500 ? 'Error interno del servidor' : err.mensaje,
  });
}

module.exports = { noEncontrado, manejarErrores };
