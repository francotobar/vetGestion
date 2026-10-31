import api from './cliente.js';

// Endpoints de autenticación (tabla de la sección 6 del plan):
//   POST /auth/registro  (pública) → alta de cliente; 409 si el documento
//                                    ya tiene cuenta o el email está en uso
//   POST /auth/login     (pública) → crea la cookie JWT; 401 credenciales
//                                    inválidas, 423 si la cuenta está bloqueada
//   POST /auth/logout    (C/A)     → borra la cookie
//   GET  /auth/me        (C/A)     → usuario de la sesión vigente
//   POST /auth/recuperar (pública) → pide el enlace de recuperación por
//                                    email; responde siempre la misma
//                                    estructura { mensaje, token, expira }
//                                    exista o no el email (BE-16)
//   POST /auth/restablecer (pública) → { token, password } → { mensaje,
//                                    cliente }; 400 TOKEN_INVALIDO o
//                                    TOKEN_VENCIDO si el enlace ya no sirve
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

export function recuperar(email) {
  return api.post('/auth/recuperar', { email });
}

export function restablecer(token, password) {
  return api.post('/auth/restablecer', { token, password });
}
