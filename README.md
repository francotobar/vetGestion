# vetGestión — Sistema de turnos veterinaria

## Conexión: local vs Aiven

- **Desarrollo local**: El backend usa `DB_HOST=localhost` (o la IP del servidor MySQL local). Si `DB_SSL_CA` está vacía o no definida, la conexión es sin SSL tal como hoy.
- **Producción (Aiven)**: Al desplegar en Aiven/Railway/Render, setear `DB_HOST=aws.connect-to-aiven.com` (o el host de Aiven), `DB_PORT=14530` (puerto SSL de Aiven), y `DB_SSL_CA` con el contenido del certificado CA (o ruta de archivo). La variable `DB_SSL_CA` activa `rejectUnauthorized: true` en la conexión MySQL.

### Variables de entorno

| Variable | Descripción | Default/local |
|---|---|---|
| `DB_HOST` | Host de MySQL | `localhost` |
| `DB_PORT` | Puerto | `3306` |
| `DB_USER` | Usuario | `root` |
| `DB_PASSWORD` | Contraseña | (vacía) |
| `DB_NAME` | Nombre de base | `vetgestion` |
| `DB_SSL_CA` | Contenido del certificado CA o ruta de archivo | *(vacía = local sin SSL)* |

Si `DB_SSL_CA` tiene valor, la conexión usa SSL con verificación de certificado. Dejarla vacía para desarrollo sobre MySQL local.