import api from './cliente.js';

// Endpoints de mascotas propias (tabla de la sección 6 del plan, rol C):
//   GET    /mascotas       → lista las mascotas propias activas
//   POST   /mascotas       → alta (RF06)
//   PUT    /mascotas/:id   → edición
//   DELETE /mascotas/:id   → baja lógica (nunca borra en físico)
// Los cuerpos van en camelCase (fechaNacimiento, pesoKg, alergiasCondiciones);
// contrato anotado en docs/DECISIONES.md (BE-05 todavía no existe).
export function listar() {
  return api.get('/mascotas');
}

export function crear(datos) {
  return api.post('/mascotas', datos);
}

export function actualizar(id, datos) {
  return api.put(`/mascotas/${id}`, datos);
}

export function darDeBaja(id) {
  return api.delete(`/mascotas/${id}`);
}
