const router = require('express').Router();
const controlador = require('./controller');
const { validar } = require('../../middlewares/validar');
const { auth } = require('../../middlewares/auth');
const { roles } = require('../../middlewares/roles');
const { registroSchema, loginSchema, passwordSchema, desbloquearSchema } = require('./schema');
const { recuperarSchema, restablecerSchema } = require('./schema');

router.post('/registro', validar(registroSchema), controlador.registro);
router.post('/login', validar(loginSchema), controlador.login);
router.post('/logout', auth, roles('admin', 'cliente'), controlador.logout);
router.get('/me', auth, roles('admin', 'cliente'), controlador.me);
router.post('/recuperar', validar(recuperarSchema), controlador.recuperar);
router.post('/restablecer', validar(restablecerSchema), controlador.restablecer);

module.exports = router;
