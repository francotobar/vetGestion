// Error de API con el formato de la regla 7 del plan:
// { "codigo": "FRANJA_OCUPADA", "mensaje": "La franja ya fue reservada" }
// Status: 400 validación, 401 sin sesión, 403 sin permiso, 404 no existe,
// 409 conflicto, 422 regla de negocio, 423 cuenta bloqueada.
class ApiError extends Error {
  constructor(status, codigo, mensaje) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.mensaje = mensaje;
  }
}

module.exports = { ApiError };
