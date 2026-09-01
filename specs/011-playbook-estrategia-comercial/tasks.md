# Tasks: Playbooks de estrategia comercial y selección explicable

**Input**: Design documents from `/specs/011-playbook-estrategia-comercial/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/server-actions.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [ ] T001 Agregar enum `OrigenPlaybook` y modelos `PlaybookEstrategia`, `AgentePlaybookAsignacion`, `SeleccionEstrategiaLog` a `prisma/schema.prisma` según `data-model.md`
- [ ] T002 Generar y aplicar la migración Prisma (`npm run db:migrate`)
- [ ] T003 [P] Crear `src/ai/estrategia/tipos.ts` con `TipoRelacionCliente` e `IntencionComercial` según `data-model.md`
- [ ] T004 Extender `prisma/seed.ts` para sembrar las 7 plantillas (contenido de reglas por plantilla, `activo: false`, `origen: "PLANTILLA"`) de forma idempotente por instancia, según `research.md` Decisión 5

## Phase 2: Foundational (bloqueante para todas las historias)

- [ ] T005 [P] Crear `src/ai/estrategia/schema.ts` con `PlaybookEstrategiaSchema` y `CondicionesSchema` (Zod, según `data-model.md`)
- [ ] T006 [P] Crear `src/ai/estrategia/queries.ts` con `listarEstrategias(instanciaId)`, `listarAsignacionesDeAgente(agenteIAConfigId)` (con el join a `PlaybookEstrategia` necesario para obtener `contenido`/`condiciones`/`prioridad`)
- [ ] T007 Crear `src/ai/estrategia/actions.ts` con `crearEstrategia`, `editarEstrategia`, `activarEstrategia`, `desactivarEstrategia`, `duplicarEstrategia`, `eliminarEstrategia`, `asignarEstrategiaAAgente`, `quitarAsignacionEstrategia` según `contracts/server-actions.md`

**Checkpoint**: el modelo de datos y las mutaciones base existen y son testeables antes de construir el selector o la UI.

## Phase 3: User Story 1 - Gestionar playbooks de estrategia sin escribir código (Priority: P1) 🎯 MVP

**Goal**: ver, activar, desactivar, duplicar, editar y priorizar las 7 plantillas y cualquier estrategia personalizada.

**Independent Test**: Escenario 1 de `quickstart.md`.

- [ ] T008 [P] [US1] Test de integración en `src/ai/estrategia/actions.test.ts` (nuevo): `duplicarEstrategia` crea una copia `PERSONALIZADA` e `activo: false` sin alterar el original
- [ ] T009 [P] [US1] Test de integración en `src/ai/estrategia/actions.test.ts`: `eliminarEstrategia` es rechazada cuando existe al menos una `AgentePlaybookAsignacion` (FR-011)
- [ ] T010 [US1] Crear `src/ai/estrategia/components/lista-estrategias.tsx`: tabla/lista de estrategias con toggle activo/inactivo, acciones editar/duplicar/eliminar, input de prioridad
- [ ] T011 [US1] Crear el formulario de edición de contenido y condiciones de una estrategia (reutilizando `<Form>`/`<FormField>`), incluido en o junto a `lista-estrategias.tsx`
- [ ] T012 [US1] Integrar `lista-estrategias.tsx` como nueva sub-sección "Estrategias" dentro de la tab "Inteligencia Artificial" de `/configuracion`

**Checkpoint**: Historia 1 demostrable de forma aislada — gestión completa de playbooks sin ninguna selección automática todavía.

## Phase 4: User Story 2 - Asignar estrategias a un agente y selección explicable (Priority: P1)

**Goal**: asignación por agente con condiciones, selección automática con motivo auditable.

**Independent Test**: Escenario 2 y 3 de `quickstart.md`.

- [ ] T013 [P] [US2] Test unitario en `src/ai/estrategia/selector.test.ts` (nuevo): coincidencia simple por tipo de relación selecciona la estrategia correcta con motivo
- [ ] T014 [P] [US2] Test unitario en `src/ai/estrategia/selector.test.ts`: coincidencia por intención selecciona correctamente cuando el tipo de relación no aplica
- [ ] T015 [P] [US2] Test unitario en `src/ai/estrategia/selector.test.ts`: sin coincidencias devuelve `null` con motivo explicativo (FR-008)
- [ ] T016 [P] [US2] Test unitario en `src/ai/estrategia/selector.test.ts`: sin señales (`{}`) devuelve `null` sin fallar (Edge Case de datos faltantes)
- [ ] T017 [P] [US2] Test unitario en `src/ai/estrategia/selector.test.ts`: empate de prioridad se resuelve determinísticamente por `asignadaEn` y se reporta `candidatas > 1`
- [ ] T018 [US2] Implementar `seleccionarEstrategia` en `src/ai/estrategia/selector.ts` según el contrato y `research.md` Decisión 3–4 (función pura, sin Prisma)
- [ ] T019 [US2] Implementar `registrarSeleccionEstrategia` en `src/ai/estrategia/registrar-seleccion.ts`, tolerante a fallos (no bloquea el flujo de generación si falla el registro)
- [ ] T020 [US2] Crear `src/ai/estrategia/components/asignar-estrategias-agente.tsx`: UI para asignar/quitar estrategias a un agente, con `prioridadEfectiva` y `condicionesOverride` opcionales
- [ ] T021 [US2] Crear una pantalla o sección simple de auditoría (puede vivir junto a `seccion-versiones.tsx` de `009` o como pestaña propia) que liste `SeleccionEstrategiaLog` por agente, cumpliendo SC-003 ("menos de 3 pasos")

**Checkpoint**: Historias 1 y 2 completas — playbooks gestionables y con selección automática auditable, aunque todavía sin conectarse al prompt real (eso es responsabilidad de `013`).

## Phase 5: User Story 3 - Reemplazar plantilla con estrategia personalizada (Priority: P3)

**Goal**: crear una estrategia desde cero.

**Independent Test**: crear una estrategia sin partir de plantilla, activarla, asignarla, y que participe en la selección igual que cualquier plantilla.

- [ ] T022 [US3] Agregar la opción "Crear estrategia nueva" (sin partir de plantilla) en `lista-estrategias.tsx`, usando `crearEstrategia` (ya implementado en T007) con un formulario vacío en vez de precargado

**Checkpoint**: las tres historias completas.

## Phase 6: Polish & Cross-Cutting

- [ ] T023 [P] Ejecutar `quickstart.md` completo (Escenarios 1–5)
- [ ] T024 Confirmar que `seleccionarEstrategia` y `registrarSeleccionEstrategia` no importan nada de `src/ai/proveedores/` (FR-012, verificación de independencia de proveedor)
- [ ] T025 Actualizar `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` marcando la spec `011` como implementada

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)**: bloqueante.
- **User Story 1 (Phase 3)**: depende solo de Phase 2.
- **User Story 2 (Phase 4)**: depende solo de Phase 2 (el selector es independiente de la UI de gestión de US1, aunque en la práctica se prueba mejor con estrategias ya creadas por US1).
- **User Story 3 (Phase 5)**: depende de T007 (Foundational) y de que exista `lista-estrategias.tsx` (T010, US1) para agregarle la opción de creación desde cero.
- **Polish (Phase 6)**: depende de Phase 3, 4 y 5.

## Implementation Strategy

### MVP First (User Story 1)

1. Setup + Foundational.
2. User Story 1 — gestión completa de playbooks, demostrable sin selección automática.
3. Validar con Escenario 1 de `quickstart.md`.

### Incremental Delivery

1. Setup + Foundational.
2. US1 → demo de gestión de playbooks.
3. US2 → demo de selección explicable y auditable (el valor de negocio completo).
4. US3 → flexibilidad adicional.
5. Polish.
