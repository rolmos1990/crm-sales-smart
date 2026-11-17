---
description: "Task list — Feature 037: mostrar quién recibe en el listado de Pedidos"
---

# Tasks: Mostrar quién recibe en el listado de Pedidos

**Input**: Design documents from `/specs/037-destinatario-en-listado-pedidos/`

**Prerequisites**: spec.md, plan.md, research.md, data-model.md, quickstart.md

**Tests**: no se pidieron y no se agregan automatizados — cambio presentacional, ver "Tests" en plan.md.

## Phase 1: Datos (US1)

- [X] T001 [US1] En `src/sales/pedidos/queries.ts`, agregar `nombreDestinatario` al `select` de `entrega` dentro de `incluirRelaciones`.
- [X] T002 [US1] En `src/sales/pedidos/types.ts`, reflejar el campo en `Pedido.entrega`.

## Phase 2: UI (US1 + US2)

- [X] T003 [US1][US2] En `src/sales/pedidos/components/lista-pedidos.tsx`, columna "Cliente": renderizar el chip `Recibe: <nombre>` cuando el destinatario exista y no sea texto vacío, con el estilo del chip de preparación, truncado y con `title` para el valor completo.

**Checkpoint**: US1 y US2 quedan resueltas con T001-T003.

## Phase 3: Validación y cierre

- [X] T004 `npx tsc --noEmit`: 0 errores en los archivos tocados (siguen los 7 preexistentes del repo, ajenos).
- [X] T005 `npx vitest run src/sales/pedidos`: 19/19 en verde.
- [ ] T006 **Pendiente del responsable** — escenarios 1-5 de `quickstart.md`, incluido el de cero regresión y el de modo claro/oscuro. No se corrió desde el agente: el `DATABASE_URL` local apunta al mismo proyecto Supabase que producción y los escenarios 1 y 3 piden cargar destinatarios de prueba, que serían datos reales.

## Dependencies & Execution Order

- T001 y T002 son independientes entre sí.
- T003 depende de T001 y T002.
- T004-T006 dependen de T003.
