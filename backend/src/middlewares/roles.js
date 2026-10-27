// Autorización por rol en el servidor (RNF01). Uso: roles('admin') o
// roles('admin', 'cliente') luego del middleware auth.
function roles(...permitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ codigo: 'NO_AUTENTICADO', mensaje: 'Debe iniciar sesión' });
    }
    if (!permitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ codigo: 'SIN_PERMISO', mensaje: 'No tiene permisos para realizar esta operación' });
    }
    next();
  };
}

module.exports = { roles };
