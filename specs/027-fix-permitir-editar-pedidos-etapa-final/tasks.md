---
description: "Task list — Hotfix 027: permitir configurar edición de pedidos en etapas Final/Cancelación"
---

# Tasks: Permitir configurar edición de pedidos en etapas Final/Cancelación

**Input**: Design documents from `/specs/027-fix-permitir-editar-pedidos-etapa-final/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: No se pidieron explícitamente en el spec; se incluye una tarea de test e2e como cobertura proporcional al riesgo (Principio V de la constitución), no como TDD estricto.

**Nota de alcance (Hotfix)**: Las tres User Stories del spec (US1 Final, US2 Cancelación, US3 Entrega editable) se resuelven con el mismo cambio de código — todas dependen de la misma expresión condicional (`esFinal || esCancelacion`), duplicada en dos capas (UI y Server Action, ver T001b, encontrado durante la implementación). No tiene sentido dividirlas en tareas separadas por archivo; se implementan juntas y se verifican por separado en el checkpoint de cada historia dentro de `quickstart.md`.

## Phase 1: Implementación

- [X] T001 [US1][US2][US3] En `src/sales/flujo-venta/components/panel-config-etapas.tsx`, dentro de `DialogEditarEtapa`: se quitó el forzado a `false`/`disabled` de ambos toggles ("Edición permitida", "Entrega editable") para etapas Final/Cancelación — solo Inicial sigue bloqueando "Edición permitida" en `true`. Tooltips ajustados; el bloque de "Entrega editable" se simplificó (ya no necesitaba el wrapper de Tooltip).
- [X] T001b [US1][US2][US3] **Encontrado durante la validación e2e (T002), no estaba en el plan original**: el mismo hardcode `(esFinal || esCancelacion) ? false : ...` estaba duplicado en el Server Action (`src/sales/flujo-venta/actions.ts`, `crearEtapa` y `actualizarEtapa`), re-forzando el valor en el servidor sin importar lo que mandara el cliente — el fix de T001 por sí solo no alcanzaba, la UI mostraba el toggle activado pero al guardar el servidor lo revertía a `false`. Corregido con el mismo criterio en ambas funciones.

**Checkpoint**: Las 3 historias de usuario quedan resueltas con T001+T001b — verificado con los Escenarios 1-4 de `quickstart.md` y con FV-10 (T002) pasando end-to-end.

---

## Phase 2: Cobertura de test (proporcional al riesgo)

- [X] T002 [P] Agregado `FV-10` a `tests/e2e/sales/flujo-venta.spec.ts`: crea un pedido en una etapa Final con `permiteEditarPedido:false` explícito (helper nuevo `crearPedidoEnEtapaFinalBloqueada` en `tests/helpers/db.ts`/`db-worker.ts`), confirma el baseline bloqueado, activa "Edición permitida" desde el Flujo de Venta, guarda, y confirma que el pedido queda editable. Pasa de forma consistente (corrido 3 veces en serie tras el fix completo).
  - De paso corrigió dos bugs preexistentes en la infraestructura de test que este caso nuevo expuso (no afectan producción, solo tests): el generador de cliente Prisma estaba desactualizado en el entorno local (`npx prisma generate`, no versionado, no es un cambio de código) y el helper `filaEtapa` buscaba un ancestro con clase `rounded-xl` cuando la fila real usa `rounded-lg` — esto bloqueaba silenciosamente FV-03 a FV-09 también; corregido en `flujo-venta.spec.ts`.

## Phase 3: Validación manual y cierre

- [X] T003 Corrido en vivo contra `npm run dev` + la suite Playwright completa (`tests/e2e/sales/flujo-venta.spec.ts`, 3 corridas). 16/17 pasan; el único fallo (FV-07, formulario "Nuevo pedido") es preexistente y no relacionado — no toca `panel-config-etapas.tsx` ni `flujo-venta/actions.ts`.
- [X] T004 `npx tsc --noEmit` limpio en los archivos tocados (0 errores en `flujo-venta`/`panel-config-etapas`); los ~9 errores preexistentes restantes en el proyecto (mocks, email provider, seed-geografia) son ajenos a este cambio.

---

## Dependencies & Execution Order

- T001 no depende de nada — cambio de UI.
- T001b depende de haber corrido T002 al menos una vez con T001 solo (así se detectó que faltaba).
- T002 depende de T001 y T001b (necesita el comportamiento completo, cliente+servidor, para poder pasar).
- T003 depende de T001+T001b.
- T004 puede correr en paralelo a T002/T003.

## Implementation Strategy

Fix de dos archivos de producción (`panel-config-etapas.tsx` + `flujo-venta/actions.ts`) — no aplica MVP incremental por historia (ver "Nota de alcance" arriba). Orden real seguido: T001 → T004 (chequeo rápido) → T002 (expuso T001b) → T001b → T002 de nuevo (verde) → T003.
