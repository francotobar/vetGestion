const express = require('express');
const controlador = require('./controller');
const { validar } = require('../../middlewares/validar');
const { auth } = require('../../middlewares/auth');
const { roles } = require('../../middlewares/roles');
const { altaClienteSchema, editarClienteSchema } = require('./schema');
const { mascotaSchema } = require('../mascotas/schema');

// Router para /api/admin/clientes (sección 6 del plan, BE-12):
// Búsqueda, alta asistida (RF01b, RF24), ver/editar cliente, baja lógica y gestión de sus mascotas.
const routerAdminClientes = express.Router();
routerAdminClientes.use(auth, roles('admin'));

routerAdminClientes.get('/', controlador.buscarClientes);
routerAdminClientes.post('/', validar(altaClienteSchema), controlador.crearCliente);
routerAdminClientes.get('/:id', controlador.obtenerCliente);
routerAdminClientes.put('/:id', validar(editarClienteSchema), controlador.actualizarCliente);
routerAdminClientes.post('/:id/baja', controlador.darDeBajaCliente);
routerAdminClientes.get('/:id/mascotas', controlador.listarMascotasCliente);
routerAdminClientes.post('/:id/mascotas', validar(mascotaSchema), controlador.crearMascotaCliente);

// Router para /api/admin/mascotas (sección 6 del plan, BE-12):
// Edición de mascota por admin: PUT /api/admin/mascotas/:id
const routerAdminMascotas = express.Router();
routerAdminMascotas.use(auth, roles('admin'));

routerAdminMascotas.put('/:id', validar(mascotaSchema), controlador.actualizarMascotaAdmin);

module.exports = {
  routerAdminClientes,
  routerAdminMascotas,
};
