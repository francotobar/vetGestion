import api from './cliente.js';

// Endpoints de atenciones e historial clínico (sección 6 del plan, BE-14):
//   GET  /mascotas/:id/historial       → historial de la mascota propia (C)
//   GET  /admin/mascotas/:id/historial → historial completo (A)
//   POST /admin/turnos/:id/atencion    → cargar atención (A), RF26
//   POST /admin/atenciones/:id/notas   → nota aclaratoria (A), RF27
//
// No existen PUT/DELETE de atenciones: son inmutables (los triggers de la BD
// impiden UPDATE y DELETE, RF26), por eso la UI no ofrece editar ni borrar.
// El backend usa snake_case en las respuestas y en los cuerpos
// (profesional_nombre, anamnesis…). La conversión vive solo en esta capa,
// como en api/mascotas.js y api/adminTurnos.js.

// snake_case (API) → camelCase (pantalla) de una nota aclaratoria.
function aCamelNota(nota) {
  return {
    id: nota.id,
    texto: nota.texto,
    creadoPor: nota.creado_por,
    creadoEn: nota.creado_en,
  };
}

// snake_case (API) → camelCase (pantalla) de una atención. Los textos
// opcionales (anamnesis…observaciones) pueden venir null. mascota_id solo
// viene en la respuesta del POST (obtenerAtencion); el historial no lo trae.
function aCamelAtencion(atencion) {
  return {
    id: atencion.id,
    turnoId: atencion.turno_id,
    mascotaId: atencion.mascota_id,
    fechaHora: atencion.fecha_hora,
    servicioNombre: atencion.servicio_nombre,
    profesionalNombre: atencion.profesional_nombre,
    anamnesis: atencion.anamnesis,
    diagnostico: atencion.diagnostico,
    tratamiento: atencion.tratamiento,
    medicacion: atencion.medicacion,
    vacunas: atencion.vacunas,
    observaciones: atencion.observaciones,
    creadoPor: atencion.creado_por,
    creadoEn: atencion.creado_en,
    notas: (atencion.notas || []).map(aCamelNota),
  };
}

// Historial de la mascota propia (GET /mascotas/:id/historial, RF26): el
// backend devuelve las atenciones en orden cronológico inverso, con las notas
// de cada una en orden ascendente. 404 si la mascota no existe o es ajena.
export function historialCliente(id) {
  return api.get(`/mascotas/${id}/historial`).then((respuesta) => ({
    ...respuesta,
    data: respuesta.data.map(aCamelAtencion),
  }));
}

// Historial completo (GET /admin/mascotas/:id/historial): mismos campos que
// el del cliente, sin el filtro por dueño. La agenda lo usa para saber qué
// turnos atendidos ya tienen atención cargada.
export function historialAdmin(id) {
  return api.get(`/admin/mascotas/${id}/historial`).then((respuesta) => ({
    ...respuesta,
    data: respuesta.data.map(aCamelAtencion),
  }));
}

// Cargar atención (POST /admin/turnos/:id/atencion, 201, RF26): solo para
// turnos en estado 'atendido' y sin atención previa. Errores: 404 (turno
// inexistente), 422 TURNO_NO_ATENDIDO, 409 ATENCION_YA_EXISTE. El backend
// responde la atención creada con sus notas vacías.
export function cargarAtencion(turnoId, datos) {
  const cuerpo = { profesional_nombre: datos.profesionalNombre };
  // Los opcionales vacíos no se envían: el backend los guarda como null.
  if (datos.anamnesis) cuerpo.anamnesis = datos.anamnesis;
  if (datos.diagnostico) cuerpo.diagnostico = datos.diagnostico;
  if (datos.tratamiento) cuerpo.tratamiento = datos.tratamiento;
  if (datos.medicacion) cuerpo.medicacion = datos.medicacion;
  if (datos.vacunas) cuerpo.vacunas = datos.vacunas;
  if (datos.observaciones) cuerpo.observaciones = datos.observaciones;
  return api.post(`/admin/turnos/${turnoId}/atencion`, cuerpo).then((respuesta) => ({
    ...respuesta,
    data: aCamelAtencion(respuesta.data),
  }));
}

// Nota aclaratoria (POST /admin/atenciones/:id/notas, 201, RF27): agrega la
// nota debajo de la atención sin modificarla. 404 si la atención no existe.
export function agregarNota(atencionId, texto) {
  return api.post(`/admin/atenciones/${atencionId}/notas`, { texto }).then((respuesta) => ({
    ...respuesta,
    data: aCamelNota(respuesta.data),
  }));
}
