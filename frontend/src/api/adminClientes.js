import api from './cliente.js';

// Endpoints de clientes del administrador (sección 6 del plan, BE-12/BE-13):
//   GET  /admin/clientes?q=              → buscar por nombre, documento o email
//   POST /admin/clientes                 → alta asistida (RF01b, RF24)
//   GET  /admin/clientes/:id             → ficha del cliente
//   POST /admin/clientes/:id/desbloquear → desbloquear y contraseña temporal (BE-13)
//   POST /admin/clientes/:id/anonimizar  → supresión de datos (BE-15, RNF04)
//   GET  /admin/clientes/:id/mascotas    → mascotas activas del cliente
//
// El resto del módulo (PUT editar, POST baja, POST mascotas) no lo consume
// ninguna pantalla de FE-08. El backend real usa snake_case en las
// respuestas: la conversión vive solo en esta capa, como en api/mascotas.js
// y api/adminTurnos.js.

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
    intentosFallidos: cliente.intentos_fallidos,
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

// Ficha del cliente (GET /admin/clientes/:id): mismos campos que la búsqueda.
// 404 NO_ENCONTRADO ('El cliente no existe') si el id no existe.
export function obtener(id) {
  return api.get(`/admin/clientes/${id}`).then((respuesta) => ({
    ...respuesta,
    data: aCamelCliente(respuesta.data),
  }));
}

// Alta asistida (POST /admin/clientes, 201, RF01b/RF24). Obligatorios:
// documento, nombre, apellido y teléfono; email opcional (si viene vacío no
// se envía). 409 DOCUMENTO_EXISTENTE o EMAIL_DUPLICADO: el backend responde
// { codigo, mensaje, id } con el id de la ficha existente y el nombre del
// cliente en el mensaje. El alta crea la cuenta como 'sin_cuenta'.
export function crear(datos) {
  const cuerpo = {
    documento: datos.documento,
    nombre: datos.nombre,
    apellido: datos.apellido,
    telefono: datos.telefono,
  };
  if (datos.email) cuerpo.email = datos.email;
  return api.post('/admin/clientes', cuerpo).then((respuesta) => ({
    ...respuesta,
    data: aCamelCliente(respuesta.data),
  }));
}

// Desbloqueo (POST /admin/clientes/:id/desbloquear, BE-13): cuerpo
// { password? } con la regla de contraseña del backend (>= 6 caracteres y
// >= 2 números); sin password solo se desbloquea. Responde { mensaje,
// cliente } (un cliente 'sin_cuenta' con contraseña pasa a 'con_cuenta').
export function desbloquear(id, password) {
  const cuerpo = {};
  if (password) cuerpo.password = password;
  return api.post(`/admin/clientes/${id}/desbloquear`, cuerpo).then((respuesta) => ({
    ...respuesta,
    data: {
      mensaje: respuesta.data.mensaje,
      cliente: aCamelCliente(respuesta.data.cliente),
    },
  }));
}

// Anonimización por supresión (POST /admin/clientes/:id/anonimizar, BE-15,
// RNF04 de la Ley 25.326). Sin cuerpo: reemplaza los datos personales del
// cliente, deja sus mascotas inactivas, cancela sus turnos futuros y pone la
// cuenta 'inactiva'. No se puede deshacer. Responde { mensaje, id }.
export function anonimizar(id) {
  return api.post(`/admin/clientes/${id}/anonimizar`).then((respuesta) => ({
    ...respuesta,
    data: {
      mensaje: respuesta.data.mensaje,
      id: respuesta.data.id,
    },
  }));
}
