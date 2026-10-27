const jwt = require('jsonwebtoken');
const { env } = require('../../config/env');
const { pool } = require('../../config/db');
const { ApiError } = require('../../utils/errores');
const { hashPassword, compararPassword } = require('../../utils/password');

// Sesión: JWT de 8 h en cookie httpOnly SameSite=Lax (sección 2 del plan).
// Decisión: el nombre de la cookie es "token" (el plan no lo fija).
const COOKIE_SESION = 'token';
const DURACION_SESION_MS = 8 * 60 * 60 * 1000;

function opcionesCookie() {
  return { httpOnly: true, sameSite: 'lax', secure: false, maxAge: DURACION_SESION_MS };
}

// Datos del usuario que expone la API (nunca password_hash ni intentos).
function mapearUsuario(fila) {
  return {
    id: fila.id,
    rol: fila.rol,
    documento: fila.documento,
    nombre: fila.nombre,
    apellido: fila.apellido,
    telefono: fila.telefono,
    email: fila.email,
  };
}

// POST /auth/registro (RF01a). Si el documento existe como "sin_cuenta" y el
// teléfono coincide, vincula la ficha existente sin crear un duplicado.
async function registro(datos) {
  const { documento, nombre, apellido, telefono, password } = datos;
  const email = datos.email || null;

  const [[ficha]] = await pool.execute(
    'SELECT id, telefono, estado_cuenta FROM usuarios WHERE documento = ?',
    [documento]
  );

  if (ficha && ficha.estado_cuenta !== 'sin_cuenta') {
    throw new ApiError(409, 'DOCUMENTO_EXISTENTE', 'El documento ya tiene una cuenta asociada');
  }
  if (ficha && ficha.telefono !== telefono) {
    throw new ApiError(
      409,
      'FICHA_NO_COINCIDE',
      'Los datos no coinciden con una ficha existente. Contactá a la veterinaria'
    );
  }
  if (email) {
    const [[dup]] = await pool.execute('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (dup && dup.id !== ficha?.id) {
      throw new ApiError(409, 'EMAIL_DUPLICADO', 'El email ya está registrado');
    }
  }

  const hash = await hashPassword(password);

  try {
    if (ficha) {
      // Reclamo de ficha: setea contraseña, email (si viene) y pasa a "con_cuenta".
      await pool.execute(
        `UPDATE usuarios
            SET password_hash = ?, email = COALESCE(?, email), consentimiento_at = NOW(), estado_cuenta = 'con_cuenta'
          WHERE id = ?`,
        [hash, email, ficha.id]
      );
    } else {
      await pool.execute(
        `INSERT INTO usuarios
           (rol, documento, nombre, apellido, telefono, email, password_hash, estado_cuenta, consentimiento_at)
         VALUES ('cliente', ?, ?, ?, ?, ?, ?, 'con_cuenta', NOW())`,
        [documento, nombre, apellido, telefono, email, hash]
      );
    }
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'EMAIL_DUPLICADO', 'El email ya está registrado');
    }
    throw err;
  }
}

// POST /auth/login. Bloqueo tras 5 intentos fallidos (RF03). Éxito → cookie JWT.
async function login({ documento, password }, res) {
  const [[usuario]] = await pool.execute(
    `SELECT id, rol, documento, nombre, apellido, telefono, email,
            password_hash, estado_cuenta, intentos_fallidos, bloqueado
       FROM usuarios WHERE documento = ?`,
    [documento]
  );

  if (!usuario || usuario.estado_cuenta !== 'con_cuenta') {
    throw new ApiError(401, 'CREDENCIALES_INVALIDAS', 'Documento o contraseña incorrectos');
  }
  if (usuario.bloqueado) {
    throw new ApiError(
      423,
      'CUENTA_BLOQUEADA',
      usuario.email
        ? 'Su cuenta está bloqueada. Ingrese su email en "Recuperar contraseña" para desbloquearla.'
        : 'Su cuenta está bloqueada. Contactá a la veterinaria para que el administrador la desbloquee.'
    );
  }

  const coincide = usuario.password_hash && (await compararPassword(password, usuario.password_hash));
  if (!coincide) {
    const intentos = usuario.intentos_fallidos + 1;
    const bloquear = intentos >= 5;
    await pool.execute('UPDATE usuarios SET intentos_fallidos = ?, bloqueado = ? WHERE id = ?', [
      intentos,
      bloquear ? 1 : 0,
      usuario.id,
    ]);
    throw new ApiError(401, 'CREDENCIALES_INVALIDAS', 'Documento o contraseña incorrectos');
  }

  await pool.execute('UPDATE usuarios SET intentos_fallidos = 0 WHERE id = ?', [usuario.id]);
  const token = jwt.sign({ id: usuario.id, rol: usuario.rol }, env.JWT_SECRET, { expiresIn: '8h' });
  res.cookie(COOKIE_SESION, token, opcionesCookie());
  return mapearUsuario(usuario);
}

// POST /auth/logout: borra la cookie de sesión.
function cerrarSesion(res) {
  res.clearCookie(COOKIE_SESION, { httpOnly: true, sameSite: 'lax', secure: false });
  return { mensaje: 'Sesión cerrada' };
}

module.exports = { registro, login, cerrarSesion, mapearUsuario };
