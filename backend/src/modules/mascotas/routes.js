const router = require('express').Router();
const controlador = require('./controller');
const { validar } = require('../../middlewares/validar');
const { auth } = require('../../middlewares/auth');
const { roles } = require('../../middlewares/roles');
const { mascotaSchema } = require('./schema');

// CRUD de mascotas propias, solo cliente (sección 6). El admin gestiona las
// mascotas de sus clientes por /admin/clientes/:id/mascotas (BE-12).
router.get('/', auth, roles('cliente'), controlador.listar);
router.post('/', auth, roles('cliente'), validar(mascotaSchema), controlador.crear);
router.get('/:id', auth, roles('cliente'), controlador.obtener);
router.put('/:id', auth, roles('cliente'), validar(mascotaSchema), controlador.actualizar);
router.delete('/:id', auth, roles('cliente'), controlador.eliminar);

module.exports = router;
