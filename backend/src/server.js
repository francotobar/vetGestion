const { env } = require('./config/env');
const app = require('./app');

// Los scripts npm ya ejecutan Node con esta zona horaria (regla 8 del plan).
process.env.TZ = env.TZ;

app.listen(env.PORT, () => {
  console.log(`vetGestión API escuchando en http://localhost:${env.PORT}`);
});
