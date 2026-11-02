# vetGestión — Sistema de turnos veterinaria

## Despliegue en Render

### render.yaml

Este proyecto incluye un `render.yaml` con dos servicios:

1. **Backend** (`type: web`): Servicio Node.js que escucha en `process.env.PORT` (por defecto 3000).
   - `healthCheckPath: /api/salud` — Render hace ping a este endpoint para verificar que el servicio está vivo.
   - La variable `TZ=America/Argentina/Buenos_Aires` está definida para mantener la consistencia de fechas.
   - Las variables sensibles (como `DB_PASSWORD`, `JWT_SECRET`) deben setearse en el panel de Render como `Environment Variables` y **no** deben commitearse en el repo (usar `sync: false` o dejarlas fuera del yaml).

2. **Frontend** (`type: static`): Sitio estático build con Vite.
   - `buildCommand: npm run build`
   - `rootDir: dist`
   - La variable `VITE_API_URL` debe setearse en el panel de Render para apuntar al backend (ver sección "Conexión FE/BE" más abajo).

### Conexión Frontend ↔ Backend

Hay **dos formas** de conectar el frontend con el backend en Render. Elegí la opción (a) por simplicidad y seguridad de cookies.

#### (a) Dominios distintos con cookie `SameSite=None` (recomendada)

- El frontend se ejecuta en `https://<nombre>.onrender.com` y el backend en `https://<nombre>.onrender.com`.
- La cookie de sesión se establece con `SameSite=None` y `Secure` (solo en producción, `SameSite=Lax` en local).
- El frontend configura `VITE_API_URL` con la URL del backend (`https://vetgestion-backend.onrender.com`).
- El navegador envía la cookie en todas las solicitudes cross-origin a la API, y el backend la acepta por haber configurado `app.set('trust proxy', 1)`.

**Cómo declarar las variables en Render:**
- Backend: `NODE_ENV=production`, `FRONTEND_URL=https://<frontend>.onrender.com`, `DB_PASSWORD`, `JWT_SECRET`, etc.
- Frontend: `VITE_API_URL=https://vetgestion-backend.onrender.com`, `VITE_TZ=America/Argentina/Buenos_Aires`.

#### (b) Regla de rewrite en el sitio estático

- Se declara un `_redirects` en la carpeta `dist` (o una regla en `render.yaml`) que reescribe `/api/*` al backend.
- Ejemplo de regla: `/api/*  https://vetgestion-backend.onrender.com/api/:splat  308`.
- El navegador hace la petición al backend detrás de escena, pero la URL en la barra se mantiene o cambia según el tipo de redirect.
- **Limitación:** La cookie sigue estando atada al dominio del frontend (ya sea por SameSite=Lax en el dominio del frontend o por el redirect). Para que funcione se necesitaría `SameSite=None` de todos modos, por lo que la ventaja es marginal.

**Recomendación:** Usar la **opción (a)**. Es más simple, no requiere reglas de rewrite y las cookies comportarse de manera predecible con `SameSite=None + Secure`. La opción (b) agrega complejidad sin resolver el problema fundamental de las cookies cross-origin.

## Conexión con Aiven

Cuando se despliegue la base de datos en Aiven:

- Setear `DB_HOST` al hostname de conexión de Aiven (ej. `aws.connect-to-aiven.com`).
- Setear `DB_PORT=14530` (puerto SSL de Aiven por defecto).
- Setear `DB_SSL_CA` con el contenido del certificado CA de Aiven (base64 o texto). Esto activa `ssl: { ca: obtenerSSLCA(...), rejectUnauthorized: true }` en `config/db.js`.
- Mantener `DB_USER`, `DB_PASSWORD` y `DB_NAME` según la base de datos Aiven creada.

## Uso local

Desarrollo en local con MySQL local y Vite dev server:

```bash
cd backend && npm run dev      # API en http://localhost:3000
cd frontend && npm run dev    # Front en http://localhost:5173
```

### Comandos útiles

- `npm run db:reset` — Resetear y poblar la BD con seed.
- `npm run seed` — Insertar datos de demo.
- `npm test` — Ejecutar tests automatizados.
- `npm run build` — Build del frontend para producción.