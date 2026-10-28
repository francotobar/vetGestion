# Decisiones

Registro de decisiones tomadas ante ambigüedades del plan (regla 2 del plan de desarrollo).

| Fecha | Tarea | Decisión |
| --- | --- | --- |
| 26/10/2026 | BE-01 | El agente no crea ni modifica `backend/.env` (instrucción explícita del usuario). Se entrega `backend/.env.example` con las variables del plan; cada integrante lo copia a `.env` con sus credenciales locales. |
| 26/10/2026 | DB-01 | `npm run db:reset` se implementa en Node (`db/reset.js`), interpretando las directivas `DELIMITER` del `schema.sql`, para no depender del CLI `mysql` ni pedir la password de forma interactiva. |
| 26/10/2026 | FE-02 | El registro **no** crea sesión: al salir bien redirige a `/login` con un aviso de éxito (el contrato de la sección 6 no define cookie en el registro; opción más simple). El login redirige según rol: `admin` → `/admin/agenda`, `cliente` → `/turnos`. |
| 27/10/2026 | FE-03 | Pantallas de mascotas construidas contra el contrato de la sección 6 antes de existir BE-05 (camelCase supuesto). Ver fila del 28/10 con el contrato real. |
| 28/10/2026 | FE-03 | Contrato real de `/mascotas` (leído en `backend/src/modules/mascotas/`): la API usa **snake_case**. `GET /mascotas` → arreglo con `id, usuario_id, nombre, especie, raza, sexo, fecha_nacimiento (YYYY-MM-DD), peso_kg (number|null), esterilizado (boolean), microchip, alergias_condiciones`. `POST /mascotas` (201) y `PUT /mascotas/:id` esperan los mismos nombres en snake_case; `peso_kg`, `microchip` y `alergias_condiciones` son opcionales (ausentes o vacíos = sin dato), `fecha_nacimiento` es obligatoria y no futura. `DELETE /mascotas/:id` = baja lógica, responde `{ mensaje }`. La conversión snake↔camel vive solo en `frontend/src/api/mascotas.js` (`aCamel`/`aSnake`); los componentes siguen usando camelCase. |
| 28/10/2026 | FE-03 | Existe `GET /mascotas/:id` en el backend, pero la ficha del cliente (`/mascotas/:id` de la sección 8) sigue buscando dentro de `GET /mascotas` para no tocar componentes en este ajuste; si el backend crece en performance, migrar a `obtener(id)`. La edad se calcula en el cliente con dayjs desde `fechaNacimiento` (RF06). |
