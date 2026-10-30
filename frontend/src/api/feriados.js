import api from './cliente.js';

// Feriados (GET /feriados, público para cliente y admin, sección 6):
// [{ fecha: 'YYYY-MM-DD', motivo }]. Los usa el selector de fecha para
// deshabilitar días sin atención (FE-04).
export function listar() {
  return api.get('/feriados');
}
