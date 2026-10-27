import api from './cliente.js';

// Endpoints de autenticación (tabla de la sección 6 del plan):
//   POST /auth/registro  (pública) → alta de cliente; 409 si el documento
//                                    ya tiene cuenta o el email está en uso
//   POST /auth/login     (pública) → crea la cookie JWT; 401 credenciales
//                                    inválidas, 423 si la cuenta está bloqueada
//   POST /auth/logout    (C/A)     → borra la cookie
//   GET  /auth/me        (C/A)     → usuario de la sesión vigente
export function registrar(datos) {
  return api.post('/auth/registro', datos);
}

export function iniciarSesion(datos) {
  return api.post('/auth/login', datos);
}

export function cerrarSesion() {
  return api.post('/auth/logout');
}

export function usuarioActual() {
  return api.get('/auth/me');
}
