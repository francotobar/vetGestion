import api from './cliente.js';

// Endpoints de turnos del cliente (sección 6 del plan):
//   GET  /turnos/disponibilidad?fecha=  → franjas libres del día (C/A)
//   POST /turnos                        → reserva del cliente (C), RF09
//
// El backend real (BE-08) usa snake_case: el cuerpo de POST espera
// { mascota_id, servicio_id, fecha, hora } (enteros, 'YYYY-MM-DD', 'HH:MM')
// y la respuesta trae el turno con fecha_hora ('YYYY-MM-DD HH:MM:SS') y los
// nombres de mascota y servicio. La conversión vive solo en esta capa, como
// en api/mascotas.js.

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
