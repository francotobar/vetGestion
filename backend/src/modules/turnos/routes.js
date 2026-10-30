const express = require('express');
const controlador = require('./controller');
const { validar } = require('../../middlewares/validar');
const { auth } = require('../../middlewares/auth');
const { roles } = require('../../middlewares/roles');
const {
  crearTurnoSchema,
  reprogramarTurnoSchema,
  crearTurnoAdminSchema,
  cambiarEstadoSchema,
  urgenciaSchema,
} = require('./schema');
const { cargarAtencionSchema } = require('../atenciones/schema');
const controladorAtenciones = require('../atenciones/controller');

// Router de turnos cliente / C/A:
// Franjas libres del día para reservar (C/A), reserva, consulta, cancelación y
// reprogramación de turnos del cliente (RF08 a RF11).
const routerCliente = express.Router();
routerCliente.get('/disponibilidad', auth, roles('admin', 'cliente'), controlador.disponibilidad);
routerCliente.post('/', auth, roles('cliente'), validar(crearTurnoSchema), controlador.crear);
routerCliente.get('/mios', auth, roles('cliente'), controlador.misTurnos);
routerCliente.patch('/:id/cancelar', auth, roles('cliente'), controlador.cancelar);
routerCliente.patch(
  '/:id/reprogramar',
  auth,
  roles('cliente'),
  validar(reprogramarTurnoSchema),
  controlador.reprogramar
);

// Router de turnos admin (RF21, RF25, BE-10, BE-11):
// Agenda, turno manual, cambio de estado, reprogramación admin y urgencias.
const routerAdmin = express.Router();
routerAdmin.use(auth, roles('admin'));
routerAdmin.get('/', controlador.agendaAdmin);
routerAdmin.post('/', validar(crearTurnoAdminSchema), controlador.crearAdmin);
routerAdmin.patch('/:id/estado', validar(cambiarEstadoSchema), controlador.cambiarEstadoAdmin);
routerAdmin.patch(
  '/:id/reprogramar',
  validar(reprogramarTurnoSchema),
  controlador.reprogramarAdmin
);
routerAdmin.post('/:id/urgencia', validar(urgenciaSchema), controlador.urgenciaAdmin);
routerAdmin.post('/:id/atencion', auth, roles('admin'), validar(cargarAtencionSchema), controladorAtenciones.cargarAtencion);

module.exports = routerCliente;
module.exports.routerCliente = routerCliente;
module.exports.routerAdmin = routerAdmin;
