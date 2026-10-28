import api from './cliente.js';

// Endpoints de mascotas propias (tabla de la sección 6 del plan, rol C):
//   GET    /mascotas       → lista las mascotas propias activas
//   POST   /mascotas       → alta (RF06); responde 201 con la mascota creada
//   PUT    /mascotas/:id   → edición; responde la mascota actualizada
//   DELETE /mascotas/:id   → baja lógica (nunca borra en físico)
//
// El backend real (BE-05) usa snake_case en las respuestas y en los cuerpos
// (fecha_nacimiento, peso_kg, alergias_condiciones). Para que el resto de los
// componentes trabaje en camelCase sin cambios, esta capa hace la conversión:
// las respuestas pasan por aCamel() y los cuerpos por aSnake().

// snake_case (API) → camelCase (componentes). peso_kg puede venir null.
function aCamel(mascota) {
  return {
    id: mascota.id,
    usuarioId: mascota.usuario_id,
    nombre: mascota.nombre,
    especie: mascota.especie,
    raza: mascota.raza,
    sexo: mascota.sexo,
    fechaNacimiento: mascota.fecha_nacimiento,
    pesoKg: mascota.peso_kg,
    esterilizado: mascota.esterilizado,
    microchip: mascota.microchip,
    alergiasCondiciones: mascota.alergias_condiciones,
  };
}

// camelCase (componentes) → snake_case (API). Los opcionales que llegan como
// undefined no se serializan y el backend los toma como ausentes (schema.js).
function aSnake(mascota) {
  return {
    nombre: mascota.nombre,
    especie: mascota.especie,
    raza: mascota.raza,
    sexo: mascota.sexo,
    fecha_nacimiento: mascota.fechaNacimiento,
    peso_kg: mascota.pesoKg,
    esterilizado: Boolean(mascota.esterilizado),
    microchip: mascota.microchip,
    alergias_condiciones: mascota.alergiasCondiciones,
  };
}

// Cada función devuelve la respuesta de axios con `data` convertido, para que
// las pantallas sigan haciendo .then(({ data }) => …) como hasta ahora.
export function listar() {
  return api.get('/mascotas').then((respuesta) => ({
    ...respuesta,
    data: respuesta.data.map(aCamel),
  }));
}

export function crear(datos) {
  return api.post('/mascotas', aSnake(datos)).then((respuesta) => ({
    ...respuesta,
    data: aCamel(respuesta.data),
  }));
}

export function actualizar(id, datos) {
  return api.put(`/mascotas/${id}`, aSnake(datos)).then((respuesta) => ({
    ...respuesta,
    data: aCamel(respuesta.data),
  }));
}

export function darDeBaja(id) {
  return api.delete(`/mascotas/${id}`);
}
