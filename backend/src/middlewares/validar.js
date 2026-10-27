// Validación de entrada con zod (seguridad mínima del plan, sección 0.5).
// Si falla, responde 400 con { codigo, mensaje }.
function validar(schema) {
  return (req, res, next) => {
    const resultado = schema.safeParse(req.body);
    if (!resultado.success) {
      const mensajes = resultado.error.issues.map((i) => i.message).join(' | ');
      return res.status(400).json({ codigo: 'DATOS_INVALIDOS', mensaje: mensajes });
    }
    req.body = resultado.data;
    next();
  };
}

module.exports = { validar };
