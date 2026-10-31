import api from './cliente.js';

// Catálogo de servicios (RF19).
// GET /servicios: solo los activos (público / cliente / admin).
export function listar() {
  return api.get('/servicios');
}

// GET /admin/servicios: catálogo completo con activos e inactivos (solo admin).
export function listarAdmin() {
  return api.get('/admin/servicios');
}

// POST /admin/servicios: alta de servicio (nombre, descripcion, activo).
export function crear(datos) {
  return api.post('/admin/servicios', datos);
}

// PUT /admin/servicios/:id: edición y activar/desactivar (nombre, descripcion, activo).
export function actualizar(id, datos) {
  return api.put(`/admin/servicios/${id}`, datos);
}
