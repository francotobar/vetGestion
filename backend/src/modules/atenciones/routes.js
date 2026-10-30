const router = require('express').Router();
const controlador = require('./controller');
const { validar } = require('../../middlewares/validar');
const { auth } = require('../../middlewares/auth');
const { roles } = require('../../middlewares/roles');
const { notaSchema } = require('./schema');

// POST /api/admin/atenciones/:id/notas (RF27, BE-14): nota aclaratoria de una atención.
router.post('/:id/notas', auth, roles('admin'), validar(notaSchema), controlador.agregarNota);

module.exports = router;
