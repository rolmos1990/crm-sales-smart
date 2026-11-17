---
description: "Task list — Hotfix 036: sincronizar la fecha de entrega al editar un pedido"
---

# Tasks: Sincronizar la fecha de entrega al editar un pedido

**Input**: Design documents from `/specs/036-fix-sync-fecha-entrega-pedido/`

**Prerequisites**: spec.md, plan.md, quickstart.md

**Nota de alcance (Hotfix)**: las dos User Stories (US1 cambiar fecha, US2 borrar fecha) se resuelven con el mismo cambio de una línea — dependen de la misma escritura faltante. No se dividen en tareas separadas; se verifican por separado en los escenarios de `quickstart.md` y en los casos del test.

Sin fases de Setup/Foundational/Polish: el fix toca un archivo de producción.

## Phase 1: Implementación

- [X] T001 [US1][US2] En `src/sales/pedidos/actions.ts` (`editarPedido`), dentro de la `$transaction` existente y justo después de `tx.pedido.update`, sincronizar `EntregaPedido.fechaEstimada` con la fecha que se acaba de guardar en `Pedido.fechaEntrega`, usando `updateMany` sobre `where: { pedidoId: id }` (no-op si el pedido no tiene entrega — ver D1/D3 del plan). Comentario que explique por qué son dos campos y por qué `updateMany`.

## Phase 2: Cobertura de test (proporcional al riesgo)

- [X] T002 Nuevo `src/sales/pedidos/sync-fecha-entrega.test.ts` con doble de Prisma en memoria (patrón de `stock-combos.test.ts`), cubriendo: (1) cambiar la fecha la escribe en ambas ubicaciones, (2) borrarla deja `null` en ambas, (3) un pedido sin entrega no gana una y la edición no falla, (4) no se toca ningún otro campo de la entrega.

## Phase 3: Validación y cierre

- [X] T003 `npx vitest run src/sales/pedidos` en verde: 19/19 (4 del test nuevo + 15 de `stock-combos.test.ts`). Se comprobó que el test nuevo **falla sin el fix** (3 de sus 4 casos; el cuarto, "pedido sin entrega", pasa en ambos sentidos a propósito: es la red contra la regresión de D1).
  - De paso hubo que agregar `entregaPedido: { updateMany }` al doble de Prisma de `stock-combos.test.ts`: su `$transaction` falso no conocía el modelo y los 6 casos que pasan por `editarPedido` fallaban. Es un cambio de doble de test, no de producción.
- [X] T004 `npx tsc --noEmit`: 0 errores en los archivos tocados. Los 7 errores restantes del proyecto son preexistentes y ajenos (`scripts/reparar-oportunidades-pipeline.ts`, `panel-config-disparadores.tsx`, `resend.provider.ts`, `mock-prisma.ts`, `select-moneda.tsx`).
- [ ] T005 **Pendiente del responsable** — escenarios 1-5 de `quickstart.md` contra `npm run dev`. No se corrió desde el agente: el `DATABASE_URL` local apunta al mismo proyecto Supabase que usa producción, así que editar pedidos de prueba a mano habría escrito sobre datos reales. El comportamiento queda cubierto por T003.

## Dependencies & Execution Order

- T001 no depende de nada.
- T002 depende de T001.
- T003-T005 dependen de T001 y T002.
