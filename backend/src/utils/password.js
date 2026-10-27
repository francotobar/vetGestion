// Hash y verificación de contraseñas con bcrypt (RNF02: nunca texto plano).
const bcrypt = require('bcryptjs');

function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

function compararPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = { hashPassword, compararPassword };
