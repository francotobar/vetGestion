# vetGestión — Sistema de turnos para veterinaria

Sistema web que ordena la atención de una veterinaria con una **agenda única de franjas de 30 minutos** (lunes a viernes, 09:00 a 19:00). Los clientes se registran, cargan sus mascotas, reservan turnos en línea y consultan el historial clínico; el administrador gestiona la agenda, los turnos pedidos por teléfono o en mostrador, los clientes, los servicios y los feriados, y registra las atenciones.

Dos roles: **cliente** y **administrador** (el profesional veterinario no usa el sistema).

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 18 + Vite 5, react-router-dom, axios, dayjs, CSS propio (sin librerías de UI) |
| Backend | Node.js 20, Express 4, Zod (validación), JWT en cookie `httpOnly`, bcryptjs, helmet, cors |
| Base de datos | MySQL 8 (local o Aiven en el despliegue), `mysql2` con consultas parametrizadas |
| Pruebas | Jest 29 + Supertest 7 (solo backend) |

## Requisitos

* Node.js 20 y npm.
* MySQL 8 en ejecución (local).
* Navegador moderno.

## Instalación local

1. **Clonar el repositorio** y abrir una terminal en la raíz (`vetGestion/`).
2. **Backend — dependencias:**

   ```bash
   cd backend
   npm install
   ```

3. **Backend — configuración:** crear el archivo `.env` a partir del ejemplo y completar los valores propios (`DB_PASSWORD`, `JWT_SECRET`):

   ```bash
   copy .env.example .env    # Windows
   # cp .env.example .env    # Linux/macOS
   ```

   Variables: `PORT`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL_CA`, `JWT_SECRET`, `FRONTEND_URL`, `HORA_INICIO`, `HORA_FIN`, `SLOT_MINUTOS`, `ANTELACION_HS`, `DIAS_MAX_RESERVA`, `TZ`.

4. **Base de datos:** crear la estructura con el esquema (`backend/db/schema.sql`) y cargar los datos de demostración:

   ```bash
   npm run db:reset    # recrea la base con schema.sql
   npm run seed        # inserta los datos de demostración
   ```

   `db:reset` **no** incluye el seed: hay que ejecutar los dos comandos.

5. **Frontend — dependencias y configuración:** el frontend usa `VITE_API_URL` (URL del backend). En local, si no se define, usa `http://localhost:3000/api`:

   ```bash
   cd ../frontend
   npm install
   ```

6. **Levantar la aplicación** (dos terminales):

   ```bash
   # Terminal 1 (backend) → http://localhost:3000
   cd backend && npm run dev

   # Terminal 2 (frontend) → http://localhost:5173
   cd frontend && npm run dev
   ```

7. Abrir `http://localhost:5173` e ingresar con las cuentas de la sección siguiente.

## Comandos

| Dónde | Comando | Qué hace |
| --- | --- | --- |
| `backend/` | `npm run dev` | API en desarrollo (nodemon), `http://localhost:3000` |
| `backend/` | `npm start` | API en modo producción |
| `backend/` | `npm test` | Suites automatizadas (Jest + Supertest) |
| `backend/` | `npm run db:reset` | Elimina y recrea la base con `schema.sql` |
| `backend/` | `npm run seed` | Carga los datos de demostración |
| `frontend/` | `npm run dev` | Interfaz en desarrollo, `http://localhost:5173` |
| `frontend/` | `npm run build` | Build de producción en `frontend/dist` |
| `frontend/` | `npm run preview` | Sirve el build localmente |

**Pruebas:** `npm test` ejecuta **15 suites y 158 pruebas** (resultado: `Test Suites: 15 passed, 15 total` / `Tests: 158 passed, 158 total`). El script usa la sintaxis Unix `TZ=...`; en Windows hay que definir la zona antes de correr Jest, por ejemplo en PowerShell:

```powershell
$env:TZ='America/Argentina/Buenos_Aires'; npx jest --runInBand
```

Las pruebas usan una base local: se saltan si `DB_SSL_CA` está definida o si `DB_HOST` no es `localhost`.

## Cuentas de demostración (solo desarrollo)

Las crea `npm run seed`. **Son datos ficticios para desarrollo local: no usarlas ni publicarlas en producción.**

| Rol | Documento | Contraseña |
| --- | --- | --- |
| Administrador | `00000000` | `Admin12` |
| Cliente (Luciana García) | `28765432` | `Demo12` |
| Cliente (Martín Ferreyra) | `31999888` | `Demo12` |

## Endpoints

Todos bajo `/api`. Rol: **P** = pública, **C** = cliente, **A** = administrador.

| Método y ruta | Rol | Descripción |
| --- | --- | --- |
| GET `/salud` | P | Salud del sistema (chequea la conexión a la base) |
| POST `/auth/registro` | P | Registro de cliente con consentimiento de datos |
| POST `/auth/login` | P | Inicio de sesión (documento + contraseña) |
| POST `/auth/logout` | C/A | Cierra sesión y borra la cookie |
| GET `/auth/me` | C/A | Usuario en sesión |
| POST `/auth/recuperar` | P | Pide el enlace de restablecimiento (envío simulado por consola) |
| POST `/auth/restablecer` | P | Restablece la contraseña con el token recibido |
| GET `/mascotas` | C | Mascotas propias |
| POST `/mascotas` | C | Alta de mascota propia |
| GET `/mascotas/:id` | C | Ficha de la mascota (las ajenas responden 404) |
| PUT `/mascotas/:id` | C | Edita la mascota propia |
| DELETE `/mascotas/:id` | C | Baja lógica de la mascota propia |
| GET `/mascotas/:id/historial` | C | Historial clínico con notas aclaratorias |
| GET `/servicios` | C/A | Servicios activos |
| GET `/admin/servicios` | A | Catálogo completo |
| POST `/admin/servicios` | A | Alta de servicio |
| PUT `/admin/servicios/:id` | A | Edita / activa / desactiva un servicio |
| GET `/feriados` | C/A | Lista de feriados |
| POST `/admin/feriados` | A | Alta de feriado |
| DELETE `/admin/feriados/:fecha` | A | Baja de feriado |
| GET `/turnos/disponibilidad?fecha=` | C/A | Franjas libres del día |
| POST `/turnos` | C | Reserva de turno (nace `pendiente`) |
| GET `/turnos/mios` | C | Turnos propios con estado |
| PATCH `/turnos/:id/cancelar` | C | Cancelación del cliente (≥ 24 h de antelación) |
| PATCH `/turnos/:id/reprogramar` | C | Reprogramación del cliente (vuelve a `pendiente`) |
| GET `/admin/turnos?desde=&hasta=&estado=` | A | Agenda por día o semana |
| POST `/admin/turnos` | A | Turno manual (telefónico o presencial, nace `confirmado`) |
| PATCH `/admin/turnos/:id/estado` | A | Cambio de estado (mapa de transiciones) |
| PATCH `/admin/turnos/:id/reprogramar` | A | Reprogramación administrativa (conserva el estado) |
| POST `/admin/turnos/:id/urgencia` | A | Urgencia: cancelar o reprogramar con motivo; devuelve el contacto del cliente |
| POST `/admin/turnos/:id/atencion` | A | Registra la atención de un turno atendido |
| GET `/admin/clientes?q=` | A | Busca clientes por nombre, documento o email |
| POST `/admin/clientes` | A | Alta asistida de cliente (sin cuenta) |
| GET `/admin/clientes/:id` | A | Ficha del cliente |
| PUT `/admin/clientes/:id` | A | Edita el cliente |
| POST `/admin/clientes/:id/baja` | A | Baja lógica de la cuenta |
| POST `/admin/clientes/:id/desbloquear` | A | Desbloquea y fija contraseña temporal |
| POST `/admin/clientes/:id/anonimizar` | A | Supresión de datos personales (Ley 25.326) |
| GET `/admin/clientes/:id/mascotas` | A | Mascotas activas del cliente |
| POST `/admin/clientes/:id/mascotas` | A | Alta de mascota desde la ficha del cliente |
| PUT `/admin/mascotas/:id` | A | Edita una mascota |
| GET `/admin/mascotas/:id/historial` | A | Historial clínico de la mascota |
| POST `/admin/atenciones/:id/notas` | A | Nota aclaratoria sobre una atención |

No existen endpoints de edición ni borrado de atenciones: son inmutables (triggers en la base de datos).

## Estructura del repositorio

```text
vetGestion/
├── AGENTS.md
├── README.md
├── docs/
│   ├── DECISIONES.md
│   ├── especificacion_proyecto_veterinario.md
│   ├── plan_desarrollo_mvp_vetgestion.md
│   └── proyecto_vetgestion_documento_de_apuntes_y_especificacion.md
├── backend/
│   ├── db/            # schema.sql, reset.js, seed.js
│   ├── src/
│   │   ├── app.js, server.js
│   │   ├── config/    # env.js, db.js
│   │   ├── middlewares/  # auth, roles, validar, errores
│   │   ├── modules/   # auth, clientes, mascotas, servicios, feriados, turnos, atenciones
│   │   └── utils/     # fechas, password, errores
│   ├── tests/         # suites Jest + Supertest
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── api/         # cliente axios y un archivo por módulo
    │   ├── context/     # AuthContext
    │   ├── components/  # Layout, NavBar, RutaProtegida, Campo, Modal, EstadoBadge, SelectorFranja, ...
    │   ├── pages/       # publicas/, cliente/, admin/
    │   ├── App.jsx, main.jsx, styles.css
    ├── vite.config.js
    └── package.json
```

## Respaldo de la base de datos

```bash
mysqldump -u root -p vetgestion > backup.sql
```

## Aplicación desplegada

* **Frontend:** https://vetgestionfrontend.onrender.com/
* **Backend (API):** https://vetgestion.onrender.com/

Corren en planes gratuitos de Render (la base en Aiven): pueden tardar unos segundos en despertar. Todo también puede evaluarse en local.

## Trabajo futuro

* Recordatorios por email 24 h antes del turno.
* Envío real de emails con SMTP (la recuperación de contraseña hoy simula el envío imprimiendo el enlace en la consola del servidor).
* Edición de perfil propio por el cliente (hoy la rectificación la hace el administrador).
* Baja lógica de una mascota realizada por el administrador.
* Id de la ficha existente en la respuesta de documento o email duplicado.
* Backups automáticos y disponibilidad garantizada.
* Verificación de tiempos de respuesta y prueba de usabilidad con usuarios.
* Notificación automática a los clientes afectados por una urgencia.
* Duración variable de servicios y reglas para sábados u horarios especiales.
