import api from './cliente.js';

// Endpoints de turnos del cliente (sección 6 del plan):
//   GET   /turnos/disponibilidad?fecha=  → franjas libres del día (C/A)
//   POST  /turnos                        → reserva del cliente (C), RF09
//   GET   /turnos/mios                   → mis turnos con estado (C), RF10
//   PATCH /turnos/:id/cancelar           → cancelar (C), RF11
//   PATCH /turnos/:id/reprogramar        → reprogramar (C), RF11
//
// El backend real (BE-08 a BE-11) usa snake_case: el cuerpo de POST espera
// { mascota_id, servicio_id, fecha, hora } (enteros, 'YYYY-MM-DD', 'HH:MM'),
// el de reprogramación { fecha, hora }, y las respuestas traen el turno con
// fecha_hora ('YYYY-MM-DD HH:MM:SS') y los nombres de mascota y servicio.
// La conversión vive solo en esta capa, como en api/mascotas.js.

// snake_case (API) → camelCase (pantallas). Campos que usa FE-04; FE-05
// (mis turnos) podrá agregar los que necesite (cliente, canal, urgencia…).
function aCamel(turno) {
  return {
    id: turno.id,
    mascotaId: turno.mascota_id,
    servicioId: turno.servicio_id,
    fechaHora: turno.fecha_hora,
    estado: turno.estado,
    canal: turno.canal,
    esUrgencia: turno.es_urgencia,
    motivo: turno.motivo,
    mascotaNombre: turno.mascota_nombre,
    servicioNombre: turno.servicio_nombre,
  };
}

// Franjas libres del día: arreglo de strings 'HH:MM' (vacío si el día no
// labora: fin de semana, feriado o fecha pasada).
export function disponibilidad(fecha) {
  return api.get('/turnos/disponibilidad', { params: { fecha } });
}

// Reserva (POST /turnos, 201 con el turno creado, estado 'pendiente').
export function reservar({ mascotaId, servicioId, fecha, hora }) {
  return api
    .post('/turnos', {
      mascota_id: mascotaId,
      servicio_id: servicioId,
      fecha,
      hora,
    })
    .then((respuesta) => ({ ...respuesta, data: aCamel(respuesta.data) }));
}

// Mis turnos (GET /turnos/mios): los turnos propios con mascota y servicio,
// ordenados por fecha descendente (el backend ya viene ordenado).
export function misTurnos() {
  return api.get('/turnos/mios').then((respuesta) => ({
    ...respuesta,
    data: respuesta.data.map(aCamel),
  }));
}

// Cancelación (PATCH /turnos/:id/cancelar): responde el turno cancelado.
// Errores: 404 si no existe o no es propio, 422 TRANSICION_INVALIDA si el
// estado no lo permite, 422 ANTELACION_INSUFICIENTE sin la antelación mínima.
export function cancelar(id) {
  return api
    .patch(`/turnos/${id}/cancelar`)
    .then((respuesta) => ({ ...respuesta, data: aCamel(respuesta.data) }));
}

// Reprogramación (PATCH /turnos/:id/reprogramar): mueve el turno a la nueva
// franja y lo devuelve a 'pendiente'. Además de los errores de cancelación,
// puede devolver 422 FRANJA_INVALIDA y 409 FRANJA_OCUPADA.
export function reprogramar(id, { fecha, hora }) {
  return api
    .patch(`/turnos/${id}/reprogramar`, { fecha, hora })
    .then((respuesta) => ({ ...respuesta, data: aCamel(respuesta.data) }));
}
