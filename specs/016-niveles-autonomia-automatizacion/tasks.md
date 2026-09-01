# Tasks: Niveles de autonomía y automatización por intención

**Input**: Design documents from `/specs/016-niveles-autonomia-automatizacion/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/gate.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [ ] T001 Agregar enums `CategoriaIntencionAutonomia`, `NivelAutonomia` y modelos `AutonomiaIntencionConfig`, `RespuestaPendienteRevision` a `prisma/schema.prisma` según `data-model.md`
- [ ] T002 Generar y aplicar la migración Prisma (`npm run db:migrate`)
- [ ] T003 Extender `prisma/seed.ts` para sembrar las 16 filas de `AutonomiaIntencionConfig` por agente nuevo, con la clasificación inicial de `research.md` Decisión 1 (idempotente)

## Phase 2: Foundational (bloqueante para todas las historias)

- [ ] T004 [P] Crear `src/ai/autonomia/tipos.ts` con los tipos de aplicación correspondientes a los enums nuevos
- [ ] T005 [P] Crear `src/ai/autonomia/queries.ts` con `obtenerAutonomiaPorAgente(agenteIAConfigId)` (devuelve `null` si no hay ninguna fila, según `data-model.md`)
- [ ] T006 Implementar `decidirAutonomia` en `src/ai/autonomia/gate.ts` según el contrato (función pura)
- [ ] T007 Implementar `clasificarCategoriaIntencion` en `src/ai/autonomia/clasificador.ts` según el contrato, tolerante a fallo

**Checkpoint**: la lógica de decisión es testeable en aislamiento antes de tocar el suscriptor real.

## Phase 3: User Story 1 - Configurar el nivel de autonomía por categoría (Priority: P1) 🎯 MVP

**Goal**: gestión completa de `AutonomiaIntencionConfig` por agente.

**Independent Test**: configurar dos categorías con niveles distintos y confirmar persistencia.

- [ ] T008 [P] [US1] Test de integración en `src/ai/autonomia/actions.test.ts` (nuevo): `guardarAutonomiaIntencionConfig` persiste correctamente y no afecta `RespuestaPendienteRevision` existentes (FR-013)
- [ ] T009 [US1] Implementar `guardarAutonomiaIntencionConfig` en `src/ai/autonomia/actions.ts`
- [ ] T010 [US1] Crear `src/ai/autonomia/components/seccion-automatizacion.tsx`: las 16 categorías agrupadas visualmente (seguras/supervisadas/humanas), cada una con selector de nivel y, para `CONDITIONAL_AUTOMATION`, los dos campos de condiciones de confianza de `research.md` Decisión 4
- [ ] T011 [US1] Integrar la sección como nueva sub-sección "Automatización" dentro de la tab IA

**Checkpoint**: Historia 1 demostrable de forma aislada — configuración visible y editable, sin efecto real todavía en el suscriptor.

## Phase 4: User Story 2 - El envío automático respeta el nivel configurado (Priority: P1)

**Goal**: el gate real en el suscriptor, con retrocompatibilidad exacta para agentes sin configuración.

**Independent Test**: Escenarios 1, 2, 5 y 6 de `quickstart.md`.

- [ ] T012 [P] [US2] Test unitario en `src/ai/autonomia/gate.test.ts` (nuevo): `configsPorCategoria === null` → siempre `ENVIAR` (FR-004), sin importar la clasificación
- [ ] T013 [P] [US2] Test unitario en `gate.test.ts`: `clasificacion === null` (fallo) → siempre `ENVIAR` (FR-010)
- [ ] T014 [P] [US2] Test unitario en `gate.test.ts`: `HUMAN_ONLY` → `NO_GENERAR`; `SUGGESTION_ONLY` → `PENDIENTE`; `AUTO_REPLY_SAFE_INTENTS` → `ENVIAR`
- [ ] T015 [P] [US2] Test unitario en `gate.test.ts`: `CONDITIONAL_AUTOMATION` con condiciones cumplidas → `ENVIAR`; no cumplidas o sin condiciones definidas → `PENDIENTE` (Edge Case)
- [ ] T016 [P] [US2] Test unitario en `gate.test.ts`: doble categoría candidata → se aplica el nivel más severo (research.md Decisión 5)
- [ ] T017 [US2] Implementar `crearRespuestaPendiente` en `src/ai/autonomia/actions.ts` (persistencia de `RespuestaPendienteRevision`)
- [ ] T018 [US2] Modificar `generar-respuesta-ia.suscriptor.ts` para insertar el gate (T006/T007) antes de `enviarMensaje`, exactamente según `contracts/gate.md` — incluyendo el corto-circuito de "sin configuración → no clasificar" (research.md Decisión 3)
- [ ] T019 [US2] Test de integración en `generar-respuesta-ia.suscriptor.test.ts` (nuevo o extendido si ya existe): confirma que un agente sin ninguna fila de `AutonomiaIntencionConfig` nunca invoca `clasificarCategoriaIntencion`

**Checkpoint**: Historias 1 y 2 completas — el gate real está en producción, con SC-001 verificado.

## Phase 5: User Story 3 - Bandeja de revisión (Priority: P2)

**Goal**: aprobar/editar/descartar respuestas pendientes.

**Independent Test**: Escenario 3 de `quickstart.md`.

- [ ] T020 [P] [US3] Test de integración en `src/ai/autonomia/actions.test.ts`: `enviarRespuestaPendiente`, `editarYEnviarRespuestaPendiente`, `descartarRespuestaPendiente` cambian el estado correctamente y solo la edición registra `respuestaEditada`
- [ ] T021 [US3] Implementar las 3 acciones de T020 en `src/ai/autonomia/actions.ts`, reutilizando `enviarMensaje` ya existente para las dos que envían
- [ ] T022 [US3] Crear la bandeja de revisión (lista de `RespuestaPendienteRevision` por conversación/instancia, con las 3 acciones), integrada donde el equipo ya revisa conversaciones (panel de conversación existente o una vista dedicada)

**Checkpoint**: las tres historias completas.

## Phase 6: Polish & Cross-Cutting

- [ ] T023 [P] Ejecutar `quickstart.md` completo (Escenarios 1–7)
- [ ] T024 Confirmar que ningún log del gate/clasificador imprime el contenido completo del mensaje del cliente innecesariamente (Constitution V)
- [ ] T025 Actualizar `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` marcando la spec `016` como implementada

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)**: bloqueante.
- **User Story 1 (Phase 3)**: depende solo de Phase 2.
- **User Story 2 (Phase 4)**: depende de Phase 2; es el checkpoint de mayor riesgo (toca el flujo de envío real) — se recomienda no avanzar a Phase 5 sin el Escenario 1 y 6 de `quickstart.md` verificados.
- **User Story 3 (Phase 5)**: depende de Phase 4 (necesita que existan `RespuestaPendienteRevision` reales generadas por el gate).
- **Polish (Phase 6)**: depende de Phase 3, 4 y 5.

## Implementation Strategy

### MVP First (User Story 1 + 2, en ese orden)

1. Setup + Foundational.
2. US1 → configuración visible y editable.
3. US2 → el gate real, con el Escenario 1 y 6 de `quickstart.md` como criterio de aceptación no negociable antes de considerar esta fase terminada.

### Incremental Delivery

1. Setup + Foundational.
2. US1 → demo de configuración.
3. US2 → demo del gate real (el cambio de más riesgo, con retrocompatibilidad verificada).
4. US3 → demo de la bandeja de revisión.
5. Polish.
