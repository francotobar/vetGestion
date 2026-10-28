const router = require('express').Router();
const controlador = require('./controller');
const { validar } = require('../../middlewares/validar');
const { auth } = require('../../middlewares/auth');
const { roles } = require('../../middlewares/roles');
const { crearTurnoSchema, reprogramarTurnoSchema } = require('./schema');

// Franjas libres del día para reservar (C/A), reserva, consulta, cancelación y
// reprogramación de turnos del cliente (RF08 a RF11).
router.get('/disponibilidad', auth, roles('admin', 'cliente'), controlador.disponibilidad);
router.post('/', auth, roles('cliente'), validar(crearTurnoSchema), controlador.crear);
router.get('/mios', auth, roles('cliente'), controlador.misTurnos);
router.patch('/:id/cancelar', auth, roles('cliente'), controlador.cancelar);
router.patch(
  '/:id/reprogramar',
  auth,
  roles('cliente'),
  validar(reprogramarTurnoSchema),
  controlador.reprogramar
);

module.exports = router;
