import api from './cliente.js';

// Feriados (GET /feriados, público para cliente y admin, sección 6):
// [{ fecha: 'YYYY-MM-DD', motivo }]. Los usa el selector de fecha para
// deshabilitar días sin atención (FE-04).
export function listar() {
  return api.get('/feriados');
}

// POST /admin/feriados: alta de feriado (fecha: YYYY-MM-DD, motivo: string).
export function crear(datos) {
  return api.post('/admin/feriados', datos);
}

// DELETE /admin/feriados/:fecha: baja de feriado por fecha (YYYY-MM-DD).
export function eliminar(fecha) {
  return api.delete(`/admin/feriados/${fecha}`);
}
