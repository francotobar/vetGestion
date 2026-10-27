const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { env } = require('./config/env');
const { probarConexion } = require('./config/db');
const { noEncontrado, manejarErrores } = require('./middlewares/errores');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Módulos (sección 6 del plan)
app.use('/api/auth', require('./modules/auth/routes'));

// HEALTH: chequeo de salud del sistema (BE-01)
app.get('/api/salud', async (req, res) => {
  try {
    await probarConexion();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(503).json({
      codigo: 'SIN_BASE_DE_DATOS',
      mensaje: 'No se pudo conectar a la base de datos',
    });
  }
});

app.use(noEncontrado);
app.use(manejarErrores);

module.exports = app;
