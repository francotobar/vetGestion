import api from './cliente.js';

// Endpoints de la agenda del administrador (sección 6 del plan, BE-10/BE-11):
//   GET   /admin/turnos?desde=&hasta=&estado=  → agenda con joins (A)
//   PATCH /admin/turnos/:id/estado             → cambiar estado (A)
//   PATCH /admin/turnos/:id/reprogramar        → reprogramar sin antelación (A)
//   POST  /admin/turnos/:id/urgencia           → cancelar/reprogramar por urgencia (A)
//
// El backend usa snake_case: las respuestas traen fecha_hora
// ('YYYY-MM-DD HH:MM:SS'), cliente_*, mascota_* y servicio_*; el cuerpo de
// estado es { estado } y el de reprogramación { fecha, hora }. La conversión
// vive solo en esta capa, como en api/mascotas.js.

// snake_case (API) → camelCase (pantalla). Las columnas de join (cliente_*,
// mascota_especie…) solo vienen en la agenda; en las respuestas de PATCH el
// backend no devuelve mascota_especie y queda undefined sin romper nada.
function aCamel(turno) {
  return {
    id: turno.id,
    usuarioId: turno.usuario_id,
    mascotaId: turno.mascota_id,
    servicioId: turno.servicio_id,
    fechaHora: turno.fecha_hora,
    estado: turno.estado,
    canal: turno.canal,
    esUrgencia: turno.es_urgencia,
    motivo: turno.motivo,
    clienteNombre: turno.cliente_nombre,
    clienteApellido: turno.cliente_apellido,
    clienteDocumento: turno.cliente_documento,
    clienteTelefono: turno.cliente_telefono,
    mascotaNombre: turno.mascota_nombre,
    mascotaEspecie: turno.mascota_especie,
    servicioNombre: turno.servicio_nombre,
  };
}

// Agenda (GET /admin/turnos): desde/hasta son 'YYYY-MM-DD' (el backend los
// amplía a 00:00:00 / 23:59:59); estado es opcional.
export function agenda({ desde, hasta, estado } = {}) {
  const params = {};
  if (desde) params.desde = desde;
  if (hasta) params.hasta = hasta;
  if (estado) params.estado = estado;
  return api.get('/admin/turnos', { params }).then((respuesta) => ({
    ...respuesta,
    data: respuesta.data.map(aCamel),
  }));
}

// Cambio de estado (PATCH /admin/turnos/:id/estado, body { estado }).
// Si la transición no está en el mapa de la sección 5 → 422 TRANSICION_INVALIDA.
export function cambiarEstado(id, estado) {
  return api
    .patch(`/admin/turnos/${id}/estado`, { estado })
    .then((respuesta) => ({ ...respuesta, data: aCamel(respuesta.data) }));
}

// Reprogramación admin (PATCH /admin/turnos/:id/reprogramar): conserva el
// estado del turno y no exige antelación; 409 si la franja está ocupada.
export function reprogramar(id, { fecha, hora }) {
  return api
    .patch(`/admin/turnos/${id}/reprogramar`, { fecha, hora })
    .then((respuesta) => ({ ...respuesta, data: aCamel(respuesta.data) }));
}

// Urgencia (POST /admin/turnos/:id/urgencia): { accion, motivo, fecha?, hora? }.
// Responde { turno, cliente: { nombre, apellido, telefono, email } } para que
// el admin avise al cliente manualmente (RF25).
export function urgencia(id, { accion, motivo, fecha, hora }) {
  const cuerpo = { accion, motivo };
  if (fecha) cuerpo.fecha = fecha;
  if (hora) cuerpo.hora = hora;
  return api.post(`/admin/turnos/${id}/urgencia`, cuerpo).then((respuesta) => ({
    ...respuesta,
    data: {
      turno: aCamel(respuesta.data.turno),
      cliente: respuesta.data.cliente,
    },
  }));
}
