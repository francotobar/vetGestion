# vetGestión — Instrucciones para agentes

Sistema web de turnos para una veterinaria. Proyecto académico, entrega
inamovible el 30/10/2026. Solo se ejecuta en local.

## Antes de actuar, leé
1. docs/plan_desarrollo_mvp_vetgestion.md (qué construir y en qué orden;
   la sección 0 tiene las reglas de trabajo y convenciones)
2. docs/especificacion_proyecto_veterinario.md (fuente de verdad funcional)

## Comandos
- Backend: `cd backend && npm run dev` | `npm test` | `npm run db:reset` | `npm run seed`
- Frontend: `cd frontend && npm run dev`

## Reglas clave
- Una tarea del plan por vez, en orden. Commit con el ID de la tarea.
- No agregar funcionalidades ni dependencias fuera del plan.
- Ante una ambigüedad, elegí lo más simple y anotalo en docs/DECISIONES.md.
