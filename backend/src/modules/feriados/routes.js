const express = require('express');
const controlador = require('./controller');
const { validar } = require('../../middlewares/validar');
const { auth } = require('../../middlewares/auth');
const { roles } = require('../../middlewares/roles');
const { feriadoSchema } = require('./schema');

// Punto de vista del cliente (C/A): consultar la lista de feriados.
const routerPublico = express.Router();
routerPublico.get('/', auth, roles('admin', 'cliente'), controlador.listar);

// Alta y baja de feriados, solo admin (RF23).
const routerAdmin = express.Router();
routerAdmin.use(auth, roles('admin'));
routerAdmin.post('/', validar(feriadoSchema), controlador.crear);
routerAdmin.delete('/:fecha', controlador.eliminar);

module.exports = { routerPublico, routerAdmin };
