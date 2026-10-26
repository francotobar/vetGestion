// Carga las variables de entorno (backend/.env) y las expone con valores por defecto.
// El .env nunca se commitea (ver .gitignore); cada integrante lo arma desde .env.example.
require('dotenv').config();

const env = {
  PORT: Number(process.env.PORT) || 3000,
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: Number(process.env.DB_PORT) || 3306,
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || 'vetgestion',
  JWT_SECRET: process.env.JWT_SECRET || 'cambiar_esto',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  HORA_INICIO: process.env.HORA_INICIO || '09:00',
  HORA_FIN: process.env.HORA_FIN || '19:00',
  SLOT_MINUTOS: Number(process.env.SLOT_MINUTOS) || 30,
  ANTELACION_HS: Number(process.env.ANTELACION_HS) || 24,
  DIAS_MAX_RESERVA: Number(process.env.DIAS_MAX_RESERVA) || 60,
  TZ: process.env.TZ || 'America/Argentina/Buenos_Aires',
};

module.exports = { env };
