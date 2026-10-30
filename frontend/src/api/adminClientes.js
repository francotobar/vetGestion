import api from './cliente.js';

// Endpoints de clientes del administrador (sección 6 del plan, BE-12):
//   GET /admin/clientes?q=            → buscar por nombre, documento o email
//   GET /admin/clientes/:id/mascotas  → mascotas activas del cliente
//
// Para FE-07 (turno manual) solo se usan esos dos; el resto del módulo
// (alta, edición, baja, desbloqueo) lo consume FE-08. El backend real usa
// snake_case en las respuestas: la conversión vive solo en esta capa, como
// en api/mascotas.js y api/adminTurnos.js.

// snake_case (API) → camelCase (pantalla). estado_cuenta es
// 'con_cuenta' | 'sin_cuenta' | 'inactiva' y bloqueado ya viene como booleano.
function aCamelCliente(cliente) {
  return {
    id: cliente.id,
    documento: cliente.documento,
    nombre: cliente.nombre,
    apellido: cliente.apellido,
    telefono: cliente.telefono,
    email: cliente.email,
    estadoCuenta: cliente.estado_cuenta,
    bloqueado: cliente.bloqueado,
  };
}

// Mismos campos que api/mascotas.js (mapearMascota del backend).
function aCamelMascota(mascota) {
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

// Buscar clientes (GET /admin/clientes?q=). El backend busca por nombre
// completo, documento o email; sin término (o en blanco) devuelve todos los
// clientes ordenados por apellido y nombre.
export function buscar(q) {
  const params = {};
  if (q) params.q = q;
  return api.get('/admin/clientes', { params }).then((respuesta) => ({
    ...respuesta,
    data: respuesta.data.map(aCamelCliente),
  }));
}

// Mascotas activas del cliente (GET /admin/clientes/:id/mascotas), ordenadas
// por nombre. 404 NO_ENCONTRADO si el id no es un cliente existente.
export function mascotasDelCliente(id) {
  return api.get(`/admin/clientes/${id}/mascotas`).then((respuesta) => ({
    ...respuesta,
    data: respuesta.data.map(aCamelMascota),
  }));
}
