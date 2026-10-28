const router = require('express').Router();
const controlador = require('./controller');
const { validar } = require('../../middlewares/validar');
const { auth } = require('../../middlewares/auth');
const { roles } = require('../../middlewares/roles');
const { crearTurnoSchema } = require('./schema');

// Franjas libres del día para reservar (C/A) y reserva del turno (solo
// cliente, RF09). BE-09 agregará /turnos/mios, cancelar y reprogramar.
router.get('/disponibilidad', auth, roles('admin', 'cliente'), controlador.disponibilidad);
router.post('/', auth, roles('cliente'), validar(crearTurnoSchema), controlador.crear);

module.exports = router;
