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
* Si el binlog de MySQL está activo, crear triggers exige el privilegio `SUPER` o la variable global `log_bin_trust_function_creators = 1`. Los triggers de inmutabilidad de `atenciones` se crean con `schema.sql` (ver `docs/inmutabilidad.md`).

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

   Variables: `PORT`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL_CA` (solo para bases remotas), `JWT_SECRET`, `FRONTEND_URL`, `HORA_INICIO`, `HORA_FIN`, `SLOT_MINUTOS`, `ANTELACION_HS`, `DIAS_MAX_RESERVA`, `TZ`, `SEED_ADMIN_PASSWORD` (opcional en local).

4. **Base de datos:** elegir una opción.

   * **Opción A (recomendada): `demo:reset`.** Crea el esquema completo y carga los datos de demostración:

     ```bash
     npm run demo:reset
     ```

   * **Opción B: `db:reset` y `seed`** (sin datos de demostración hasta ejecutar el segundo):

     ```bash
     npm run db:reset    # recrea la base con schema.sql
     npm run seed        # carga los datos de demostración
     ```

     `db:reset` **no** incluye el seed.

5. **Frontend — dependencias:** el frontend usa `VITE_API_URL` (URL del backend). En local, si no se define, usa `http://localhost:3000/api`:

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
| `backend/` | `npm run db:reset` | Elimina y recrea la base con `schema.sql` (sin datos) |
| `backend/` | `npm run seed` | Carga los datos de demostración sobre una base recién creada |
| `backend/` | `npm run demo:reset` | Borra las tablas, vuelve a aplicar `schema.sql` y carga los datos de demostración |
| `frontend/` | `npm run dev` | Interfaz en desarrollo, `http://localhost:5173` |
| `frontend/` | `npm run build` | Build de producción en `frontend/dist` |
| `frontend/` | `npm run preview` | Sirve el build localmente |

**Pruebas:** `npm test` ejecuta **20 suites y 237 pruebas** (resultado: `Test Suites: 20 passed, 20 total` / `Tests: 237 passed, 237 total`), y funciona igual en Linux y Windows.

Las suites comparten la base local, así que `npm test` las ejecuta en serie (`--runInBand`); en paralelo dos suites podrían elegir la misma franja. La zona horaria la fija `backend/tests/zona-horaria.js`.

Las pruebas se niegan a correr si `DB_SSL_CA` está definida o si `DB_HOST` no es `localhost` (guarda de `npm test`). Los scripts `db:reset`, `seed` y `demo:reset` fijan la zona horaria en el propio código, así que funcionan en Windows sin el prefijo `TZ=`.

## Actualizar una base existente (migración 001)

Una base creada antes de la revocación de sesiones no tiene la columna `usuarios.token_version`. La migración la agrega sin borrar datos:

```bash
mysql -u root -p vetgestion < backend/db/migraciones/001_token_version.sql
```

Es idempotente: si la columna ya existe, no hace nada. Sin esta columna, el backend no inicia sesiones válidas.

**Migración y `demo:reset` no son lo mismo:** la migración **conserva** los datos y solo agrega la columna; `demo:reset` **reemplaza** los datos por los de demostración.

## `demo:reset`: uso y variables

`npm run demo:reset` restablece la base de demostración:

1. Muestra host y base (nunca contraseñas) y pide escribir el nombre de la base para confirmar. Si no coincide, no hace nada.
2. Comprueba que el usuario puede crear triggers. Si no puede, se detiene **antes** de borrar nada.
3. Borra las tablas (no la base) en orden seguro, aplica `schema.sql` completo (con `token_version` y los triggers) y carga los datos de demostración.

Variables que usa:

| Variable | Obligatoria | Uso |
| --- | --- | --- |
| `DB_NAME` | Sí (debe ser `vetgestion`) | El esquema crea y usa la base `vetgestion` |
| `SEED_ADMIN_PASSWORD` | Solo con `DB_SSL_CA` | Contraseña del admin. Debe tener 6 caracteres y 2 números. Sin SSL, si no se define se usa `Admin12` |
| `DB_SSL_CA` | Solo para bases remotas | Certificado de la base (Aiven). Con SSL, `demo:reset` exige `SEED_ADMIN_PASSWORD` |

**Advertencia:** `demo:reset` borra todos los datos de la base que indica `DB_NAME`. Úsalo solo sobre una base de demostración. No lo ejecutes contra una base con datos reales sin respaldo previo.

## Cuentas de demostración (solo desarrollo)

Las crea `npm run demo:reset` o `npm run seed`. **Son datos ficticios para desarrollo y demostración: no usarlos ni publicarlos en producción.** Con `SEED_ADMIN_PASSWORD` definida, la contraseña del admin es esa; si no, la contraseña de demo local es `Admin12`.

| Rol | Documento | Contraseña |
| --- | --- | --- |
| Administrador | `00000000` | `Admin12` (o `SEED_ADMIN_PASSWORD`) |
| Cliente con cuenta (Laura Ejemplo; tiene mascotas) | `90000001` | `Demo12` |
| Cliente con cuenta (Tomás Prueba; tiene mascotas) | `90000002` | `Demo12` |
| Cliente con cuenta (Carla Demo; sin mascotas) | `90000003` | `Demo12` |
| Cliente sin cuenta (Sofía Ficticia; alta asistida) | `90000004` | — |

Los datos de demostración incluyen turnos en todos los estados, dos atenciones con una nota aclaratoria y una mascota dada de baja.

## Endpoints

Todos bajo `/api`. Rol: **P** = pública, **C** = cliente, **A** = administrador.

| Método y ruta | Rol | Descripción |
| --- | --- | --- |
| GET `/salud` | P | Salud del sistema (chequea la conexión a la base) |
| POST `/auth/registro` | P | Registro de cliente con consentimiento de datos |
| POST `/auth/login` | P | Inicio de sesión (documento + contraseña) |
| POST `/auth/logout` | C/A | Cierra sesión: revoca **todas** las sesiones del usuario (en todos los dispositivos) y borra la cookie |
| GET `/auth/me` | C/A | Usuario en sesión |
| POST `/auth/recuperar` | P | Pide el enlace de restablecimiento (envío simulado por consola) |
| POST `/auth/restablecer` | P | Restablece la contraseña con el token recibido; revoca las sesiones anteriores |
| GET `/mascotas` | C | Mascotas propias |
| POST `/mascotas` | C | Alta de mascota propia |
| GET `/mascotas/:id` | C | Ficha de la mascota (las ajenas responden 404) |
| PUT `/mascotas/:id` | C | Edita la mascota propia |
| DELETE `/mascotas/:id` | C | Baja lógica de la mascota propia; cancela sus turnos futuros pendientes o confirmados (`turnos_cancelados`) |
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
| POST `/admin/clientes/:id/baja` | A | Baja lógica de la cuenta; revoca sus sesiones |
| POST `/admin/clientes/:id/desbloquear` | A | Desbloquea; con contraseña temporal, revoca sus sesiones anteriores |
| POST `/admin/clientes/:id/anonimizar` | A | Supresión de datos personales (Ley 25.326); cancela sus turnos futuros |
| GET `/admin/clientes/:id/mascotas` | A | Mascotas activas del cliente |
| POST `/admin/clientes/:id/mascotas` | A | Alta de mascota desde la ficha del cliente |
| PUT `/admin/mascotas/:id` | A | Edita una mascota |
| DELETE `/admin/mascotas/:id` | A | Baja lógica de cualquier mascota; cancela sus turnos futuros (`turnos_cancelados`) |
| GET `/admin/mascotas/:id/historial` | A | Historial clínico de la mascota |
| POST `/admin/atenciones/:id/notas` | A | Nota aclaratoria sobre una atención |

No existen endpoints de edición ni borrado de atenciones: son inmutables (triggers en la base de datos; ver `docs/inmutabilidad.md`).

### Códigos de error relevantes

| Código | Status | Significado |
| --- | --- | --- |
| `SESION_REVOCADA` | 401 | La sesión ya no es válida (cerrada, contraseña restablecida, desbloqueo con contraseña temporal, baja o anonimización). Hay que iniciar sesión de nuevo |
| `MASCOTA_INACTIVA` | 422 | La mascota está dada de baja: no admite reservas ni reprogramaciones |
| `CONFLICTO_ESTADO` | 409 | El turno cambió mientras se operaba sobre él. No se modificó nada |
| `FRANJA_OCUPADA` | 409 | La franja ya está reservada |
| `DOCUMENTO_EXISTENTE` / `EMAIL_DUPLICADO` | 409 | Alta o edición de cliente con documento o email ya usados. En el alta asistida y la edición del administrador la respuesta incluye `id` (la ficha existente) y el nombre en el mensaje. En el registro propio responde sin `id` |
| `TRANSICION_INVALIDA` | 422 | El cambio de estado no está permitido |

## Comportamientos de sesión, bajas y conflictos

* **Cerrar sesión** invalida todas las sesiones del usuario, también en otros dispositivos. Una cookie anterior responde 401 `SESION_REVOCADA`.
* **Restablecer la contraseña** y el **desbloqueo con contraseña temporal** revocan las sesiones anteriores. El desbloqueo **sin** contraseña temporal no cambia credenciales y no revoca sesiones.
* Un usuario **bloqueado** que tiene una cookie vigente recibe 401 `SESION_REVOCADA`. Al intentar iniciar sesión recibe 423 con la explicación del bloqueo.
* La **baja de mascota** (cliente o administrador) cancela sus turnos futuros pendientes o confirmados, con el motivo "Baja de la mascota", y responde cuántos canceló. No toca turnos pasados ni de otras mascotas.
* La **baja de un cliente** revoca sus sesiones. La **anonimización** cancela sus turnos futuros con el motivo "Anonimización del cliente" y no toca atenciones.
* La **reprogramación por urgencia** también rechaza mascotas inactivas (422 `MASCOTA_INACTIVA`).
* Las **reservas y reprogramaciones** bloquean la fila de la mascota antes de validar y escribir. Una baja que confirma en paralelo no puede dejar un turno futuro activo de una mascota inactiva.
* En **carreras simultáneas** sobre un mismo turno, el perdedor recibe 409 `CONFLICTO_ESTADO` si la otra operación terminó mientras él leía el turno, o 422 `TRANSICION_INVALIDA` si terminó antes de su lectura. Una operación nunca sobrescribe una transición final ya realizada.

## Estructura del repositorio

```text
vetGestion/
├── AGENTS.md
├── README.md
├── docs/
│   ├── DECISIONES.md
│   ├── especificacion_proyecto_veterinario.md
│   ├── inmutabilidad.md
│   ├── plan_desarrollo_mvp_vetgestion.md
│   └── proyecto_vetgestion_documento_de_apuntes_y_especificacion.md
├── backend/
│   ├── db/
│   │   ├── schema.sql          # esquema completo (tablas, triggers de atenciones)
│   │   ├── migraciones/        # 001_token_version.sql (para bases existentes)
│   │   ├── reset.js            # db:reset
│   │   ├── seed.js             # seed (guarda: no siembra bases con SSL)
│   │   ├── datos-demo.js       # datos de demostración (usados por seed y demo:reset)
│   │   └── demo-reset.js       # demo:reset
│   ├── src/
│   │   ├── app.js, server.js
│   │   ├── config/             # env.js, db.js, ssl.js
│   │   ├── middlewares/        # auth, roles, validar, errores
│   │   ├── modules/            # auth, clientes, mascotas, servicios, feriados, turnos, atenciones
│   │   └── utils/              # fechas, password, errores
│   ├── tests/                  # suites Jest + Supertest
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── api/                # cliente axios y un archivo por módulo
    │   ├── context/            # AuthContext
    │   ├── components/         # Layout, NavBar, RutaProtegida, Campo, Modal, EstadoBadge, SelectorFranja, ...
    │   ├── pages/              # publicas/, cliente/, admin/
    │   └── App.jsx, main.jsx, styles.css
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
* Id de la ficha existente en la respuesta del registro propio ante un documento o email duplicado (el alta asistida del administrador ya lo incluye).
* Backups automáticos y disponibilidad garantizada.
* Verificación de tiempos de respuesta y prueba de usabilidad con usuarios.
* Notificación automática a los clientes afectados por una urgencia.
* Duración variable de servicios y reglas para sábados u horarios especiales.
* Triggers de inmutabilidad también para `notas_atencion` (hoy solo protegen `atenciones`; ver `docs/inmutabilidad.md`).
* Usuario de base con privilegios mínimos para la aplicación (hoy tiene `ALL PRIVILEGES` sobre la base; ver `docs/inmutabilidad.md`).
