const express = require('express');
const controlador = require('./controller');
const { validar } = require('../../middlewares/validar');
const { auth } = require('../../middlewares/auth');
const { roles } = require('../../middlewares/roles');
const { servicioSchema } = require('./schema');

// Punto de vista del cliente (C/A): solo servicios activos.
const routerPublico = express.Router();
routerPublico.get('/', auth, roles('admin', 'cliente'), controlador.listarActivos);

// ABM del catálogo, solo admin (RF19): ve el catálogo completo y puede
// crear, editar y activar/desactivar.
const routerAdmin = express.Router();
routerAdmin.use(auth, roles('admin'));
routerAdmin.get('/', controlador.listarTodos);
routerAdmin.post('/', validar(servicioSchema), controlador.crear);
routerAdmin.put('/:id', validar(servicioSchema), controlador.actualizar);

module.exports = { routerPublico, routerAdmin };
