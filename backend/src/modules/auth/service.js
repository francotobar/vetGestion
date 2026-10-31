const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { env } = require('../../config/env');
const { pool } = require('../../config/db');
const { ApiError } = require('../../utils/errores');
const { hashPassword, compararPassword } = require('../../utils/password');
const { z } = require('zod');

// Hash SHA-256 de un token (para almacenar de forma segura)
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Fecha y hora local como 'YYYY-MM-DD HH:mm:ss', el formato exacto en que
// dateStrings: true (config/db.js) devuelve los DATETIME del backend.
// Comparar texto contra texto en este formato es comparar cronológicamente
// (las columnas se guardan como DATETIME locales sin zona, regla 8 del plan):
// comparar ese texto contra un objeto Date daría NaN y siempre false, lo que
// dejaba sin efecto el vencimiento de 1 hora de los tokens de recuperación.
function fechaLocalTexto(momento) {
  const d = momento || new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

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

// Desbloqueo por admin (sección 5, 6 y 7 - BE-13):
// bloqueado=0, intentos_fallidos=0 y nueva contraseña temporal opcional.
async function desbloquearPorAdmin(adminId, clienteId, { password } = {}) {
  const [[usuario]] = await pool.execute(
    `SELECT id, rol, documento, nombre, apellido, telefono, email,
            password_hash, estado_cuenta, intentos_fallidos, bloqueado
       FROM usuarios WHERE id = ? AND rol = 'cliente'`,
    [clienteId]
  );

  if (!usuario) {
    throw new ApiError(404, 'NO_ENCONTRADO', 'El cliente no existe');
  }

  let hash = null;
  if (password) {
    hash = await hashPassword(password);
  }

  if (hash) {
    await pool.execute(
      `UPDATE usuarios
          SET bloqueado = 0,
              intentos_fallidos = 0,
              password_hash = ?,
              estado_cuenta = IF(estado_cuenta = 'sin_cuenta', 'con_cuenta', estado_cuenta),
              modificado_por = ?
        WHERE id = ?`,
      [hash, adminId, clienteId]
    );
  } else {
    await pool.execute(
      `UPDATE usuarios
          SET bloqueado = 0,
              intentos_fallidos = 0,
              modificado_por = ?
        WHERE id = ?`,
      [adminId, clienteId]
    );
  }

  const [[actualizado]] = await pool.execute(
    `SELECT id, rol, documento, nombre, apellido, telefono, email,
            estado_cuenta, bloqueado, intentos_fallidos, creado_en, modificado_en
       FROM usuarios WHERE id = ?`,
    [clienteId]
  );

  return {
    mensaje: 'Cliente desbloqueado correctamente',
    cliente: {
      id: actualizado.id,
      rol: actualizado.rol,
      documento: actualizado.documento,
      nombre: actualizado.nombre,
      apellido: actualizado.apellido,
      telefono: actualizado.telefono,
      email: actualizado.email,
      estado_cuenta: actualizado.estado_cuenta,
      bloqueado: actualizado.bloqueado === 1,
      intentos_fallidos: actualizado.intentos_fallidos,
      creado_en: actualizado.creado_en,
      modificado_en: actualizado.modificado_en,
    },
  };
}

// Función para recuperar contraseña por email (BE-16, P1)
async function recuperarPorEmail(email) {
  const [[usuario]] = await pool.execute(
    `SELECT id, rol, documento, nombre, apellido, telefono, email,
            password_hash, estado_cuenta, bloqueado, intentos_fallidos, reset_token_hash, reset_expira
       FROM usuarios WHERE email = ?`,
    [email]
  );

  // Vencimiento: 1 hora. Como dateStrings (config/db.js) devuelve los
  // DATETIME como texto local, la comparación y el guardado usan ese mismo
  // formato ('YYYY-MM-DD HH:mm:ss') para que el vencimiento se respete.
  const ahoraTexto = fechaLocalTexto();
  const expiraTexto = fechaLocalTexto(new Date(Date.now() + 60 * 60 * 1000));

  if (usuario && usuario.reset_token_hash && usuario.reset_expira && usuario.reset_expira > ahoraTexto) {
    // Token ya existente y vigente: renovarlo (queda activo solo el último)
    const tokenAleatorio = crypto.randomBytes(32).toString('hex');
    const hashNuevo = hashToken(tokenAleatorio);

    await pool.execute(
      `UPDATE usuarios SET reset_token_hash = ?, reset_expira = ? WHERE id = ?`,
      [hashNuevo, expiraTexto, usuario.id]
    );
    return { token: tokenAleatorio, expira: expiraTexto, renovado: true, usuario: { id: usuario.id, email: usuario.email } };
  }

  if (!usuario) {
    // Email no registrado: generamos un token igualmente para no filtrar información
    // sobre qué emails están registrados, pero sin asociarlo a un usuario real
    const tokenAleatorio = crypto.randomBytes(32).toString('hex');
    return { token: tokenAleatorio, expira: expiraTexto, nuevo: true, usuario: null };
  }

  // Usuario existe pero sin token previo: crear uno nuevo
  const tokenAleatorio = crypto.randomBytes(32).toString('hex');
  const hash = hashToken(tokenAleatorio);

  await pool.execute(
    `UPDATE usuarios SET reset_token_hash = ?, reset_expira = ? WHERE id = ?`,
    [hash, expiraTexto, usuario.id]
  );
  return { token: tokenAleatorio, expira: expiraTexto, renovado: false, usuario: { id: usuario.id, email: usuario.email } };
}

// RESTABLECER Contraseña por token (BE-16, P1)
async function restablecerPorToken({ token, password }) {
  const hashSolicitado = hashToken(token);
  // Igual que en recuperarPorEmail: reset_expira llega como texto local
  // (dateStrings), se compara texto contra texto. Un token sin vencimiento
  // registrado se trata como vencido (no debería existir: se guardan juntos).
  const ahoraTexto = fechaLocalTexto();

  // Buscar usuario por hash de token y verificar que no haya expirado
  const [[usuario]] = await pool.execute(
    `SELECT id, rol, documento, nombre, apellido, telefono, email,
            password_hash, estado_cuenta, bloqueado, intentos_fallidos, reset_token_hash, reset_expira
       FROM usuarios WHERE reset_token_hash = ?`,
    [hashSolicitado]
  );

  if (!usuario) {
    throw new ApiError(400, 'TOKEN_INVALIDO', 'Token inválido o expirado');
  }

  if (!usuario.reset_expira || usuario.reset_expira < ahoraTexto) {
    // Token vencido: limpiar y lanzar error
    await pool.execute(`UPDATE usuarios SET reset_token_hash = NULL, reset_expira = NULL WHERE id = ?`, [usuario.id]);
    throw new ApiError(400, 'TOKEN_VENCIDO', 'Token vencido');
  }

  // Validar regla de contraseña: ≥ 6 caracteres y ≥ 2 dígitos
  const passwordSchema = z
    .string({ required_error: 'Falta la contraseña' })
    .regex(/^(?=(?:.*\d){2,}).{6,}$/, 'La contraseña debe tener al menos 6 caracteres y 2 números');

  const resultado = passwordSchema.safeParse(password);
  if (!resultado.success) {
    throw new ApiError(400, 'CONTRASEÑA_INVALIDA', resultado.error.errors[0].message);
  }

  const hashNuevo = await hashPassword(password);

  await pool.execute(
    `UPDATE usuarios
       SET password_hash = ?,
           bloqueado = 0,
           intentos_fallidos = 0,
           reset_token_hash = NULL,
           reset_expira = NULL
     WHERE id = ?`,
    [hashNuevo, usuario.id]
  );

  const [[actualizado]] = await pool.execute(
    `SELECT id, rol, documento, nombre, apellido, telefono, email,
            estado_cuenta, bloqueado, intentos_fallidos, creado_en, modificado_en
       FROM usuarios WHERE id = ?`,
    [usuario.id]
  );

  return {
    mensaje: 'Contraseña restablecida correctamente',
    cliente: {
      id: actualizado.id,
      rol: actualizado.rol,
      documento: actualizado.documento,
      nombre: actualizado.nombre,
      apellido: actualizado.apellido,
      telefono: actualizado.telefono,
      email: actualizado.email,
      estado_cuenta: actualizado.estado_cuenta,
      bloqueado: actualizado.bloqueado === 1,
      intentos_fallidos: actualizado.intentos_fallidos,
      creado_en: actualizado.creado_en,
      modificado_en: actualizado.modificado_en,
    },
  };
}

module.exports = { registro, login, cerrarSesion, mapearUsuario, desbloquearPorAdmin, recuperarPorEmail, restablecerPorToken };
