# vetGestión — Instrucciones para agentes

Sistema web de turnos para una veterinaria. Proyecto académico, entrega
04/10/2026. Despliegue: frontend y backend en Render, base de datos en Aiven.
También se ejecuta en local.

## Antes de actuar, leé
1. docs/plan_desarrollo_mvp_vetgestion.md (qué construir y en qué orden;
   la sección 0 tiene las reglas de trabajo y convenciones)
2. docs/especificacion_proyecto_veterinario.md (fuente de verdad funcional)

## Comandos
- Backend: `cd backend && npm run dev` | `npm test` | `npm run db:reset` | `npm run seed` | `npm run demo:reset`
- Frontend: `cd frontend && npm run dev` | `npm run build`
- En Windows, `npm test` usa la sintaxis `TZ=...` de Unix: definir antes `$env:TZ='America/Argentina/Buenos_Aires'` y ejecutar `npx jest --runInBand`.

## Stack
- Backend: Node 20, Express 4, MySQL 8 con `mysql2`, validación con `zod`, JWT en cookie httpOnly.
- Frontend: React 18 + Vite 5, react-router-dom, axios, dayjs.
- Tests: Jest 29 + Supertest 7 (solo backend).

## Reglas clave
- Una tarea del plan por vez, en orden. Commit con el ID de la tarea.
- No agregar funcionalidades ni dependencias fuera del plan.
- Ante una ambigüedad de implementación (técnica, sin impacto funcional):
  elegí la opción más simple y anotala en docs/DECISIONES.md.
- Ante una ambigüedad que afecte requisitos, permisos, modelo de datos o
  reglas de negocio: NO decidas. Frená y preguntá.
- Simplificar nunca implica omitir un RF/RNF de la especificación ni
  debilitar la seguridad (hash de contraseñas, autorización en el servidor).
- Una tarea está terminada cuando `npm test` pasa y se cumple su criterio
  de aceptación en el plan.
