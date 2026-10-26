# Plan de Desarrollo MVP — vetGestión

> Documento para un agente de desarrollo. Ejecutar en orden, una tarea por vez. Fuente de verdad funcional: `especificacion_proyecto_veterinario.md`. Si hay contradicción, manda la especificación.

---

## 0. Reglas para el agente

1. **Plazo:** entrega inamovible el viernes 30/10/2026. Hoy es lunes 26/10. Prioridad estricta: **P0 → P1**. Nada de P2.
2. **No agregar funcionalidades** que no estén en este plan. Ante una ambigüedad, elegir la opción más simple y anotarla en `docs/DECISIONES.md`.
3. **Una tarea por vez.** Al terminar cada tarea: correr los tests existentes, verificar sus criterios de aceptación y hacer commit con el ID de la tarea (`feat(BE-05): ...`).
4. **Capas:** rutas → controlador → servicio → base de datos. Las reglas de negocio viven **solo** en `service`. El frontend nunca decide reglas de negocio; solo las refleja.
5. **Seguridad mínima obligatoria:** consultas parametrizadas (nunca concatenar SQL), hash bcrypt, autorización por rol en el servidor, validación de entrada con `zod`.
6. **Idioma:** nombres de dominio, tablas y mensajes de error en español. Código en `camelCase`; columnas en `snake_case`.
7. **Formato de error de la API:** `{ "codigo": "FRANJA_OCUPADA", "mensaje": "La franja ya fue reservada" }` con el status HTTP correcto (400 validación, 401 sin sesión, 403 sin permiso, 404 no existe, 409 conflicto, 422 regla de negocio, 423 cuenta bloqueada).
8. **Fechas:** ejecutar Node con `TZ=America/Argentina/Buenos_Aires`. Guardar `DATETIME` locales (sin zona). Conexión mysql2 con `dateStrings: true`. Formato de intercambio: `fecha` = `YYYY-MM-DD`, `hora` = `HH:mm`.

---

## 1. Decisiones cerradas y supuestos

| Tema | Decisión |
| --- | --- |
| Roles | `admin` y `cliente`. El profesional no usa el sistema. |
| Agenda | Única. Un turno por franja de 30 min, de 09:00 a 18:30 (termina 19:00). |
| Días | Lunes a viernes, salvo feriados cargados. |
| Servicios | Todos ocupan **una** franja (sin duración propia). |
| Login | `documento` + contraseña. Email opcional (único si existe). |
| Contraseña | ≥ 6 caracteres y ≥ 2 dígitos. |
| Bloqueo | 5 intentos fallidos → `bloqueado=1`. Desbloqueo por admin (P0) o por email (P1). |
| Reglas de turno | Reserva: franja futura, hasta 60 días adelante. Cancelar/reprogramar por el cliente: ≥ 24 h de antelación (`ANTELACION_HS`). |
| Estados | `pendiente → confirmado → atendido/ausente`; `pendiente/confirmado → cancelado`. |
| Franja ocupada | Todo estado salvo `cancelado`. |
| Turno por admin | Nace `confirmado`. Turno por cliente web nace `pendiente`. |
| Reprogramación | Cliente: el turno vuelve a `pendiente`. Admin: conserva el estado. |
| Historial (P1) | Lo carga el admin; el cliente ve todo, solo lectura; inmutable + notas aclaratorias. |
| Reclamo de ficha | Si el cliente se registra con un documento existente `sin_cuenta` **y el teléfono coincide**, se vincula la ficha. Si no coincide: 409 "Contactá a la veterinaria". |
| Auditoría | `creado_por`, `modificado_por` y marcas de tiempo. |
| Despliegue | Ninguno. Todo corre local. |

---

## 2. Stack y librerías

* **Backend:** Node 20, Express 4, `mysql2/promise`, `bcryptjs`, `jsonwebtoken`, `cookie-parser`, `cors`, `helmet`, `express-rate-limit`, `zod`, `dayjs`, `dotenv`. Dev: `nodemon`, `jest`, `supertest`.
* **Frontend:** React + Vite, `react-router-dom`, `axios`, `dayjs`. CSS propio simple y responsive (sin librerías de UI).
* **BD:** MySQL 8.
* **Sesión:** JWT (8 h) en cookie `httpOnly`, `SameSite=Lax`. CORS con `credentials: true` solo para el origen del frontend.

### Variables de entorno (`backend/.env.example`)
```
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=vetgestion
JWT_SECRET=cambiar_esto
FRONTEND_URL=http://localhost:5173
HORA_INICIO=09:00
HORA_FIN=19:00
SLOT_MINUTOS=30
ANTELACION_HS=24
DIAS_MAX_RESERVA=60
TZ=America/Argentina/Buenos_Aires
```

---

## 3. Estructura del repositorio

```
vetgestion/
├─ README.md
├─ docs/DECISIONES.md
├─ backend/
│  ├─ db/ schema.sql  seed.js
│  ├─ src/
│  │  ├─ app.js  server.js
│  │  ├─ config/ env.js  db.js
│  │  ├─ middlewares/ auth.js  roles.js  validar.js  errores.js
│  │  ├─ utils/ fechas.js  password.js  errores.js
│  │  └─ modules/
│  │     ├─ auth/        (routes, controller, service, schema)
│  │     ├─ clientes/    (admin)
│  │     ├─ mascotas/
│  │     ├─ servicios/
│  │     ├─ feriados/
│  │     ├─ turnos/
│  │     └─ atenciones/  (P1)
│  └─ tests/
└─ frontend/
   └─ src/
      ├─ api/ cliente.js (axios) y un archivo por módulo
      ├─ context/ AuthContext.jsx
      ├─ components/ Layout, NavBar, RutaProtegida, Campo, Modal, EstadoBadge, SelectorFranja
      └─ pages/ publicas/  cliente/  admin/
```

---

## 4. Base de datos (`backend/db/schema.sql`)

```sql
CREATE DATABASE IF NOT EXISTS vetgestion CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE vetgestion;

CREATE TABLE usuarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rol ENUM('admin','cliente') NOT NULL DEFAULT 'cliente',
  documento VARCHAR(20) NOT NULL,
  nombre VARCHAR(60) NOT NULL,
  apellido VARCHAR(60) NOT NULL,
  telefono VARCHAR(30) NOT NULL,
  email VARCHAR(120) NULL,
  password_hash VARCHAR(100) NULL,
  estado_cuenta ENUM('sin_cuenta','con_cuenta','inactiva') NOT NULL DEFAULT 'sin_cuenta',
  intentos_fallidos TINYINT UNSIGNED NOT NULL DEFAULT 0,
  bloqueado TINYINT(1) NOT NULL DEFAULT 0,
  consentimiento_at DATETIME NULL,
  reset_token_hash CHAR(64) NULL,
  reset_expira DATETIME NULL,
  creado_por INT UNSIGNED NULL,
  modificado_por INT UNSIGNED NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modificado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_usuarios_documento (documento),
  UNIQUE KEY uq_usuarios_email (email),            -- MySQL permite múltiples NULL
  CONSTRAINT fk_usr_creado FOREIGN KEY (creado_por) REFERENCES usuarios(id),
  CONSTRAINT fk_usr_modificado FOREIGN KEY (modificado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE mascotas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT UNSIGNED NOT NULL,
  nombre VARCHAR(60) NOT NULL,
  especie ENUM('perro','gato') NOT NULL,
  raza VARCHAR(60) NOT NULL,
  sexo ENUM('macho','hembra') NOT NULL,
  fecha_nacimiento DATE NOT NULL,
  peso_kg DECIMAL(5,2) NULL,
  esterilizado TINYINT(1) NOT NULL DEFAULT 0,
  microchip VARCHAR(30) NULL,
  alergias_condiciones TEXT NULL,
  activa TINYINT(1) NOT NULL DEFAULT 1,
  creado_por INT UNSIGNED NULL,
  modificado_por INT UNSIGNED NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modificado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_mascotas_usuario (usuario_id),
  CONSTRAINT fk_masc_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_masc_creado FOREIGN KEY (creado_por) REFERENCES usuarios(id),
  CONSTRAINT fk_masc_modificado FOREIGN KEY (modificado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE servicios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  descripcion VARCHAR(255) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_servicios_nombre (nombre)
) ENGINE=InnoDB;

CREATE TABLE feriados (
  fecha DATE PRIMARY KEY,
  motivo VARCHAR(120) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE turnos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT UNSIGNED NOT NULL,
  mascota_id INT UNSIGNED NOT NULL,
  servicio_id INT UNSIGNED NOT NULL,
  fecha_hora DATETIME NOT NULL,
  estado ENUM('pendiente','confirmado','cancelado','atendido','ausente') NOT NULL DEFAULT 'pendiente',
  canal ENUM('web','telefonico','presencial') NOT NULL,
  es_urgencia TINYINT(1) NOT NULL DEFAULT 0,
  motivo VARCHAR(255) NULL,                         -- motivo de cancelación/urgencia
  creado_por INT UNSIGNED NOT NULL,
  modificado_por INT UNSIGNED NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modificado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- Columna generada: NULL cuando está cancelado → libera la franja
  fecha_hora_activa DATETIME GENERATED ALWAYS AS (IF(estado = 'cancelado', NULL, fecha_hora)) STORED,
  UNIQUE KEY uq_turnos_franja_activa (fecha_hora_activa),   -- ¡CLAVE para RF09!
  KEY idx_turnos_fecha (fecha_hora),
  KEY idx_turnos_usuario (usuario_id),
  CONSTRAINT fk_tur_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_tur_mascota FOREIGN KEY (mascota_id) REFERENCES mascotas(id),
  CONSTRAINT fk_tur_servicio FOREIGN KEY (servicio_id) REFERENCES servicios(id),
  CONSTRAINT fk_tur_creado FOREIGN KEY (creado_por) REFERENCES usuarios(id),
  CONSTRAINT fk_tur_modificado FOREIGN KEY (modificado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- P1: historial clínico
CREATE TABLE atenciones (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  turno_id INT UNSIGNED NOT NULL,
  mascota_id INT UNSIGNED NOT NULL,
  profesional_nombre VARCHAR(100) NOT NULL,         -- texto libre; el profesional no es usuario
  anamnesis TEXT NULL,
  diagnostico TEXT NULL,
  tratamiento TEXT NULL,
  medicacion TEXT NULL,
  vacunas TEXT NULL,
  observaciones TEXT NULL,
  creado_por INT UNSIGNED NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_atenciones_turno (turno_id),
  KEY idx_atenciones_mascota (mascota_id),
  CONSTRAINT fk_at_turno FOREIGN KEY (turno_id) REFERENCES turnos(id),
  CONSTRAINT fk_at_mascota FOREIGN KEY (mascota_id) REFERENCES mascotas(id),
  CONSTRAINT fk_at_creado FOREIGN KEY (creado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE notas_atencion (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  atencion_id INT UNSIGNED NOT NULL,
  texto TEXT NOT NULL,
  creado_por INT UNSIGNED NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notas_atencion (atencion_id),
  CONSTRAINT fk_nota_atencion FOREIGN KEY (atencion_id) REFERENCES atenciones(id),
  CONSTRAINT fk_nota_creado FOREIGN KEY (creado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- Inmutabilidad de atenciones (RF26). Ejecutar con el cliente mysql (usa DELIMITER).
DELIMITER $$
CREATE TRIGGER atenciones_no_update BEFORE UPDATE ON atenciones FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las atenciones son inmutables'; END$$
CREATE TRIGGER atenciones_no_delete BEFORE DELETE ON atenciones FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las atenciones no se eliminan'; END$$
DELIMITER ;
```

**Notas de diseño**
* Nunca hay `DELETE` físico de usuarios, mascotas o turnos: baja lógica (`activa`, `estado_cuenta`, `estado='cancelado'`).
* Cancelar un turno pone `fecha_hora_activa` en `NULL` y libera la franja automáticamente.
* Comando de respaldo (documentar en el README): `mysqldump -u root -p vetgestion > backup.sql`.

### Seed (`backend/db/seed.js`, se ejecuta con `npm run seed`)
El script debe hashear contraseñas con bcrypt (no usar hashes escritos a mano):
* Admin: documento `00000000`, contraseña `Admin12`, `rol='admin'`, `estado_cuenta='con_cuenta'`.
* Servicios: Consulta general, Vacunación, Control de peso, Desparasitación, Castración (consulta).
* Feriados de ejemplo: `2026-12-08` (Inmaculada Concepción), `2026-12-25` (Navidad). *Verificar contra el calendario oficial antes de la presentación.*
* Demo: 2 clientes con cuenta (contraseña `Demo12`), 1 cliente `sin_cuenta` sin email, 3 mascotas, y algunos turnos de ejemplo (incluyendo pasados en estado `atendido`, insertados directamente por SQL).

---

## 5. Reglas de negocio centrales

### `utils/fechas.js` (funciones puras, con tests unitarios)
* `generarFranjas()` → `['09:00','09:30', …, '18:30']` (20 franjas) según `.env`.
* `esDiaLaborable(fecha)` → lunes a viernes.
* `validarFranja(fecha, hora, { feriados, ahora, diasMax })` → lanza error `FRANJA_INVALIDA` (422) si: formato inválido, `hora` no está en `generarFranjas()`, no es día laborable, es feriado, está en el pasado, o supera `DIAS_MAX_RESERVA`.
* `horasHasta(fechaHora, ahora)` → horas de diferencia (para antelación).

### `turnos.service.js`

**`disponibilidad(fecha)`**
1. Si la fecha no es laborable o es feriado → `[]`.
2. `SELECT TIME(fecha_hora) hora FROM turnos WHERE fecha_hora >= ? AND fecha_hora < ? AND estado <> 'cancelado'` (rango del día).
3. Devolver `generarFranjas()` menos las ocupadas y menos las ya pasadas (si es hoy).

**`crearComoCliente(usuarioId, { mascotaId, servicioId, fecha, hora })`**
1. La mascota pertenece al usuario y está activa; si no → 404.
2. El servicio existe y está activo.
3. `validarFranja(...)`.
4. `INSERT` con `estado='pendiente'`, `canal='web'`, `creado_por=usuarioId`.
5. Si MySQL lanza `ER_DUP_ENTRY` → **409 `FRANJA_OCUPADA`**. *No* hacer "SELECT y luego INSERT" como único control: la restricción única de la BD es la garantía.

**`crearComoAdmin(adminId, { usuarioId, mascotaId, servicioId, fecha, hora, canal })`**
Igual que el anterior, pero: `canal ∈ {telefonico, presencial}`, `estado='confirmado'`, la mascota debe pertenecer al `usuarioId` indicado y se permite una franja desde la franja actual en adelante.

**`cancelarComoCliente(usuarioId, turnoId)`**
* Solo turnos propios en `pendiente` o `confirmado`.
* Si `horasHasta(fecha_hora) < ANTELACION_HS` → 422 `ANTELACION_INSUFICIENTE`.
* `UPDATE estado='cancelado', modificado_por=usuarioId`.

**`reprogramarComoCliente(usuarioId, turnoId, { fecha, hora })`**
* Mismas validaciones de propiedad, estado y antelación (sobre el turno actual).
* `validarFranja(nueva)`; `UPDATE fecha_hora=?, estado='pendiente'`; capturar `ER_DUP_ENTRY` → 409.
* Se hace con un único `UPDATE` (atómico).

**`cambiarEstado(adminId, turnoId, nuevoEstado)`** (admin)
Mapa de transiciones válidas; cualquier otra → 422 `TRANSICION_INVALIDA`:
```js
const TRANSICIONES = {
  pendiente:  ['confirmado', 'cancelado'],
  confirmado: ['atendido', 'ausente', 'cancelado'],
  atendido: [], ausente: [], cancelado: []
};
```

**`urgencia(adminId, turnoId, { accion, motivo, fecha?, hora? })`** (admin)
* Sin antelación mínima. `motivo` obligatorio.
* `accion='cancelar'` → estado `cancelado`. `accion='reprogramar'` → nueva franja validada (mismas reglas, 409 si ocupada).
* Siempre `es_urgencia=1` y guarda el motivo.
* Responde `{ turno, cliente: { nombre, apellido, telefono, email } }` para que el admin avise manualmente.

**`reprogramarComoAdmin(adminId, turnoId, { fecha, hora })`** — igual que el del cliente, sin antelación mínima y conservando el estado.

### `auth.service.js`
* **Registro:** validar con zod (documento, nombre, apellido, teléfono, contraseña, `consentimiento === true`; email opcional). Regla de contraseña: `/^(?=(?:.*\d){2,}).{6,}$/`.
  * Si el documento existe con `sin_cuenta` **y el teléfono coincide** → vincular: setear `password_hash`, email (si viene y no está usado), `consentimiento_at`, `estado_cuenta='con_cuenta'`.
  * Si existe con otro estado, o el teléfono no coincide → 409.
  * Email ya usado → 409 `EMAIL_DUPLICADO`.
* **Login:** buscar por documento. Si no existe, o `estado_cuenta != 'con_cuenta'` → 401 genérico ("Documento o contraseña incorrectos"). Si `bloqueado=1` → 423 `CUENTA_BLOQUEADA` (con un mensaje distinto si tiene email o no). Contraseña incorrecta → `intentos_fallidos+1`; al llegar a 5 → `bloqueado=1`. Éxito → `intentos_fallidos=0` y emitir cookie JWT con `{ id, rol }`.
* **Desbloqueo por admin:** `bloqueado=0`, `intentos_fallidos=0` y nueva contraseña temporal opcional.
* **Recuperación por email (P1):** ver tarea BE-16.

---

## 6. API REST

Todas bajo `/api`. Rol: **P** = pública, **C** = cliente, **A** = admin.

| Método y ruta | Rol | Descripción | Prio |
| --- | --- | --- | --- |
| POST `/auth/registro` | P | Registro de cliente (RF01a) | P0 |
| POST `/auth/login` | P | Login | P0 |
| POST `/auth/logout` | C/A | Cierra sesión (borra cookie) | P0 |
| GET `/auth/me` | C/A | Usuario actual | P0 |
| POST `/auth/recuperar` | P | Pide desbloqueo/restablecimiento por email | P1 |
| POST `/auth/restablecer` | P | `{ token, password }` | P1 |
| GET/POST/PUT/DELETE `/mascotas` | C | CRUD de mascotas propias (DELETE = baja lógica) | P0 |
| GET `/mascotas/:id/historial` | C | Historial completo, solo propias | P1 |
| GET `/servicios` | C/A | Servicios activos | P0 |
| GET `/feriados` | C/A | Lista de feriados | P0 |
| GET `/turnos/disponibilidad?fecha=` | C/A | Franjas libres del día | P0 |
| POST `/turnos` | C | Reservar | P0 |
| GET `/turnos/mios` | C | Mis turnos con estado | P0 |
| PATCH `/turnos/:id/cancelar` | C | Cancelar | P0 |
| PATCH `/turnos/:id/reprogramar` | C | Reprogramar | P0 |
| GET `/admin/turnos?desde=&hasta=&estado=` | A | Agenda (día/semana) con cliente, mascota y servicio | P0 |
| POST `/admin/turnos` | A | Turno manual | P0 |
| PATCH `/admin/turnos/:id/estado` | A | Confirmar/atendido/ausente/cancelado | P0 |
| PATCH `/admin/turnos/:id/reprogramar` | A | Reprogramar | P0 |
| POST `/admin/turnos/:id/urgencia` | A | Cancelar/reprogramar por urgencia | P0 |
| GET `/admin/clientes?q=` | A | Buscar por nombre, documento o email | P0 |
| POST `/admin/clientes` | A | Alta asistida (RF01b, RF24) | P0 |
| GET/PUT `/admin/clientes/:id` | A | Ver/editar cliente | P0 |
| POST `/admin/clientes/:id/desbloquear` | A | Desbloquea y fija contraseña temporal | P0 |
| POST `/admin/clientes/:id/baja` | A | Pasa a `inactiva` | P0 |
| POST `/admin/clientes/:id/anonimizar` | A | Supresión (RNF04) | P1 |
| GET/POST `/admin/clientes/:id/mascotas` | A | Mascotas del cliente | P0 |
| PUT `/admin/mascotas/:id` | A | Editar mascota | P0 |
| GET/POST/PUT `/admin/servicios` | A | Catálogo de servicios (activar/desactivar) | P0 |
| POST/DELETE `/admin/feriados` | A | Alta/baja de feriados | P0 |
| POST `/admin/turnos/:id/atencion` | A | Cargar atención (turno `atendido`) | P1 |
| GET `/admin/mascotas/:id/historial` | A | Historial completo | P1 |
| POST `/admin/atenciones/:id/notas` | A | Nota aclaratoria | P1 |

*No existen endpoints PUT/DELETE de atenciones.*

**Autorización:** `auth.js` valida la cookie y carga `req.usuario`; `roles('admin')` / `roles('cliente')` protegen cada router. Los endpoints de cliente filtran **siempre** por `req.usuario.id` (un recurso ajeno responde 404, no 403, para no filtrar información).

---

## 7. Plan por días y tareas

Reparto sugerido: **Franco → backend/BD**, **Gisella → frontend**. Cada día se integra en `main` antes de cerrar. Los IDs sirven como tarjetas de Trello.

### Día 1 — Lunes 26/10: Base, autenticación y contrato de API

**BE-01 [Franco, P0] Setup backend.** Proyecto Node/Express, `.env`, `helmet`, `cors`, `cookie-parser`, manejador de errores central, conexión `mysql2` (`dateStrings:true`, pool), `GET /api/salud`.
*Aceptación:* **Dado** el servidor levantado, **cuando** se llama `/api/salud`, **entonces** responde `{ok:true}` y la BD conecta.

**DB-01 [Franco, P0] Esquema y seed.** Crear `schema.sql` (sección 4) y `seed.js`. Scripts `npm run db:reset` y `npm run seed`.
*Aceptación:* tras ejecutarlos existen todas las tablas, el admin, los servicios y los datos demo.

**BE-02 [Franco, P0] Utilidades de fechas + tests.** `generarFranjas`, `esDiaLaborable`, `validarFranja`, `horasHasta`.
*Aceptación (unit tests):* 20 franjas; sábado inválido; feriado inválido; 09:15 inválido; 19:00 inválido; fecha pasada inválida; hoy+61 días inválido.

**BE-03 [Franco, P0] Auth: registro, login, logout, me.** Según sección 5. Middleware `auth` y `roles`.
*Aceptación:*
* **Dado** documento existente `sin_cuenta` con mismo teléfono, **cuando** se registra, **entonces** se vincula la ficha sin crear duplicado.
* **Dado** 5 logins fallidos, **cuando** intenta el sexto con contraseña correcta, **entonces** responde 423.
* **Dado** una contraseña `abc12` o `abcdef1`, **cuando** se registra, **entonces** 400.
* **Dado** un email repetido, **entonces** 409.

**BE-04 [Franco, P0] Test de autorización.** Un cliente no puede llamar a `/admin/*` (403) ni ver mascotas ajenas (404).

**FE-01 [Gisella, P0] Setup frontend.** Vite + React + router. `api/cliente.js` (axios con `withCredentials`), `AuthContext` (usuario, login, logout, cargar `/auth/me` al iniciar), `RutaProtegida({roles})`, `Layout` y `NavBar` por rol, estilos base responsive.

**FE-02 [Gisella, P0] Pantallas Login y Registro.** Validaciones en el cliente (contraseña, campos obligatorios, checkbox de consentimiento con el texto de la Ley 25.326) y mensajes de error de la API (409, 423). Redirección según rol tras el login.
*Aceptación:* **Dado** un login correcto de admin, **entonces** va a `/admin/agenda`; de cliente, a `/turnos`.

**Cierre del día:** login/registro/logout funcionando de punta a punta. Contrato de API (sección 6) acordado y no se cambia sin avisar al otro integrante.

---

### Día 2 — Martes 27/10: Mascotas, catálogo, feriados y disponibilidad

**BE-05 [Franco, P0] Mascotas (cliente).** CRUD propio con validación (especie `perro|gato`, sexo, fecha de nacimiento no futura, peso > 0).
*Aceptación:* **Dado** el cliente A, **cuando** pide una mascota del cliente B, **entonces** 404.

**BE-06 [Franco, P0] Servicios y feriados.** `GET /servicios` (activos), admin ABM de servicios (alta, edición, activar/desactivar), `GET/POST/DELETE` de feriados.
*Aceptación:* un servicio inactivo no aparece para el cliente ni se puede reservar.

**BE-07 [Franco, P0] Disponibilidad.** `GET /turnos/disponibilidad?fecha=`.
*Aceptación:* un feriado, un sábado o una fecha pasada devuelven `[]`; una franja con turno `pendiente` no aparece; si ese turno se cancela, vuelve a aparecer.

**BE-08 [Franco, P0] Crear turno (cliente) + test de concurrencia.**
*Aceptación (test automatizado):* **Dado** una franja libre, **cuando** dos usuarios envían `POST /turnos` **simultáneamente** (`Promise.all`), **entonces** exactamente uno recibe 201 y el otro 409 `FRANJA_OCUPADA`, y existe un solo turno en esa franja.

**FE-03 [Gisella, P0] Mis mascotas.** Lista, alta, edición y baja con formulario completo (RF06). Cuenta con estado vacío.

**FE-04 [Gisella, P0] Reserva de turno (asistente de 4 pasos).** Mascota → Servicio → Fecha (deshabilitando fines de semana y feriados) → Franja (botones con `disponibilidad`) → Confirmar. Maneja 409 mostrando "Esa franja acaba de ser reservada, elegí otra" y recarga las franjas.
*Aceptación:* **Dado** un cliente con una mascota, **cuando** completa el asistente, **entonces** ve el turno en "Mis turnos" como *pendiente*.

**Cierre del día:** un cliente puede registrarse, cargar mascotas y reservar un turno.

---

### Día 3 — Miércoles 28/10: Ciclo completo de turnos y agenda del administrador

**BE-09 [Franco, P0] Mis turnos, cancelar y reprogramar (cliente).** Según sección 5.
*Aceptación:* **Dado** un turno dentro de las próximas 24 h, **cuando** el cliente intenta cancelar, **entonces** 422 `ANTELACION_INSUFICIENTE`. **Dado** un turno a 48 h, **cuando** reprograma a una franja ocupada, **entonces** 409 y el turno original queda intacto.

**BE-10 [Franco, P0] Agenda admin y turno manual.** `GET /admin/turnos` (con joins a cliente, mascota y servicio; filtros por rango y estado) y `POST /admin/turnos`.
*Aceptación:* un turno manual telefónico queda `confirmado`, con `canal='telefonico'` y `creado_por` = admin.

**BE-11 [Franco, P0] Estados, reprogramación admin y urgencias.** `cambiarEstado` con el mapa de transiciones, `reprogramarComoAdmin`, `urgencia`.
*Aceptación:* **Dado** un turno `atendido`, **cuando** se intenta cancelar, **entonces** 422. **Dado** una urgencia con acción cancelar, **entonces** el turno queda `cancelado` con `es_urgencia=1`, el motivo guardado, y la respuesta incluye el teléfono del cliente.

**FE-05 [Gisella, P0] Mis turnos (cliente).** Lista con estado (`EstadoBadge`), botones Cancelar y Reprogramar (reutiliza `SelectorFranja`), con confirmación y mensajes de error de antelación.

**FE-06 [Gisella, P0] Agenda del administrador.** Vista por día con las 20 franjas (libres y ocupadas) y vista semanal. Cada turno muestra cliente, mascota, servicio, canal y estado. Acciones: confirmar, cancelar, reprogramar, atendido, ausente y botón **Urgencia** (modal con motivo; al terminar muestra el contacto del cliente afectado). Franja libre → "Cargar turno".

**FE-07 [Gisella, P0] Turno manual (admin).** Buscar cliente por documento/nombre → seleccionar mascota → servicio → fecha/franja → canal. Si el cliente no existe, botón "Crear cliente" (ver FE-08).

**Cierre del día:** el flujo completo de turnos funciona en ambos roles. **Es el hito más importante del proyecto.**

---

### Día 4 — Jueves 29/10: Clientes, historial clínico, desbloqueo y privacidad (congelamiento de funcionalidades al cierre)

**BE-12 [Franco, P0] Clientes (admin).** Búsqueda, alta asistida (RF01b; obligatorios nombre, apellido, documento, teléfono), edición, baja, y alta/edición de mascotas del cliente. Documento o email duplicado → 409 con el id de la ficha existente (RF24).
*Aceptación:* **Dado** un documento existente, **cuando** el admin intenta crearlo de nuevo, **entonces** 409 y el mensaje incluye el nombre del cliente existente.

**BE-13 [Franco, P0] Desbloqueo por admin.** `POST /admin/clientes/:id/desbloquear`.
*Aceptación:* **Dado** un cliente bloqueado sin email, **cuando** el admin lo desbloquea con contraseña temporal, **entonces** el cliente puede ingresar con ella.

**BE-14 [Franco, P1] Atenciones e historial.** `POST /admin/turnos/:id/atencion` (solo si el turno está `atendido` y no tiene atención), `GET` de historial para admin y cliente (con notas), `POST` de notas aclaratorias.
*Aceptación:* **Dado** una atención guardada, **cuando** se intenta modificarla por SQL, **entonces** el trigger lo rechaza. **Dado** el cliente A, **cuando** pide el historial de una mascota ajena, **entonces** 404.

**BE-15 [Franco, P1] Anonimización.** `POST /admin/clientes/:id/anonimizar`: reemplaza nombre → "Anonimizado", apellido → "", documento → `ANON-<id>`, teléfono → "-", email y contraseña → `NULL`, `estado_cuenta='inactiva'`, mascotas `activa=0`, cancela sus turnos futuros. No toca `atenciones`.

**BE-16 [Franco, P1] Recuperación por email.** `POST /auth/recuperar {email}`: si existe un usuario con ese email, genera token aleatorio, guarda solo su hash (SHA-256) con vencimiento de 1 h y **simula el envío imprimiendo el enlace por consola** (sin SMTP). `POST /auth/restablecer {token, password}`: valida token y regla de contraseña, setea la nueva, `bloqueado=0`, `intentos_fallidos=0`. Responde siempre lo mismo exista o no el email.
*Aceptación:* **Dado** una cuenta bloqueada con email, **cuando** completa el flujo, **entonces** puede iniciar sesión.

**FE-08 [Gisella, P0] Clientes (admin).** Listado con buscador y estado de cuenta (con cuenta / sin cuenta / inactiva), formulario de alta asistida, ficha del cliente con sus mascotas, sus turnos y el botón **Desbloquear**. Muestra el aviso de duplicado devuelto por la API.

**FE-09 [Gisella, P0] Servicios y feriados (admin).** Dos pantallas simples de ABM.

**FE-10 [Gisella, P1] Historial clínico.** Cliente: ficha de la mascota con el historial en orden cronológico inverso y el texto "Sin atenciones" cuando está vacío. Admin: botón "Registrar atención" en turnos *atendidos*, formulario de atención y alta de notas aclaratorias.

**FE-11 [Gisella, P1] Recuperar contraseña** (`/recuperar`, `/restablecer`) y botón **Anonimizar** (con confirmación) en la ficha del cliente.

**Cierre del día (noche): CONGELAMIENTO.** A partir de aquí no se agregan funcionalidades. Lo que no esté terminado se descarta o se documenta como trabajo futuro.

---

### Día 5 — Viernes 30/10: Verificación, datos de demostración y entrega

**QA-01 [Ambos, P0] Checklist manual de aceptación:**
- [ ] Registro con documento nuevo; registro vinculando una ficha `sin_cuenta`.
- [ ] Contraseñas inválidas rechazadas; 5 intentos fallidos bloquean; el admin desbloquea.
- [ ] Cliente: alta de mascota, reserva, cancelación (≥ 24 h) y rechazo (< 24 h), reprogramación.
- [ ] Dos navegadores reservando la misma franja: solo uno lo logra.
- [ ] Admin: confirmar, turno telefónico, cambio de estado, urgencia con aviso de contacto.
- [ ] No se ofrecen franjas en feriados, fines de semana, pasado ni fuera de 09:00–19:00.
- [ ] Un cliente no accede a `/admin/*` ni a mascotas ajenas (probar editando la URL).
- [ ] (P1) Atención → nota aclaratoria → el cliente ve el historial; mascota sin registros muestra "Sin atenciones".
- [ ] Responsive en móvil (ancho 375 px) para login, reserva y mis turnos.

**QA-02 [Franco, P0] Tests automatizados:** `npm test` en verde (fechas, auth, autorización, concurrencia, antelación, transiciones).

**DOC-01 [Gisella, P0] README:** requisitos (Node 20, MySQL 8), pasos de instalación (`schema.sql`, `npm run seed`, `npm run dev` en ambos proyectos), credenciales de demo, tabla de endpoints, comando de respaldo y lista de trabajo futuro.

**DOC-02 [Ambos, P0] Guion de demostración (10 minutos):** (1) el problema de la sala de espera, (2) cliente se registra y reserva, (3) admin confirma y carga un turno telefónico, (4) conflicto de concurrencia, (5) urgencia, (6) historial clínico (si está hecho), (7) trabajo futuro.

**Cierre:** `main` etiquetado como `v1.0-entrega`, base de datos reseteada con seed de demo y ensayo de la presentación.

---

## 8. Estructura de pantallas y rutas (frontend)

| Ruta | Rol | Pantalla |
| --- | --- | --- |
| `/login`, `/registro` | P | Acceso y alta |
| `/recuperar`, `/restablecer` | P | (P1) |
| `/mascotas`, `/mascotas/nueva`, `/mascotas/:id` | C | Mis mascotas, ficha e historial |
| `/turnos`, `/turnos/nuevo` | C | Mis turnos y asistente de reserva |
| `/admin/agenda` | A | Agenda por día/semana |
| `/admin/turnos/nuevo` | A | Turno manual |
| `/admin/clientes`, `/admin/clientes/nuevo`, `/admin/clientes/:id` | A | Gestión de clientes |
| `/admin/servicios`, `/admin/feriados` | A | Configuración |

Componentes compartidos: `SelectorFranja` (usado por reserva, reprogramación y turno manual), `EstadoBadge` (colores por estado), `Modal` de confirmación, `Campo` (input con etiqueta y error).

---

## 9. Fuera del MVP (documentar como trabajo futuro)

Recordatorios por email 24 h antes (RF13), HTTPS/TLS y despliegue, backups automáticos, disponibilidad del 99 %, rol Profesional con agenda propia, notificación automática a clientes afectados por urgencias, duración variable por servicio, y reglas para sábados/horarios especiales.

## 10. Plan de contingencia si el tiempo no alcanza

1. Fin del día 3: si el flujo de turnos (BE-09 a FE-07) no está completo, **suspender el trabajo de P1** y dedicar el día 4 a completar y probar el P0.
2. Prioridad de recorte, de menor a mayor impacto: FE-11 → BE-15 → BE-16 → FE-10/BE-14 → vista semanal de la agenda.
3. **Nunca recortar:** control de concurrencia, autorización por rol, hash de contraseñas ni el bloqueo por intentos.
