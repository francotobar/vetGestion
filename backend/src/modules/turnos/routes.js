const router = require('express').Router();
const controlador = require('./controller');
const { auth } = require('../../middlewares/auth');
const { roles } = require('../../middlewares/roles');

// Franjas libres del día para reservar (C/A). BE-08 agregará POST /turnos,
// /turnos/mios, cancelar y reprogramar.
router.get('/disponibilidad', auth, roles('admin', 'cliente'), controlador.disponibilidad);

module.exports = router;
