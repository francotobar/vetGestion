# vetGestión — Instrucciones para agentes

Sistema web de turnos para una veterinaria. Proyecto académico, entrega
04/10/2026. Solo se ejecuta en local.

## Antes de actuar, leé
1. docs/plan_desarrollo_mvp_vetgestion.md (qué construir y en qué orden;
   la sección 0 tiene las reglas de trabajo y convenciones)
2. docs/especificacion_proyecto_veterinario.md (fuente de verdad funcional)

## Comandos
- Backend: `cd backend && npm run dev` | `npm test` | `npm run db:reset` | `npm run seed`
- Frontend: `cd frontend && npm run dev`

## Stack
- Backend: [Node + Express + base de datos + ORM/driver]
- Frontend: [framework]
- Tests: [Jest / Vitest / etc.]

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


