# Decisiones

Registro de decisiones tomadas ante ambigüedades del plan (regla 2 del plan de desarrollo).

| Fecha | Tarea | Decisión |
| --- | --- | --- |
| 26/10/2026 | BE-01 | El agente no crea ni modifica `backend/.env` (instrucción explícita del usuario). Se entrega `backend/.env.example` con las variables del plan; cada integrante lo copia a `.env` con sus credenciales locales. |
| 26/10/2026 | DB-01 | `npm run db:reset` se implementa en Node (`db/reset.js`), interpretando las directivas `DELIMITER` del `schema.sql`, para no depender del CLI `mysql` ni pedir la password de forma interactiva. |
| 26/10/2026 | FE-02 | El registro **no** crea sesión: al salir bien redirige a `/login` con un aviso de éxito (el contrato de la sección 6 no define cookie en el registro; opción más simple). El login redirige según rol: `admin` → `/admin/agenda`, `cliente` → `/turnos`. |
| 27/10/2026 | FE-03 | Contrato asumido para `/mascotas` (BE-05 aún no existe): `GET /mascotas` devuelve el arreglo de mascotas propias activas; `POST /mascotas` (201), `PUT /mascotas/:id` (200) y `DELETE /mascotas/:id` = baja lógica (200). Cuerpos en camelCase (`fechaNacimiento`, `pesoKg`, `alergiasCondiciones`), opcionales vacíos no se envían. Si BE-05 define otra forma, se ajusta el frontend. |
| 27/10/2026 | FE-03 | No hay `GET /mascotas/:id` en la sección 6: la ficha (`/mascotas/:id`) busca la mascota dentro de `GET /mascotas`; si no está (ajena o dada de baja) muestra "No encontramos esa mascota". La edad se calcula en el cliente con dayjs desde `fechaNacimiento` (RF06). |
