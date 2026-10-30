const servicio = require('./service');
const { ApiError } = require('../../utils/errores');

function parsearId(req, paramName = 'id') {
  const id = Number(req.params[paramName]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /admin/clientes?q=
async function buscarClientes(req, res, next) {
  try {
    const q = req.query.q;
    res.json(await servicio.buscarClientes(q));
  } catch (err) {
    next(err);
  }
}

// POST /admin/clientes
async function crearCliente(req, res, next) {
  try {
    const nuevoCliente = await servicio.crearCliente(req.usuario.id, req.body);
    res.status(201).json(nuevoCliente);
  } catch (err) {
    if (err.status === 409 && err.id) {
      return res.status(409).json({
        codigo: err.codigo,
        mensaje: err.mensaje,
        id: err.id,
      });
    }
    next(err);
  }
}

// GET /admin/clientes/:id
async function obtenerCliente(req, res, next) {
  try {
    const id = parsearId(req);
    if (!id) throw new ApiError(404, 'NO_ENCONTRADO', 'El cliente no existe');
    res.json(await servicio.obtenerCliente(id));
  } catch (err) {
    next(err);
  }
}

// PUT /admin/clientes/:id
async function actualizarCliente(req, res, next) {
  try {
    const id = parsearId(req);
    if (!id) throw new ApiError(404, 'NO_ENCONTRADO', 'El cliente no existe');
    res.json(await servicio.actualizarCliente(req.usuario.id, id, req.body));
  } catch (err) {
    if (err.status === 409 && err.id) {
      return res.status(409).json({
        codigo: err.codigo,
        mensaje: err.mensaje,
        id: err.id,
      });
    }
    next(err);
  }
}

// POST /admin/clientes/:id/baja
async function darDeBajaCliente(req, res, next) {
  try {
    const id = parsearId(req);
    if (!id) throw new ApiError(404, 'NO_ENCONTRADO', 'El cliente no existe');
    res.json(await servicio.darDeBajaCliente(req.usuario.id, id));
  } catch (err) {
    next(err);
  }
}

// GET /admin/clientes/:id/mascotas
async function listarMascotasCliente(req, res, next) {
  try {
    const id = parsearId(req);
    if (!id) throw new ApiError(404, 'NO_ENCONTRADO', 'El cliente no existe');
    res.json(await servicio.listarMascotasCliente(id));
  } catch (err) {
    next(err);
  }
}

// POST /admin/clientes/:id/mascotas
async function crearMascotaCliente(req, res, next) {
  try {
    const id = parsearId(req);
    if (!id) throw new ApiError(404, 'NO_ENCONTRADO', 'El cliente no existe');
    const mascota = await servicio.crearMascotaCliente(req.usuario.id, id, req.body);
    res.status(201).json(mascota);
  } catch (err) {
    next(err);
  }
}

// PUT /admin/mascotas/:id
async function actualizarMascotaAdmin(req, res, next) {
  try {
    const id = parsearId(req);
    if (!id) throw new ApiError(404, 'NO_ENCONTRADO', 'La mascota no existe');
    res.json(await servicio.actualizarMascotaAdmin(req.usuario.id, id, req.body));
  } catch (err) {
    next(err);
  }
}

// POST /admin/clientes/:id/desbloquear (BE-13)
async function desbloquearCliente(req, res, next) {
  try {
    const id = parsearId(req);
    if (!id) throw new ApiError(404, 'NO_ENCONTRADO', 'El cliente no existe');
    const resultado = await servicio.desbloquearCliente(req.usuario.id, id, req.body);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

// POST /admin/clientes/:id/anonimizar (BE-15)
async function anonimizarCliente(req, res, next) {
  try {
    const id = parsearId(req);
    if (!id) throw new ApiError(404, 'NO_ENCONTRADO', 'El cliente no existe');
    const resultado = await servicio.anonimizarCliente(req.usuario.id, id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  buscarClientes,
  crearCliente,
  obtenerCliente,
  actualizarCliente,
  darDeBajaCliente,
  desbloquearCliente,
  anonimizarCliente,
  listarMascotasCliente,
  crearMascotaCliente,
  actualizarMascotaAdmin,
};
