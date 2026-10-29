import api from './cliente.js';

// Catálogo de servicios (RF19). El endpoint público del cliente
// (GET /servicios, sección 6) devuelve solo los activos, en snake_case
// mínimo: { id, nombre, descripcion, activo } — no hace falta convertir.
export function listar() {
  return api.get('/servicios');
}
