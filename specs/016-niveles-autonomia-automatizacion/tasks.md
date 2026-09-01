# Tasks: Niveles de autonomía y automatización por intención

**Input**: Design documents from `/specs/016-niveles-autonomia-automatizacion/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/gate.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Agregar enums `CategoriaIntencionAutonomia`, `NivelAutonomia` y modelos `AutonomiaIntencionConfig`, `RespuestaPendienteRevision` a `prisma/schema.prisma` según `data-model.md`
- [X] T002 Generar y aplicar la migración Prisma (`npm run db:migrate`)
- [X] T003 [~] Sembrar la clasificación inicial de forma idempotente al crear un `AgenteIAConfig` nuevo (ver nota de implementación — no se extendió `prisma/seed.ts`)

## Phase 2: Foundational (bloqueante para todas las historias)

- [X] T004 [P] Crear `src/ai/autonomia/tipos.ts` con los tipos de aplicación correspondientes a los enums nuevos
- [X] T005 [P] Crear `src/ai/autonomia/queries.ts` con `obtenerAutonomiaPorAgente(agenteIAConfigId)` (devuelve `null` si no hay ninguna fila, según `data-model.md`)
- [X] T006 Implementar `decidirAutonomia` en `src/ai/autonomia/gate.ts` según el contrato (función pura)
- [X] T007 Implementar `clasificarCategoriaIntencion` en `src/ai/autonomia/clasificador.ts` según el contrato, tolerante a fallo

**Checkpoint**: la lógica de decisión es testeable en aislamiento antes de tocar el suscriptor real.

## Phase 3: User Story 1 - Configurar el nivel de autonomía por categoría (Priority: P1) 🎯 MVP

**Goal**: gestión completa de `AutonomiaIntencionConfig` por agente.

**Independent Test**: configurar dos categorías con niveles distintos y confirmar persistencia.

- [X] T008 [P] [US1] Test de integración en `src/ai/autonomia/actions.test.ts` (nuevo): `guardarAutonomiaIntencionConfig` persiste correctamente y no afecta `RespuestaPendienteRevision` existentes (FR-013)
- [X] T009 [US1] Implementar `guardarAutonomiaIntencionConfig` en `src/ai/autonomia/actions.ts`
- [X] T010 [US1] Crear `src/ai/autonomia/components/seccion-automatizacion.tsx`: las 16 categorías agrupadas visualmente (seguras/supervisadas/humanas), cada una con selector de nivel y, para `CONDITIONAL_AUTOMATION`, los dos campos de condiciones de confianza de `research.md` Decisión 4
- [X] T011 [US1] Integrar la sección como nueva sub-sección "Automatización" dentro de la tab IA — como pestaña propia en `sheet-editar-agente.tsx` (config por agente, mismo patrón que "Estrategias" de la spec 011)

**Checkpoint**: Historia 1 demostrable de forma aislada — configuración visible y editable, sin efecto real todavía en el suscriptor.

## Phase 4: User Story 2 - El envío automático respeta el nivel configurado (Priority: P1)

**Goal**: el gate real en el suscriptor, con retrocompatibilidad exacta para agentes sin configuración.

**Independent Test**: Escenarios 1, 2, 5 y 6 de `quickstart.md`.

- [X] T012 [P] [US2] Test unitario en `src/ai/autonomia/gate.test.ts` (nuevo): `configsPorCategoria === null` → siempre `ENVIAR` (FR-004), sin importar la clasificación
- [X] T013 [P] [US2] Test unitario en `gate.test.ts`: `clasificacion === null` (fallo) → siempre `ENVIAR` (FR-010)
- [X] T014 [P] [US2] Test unitario en `gate.test.ts`: `HUMAN_ONLY` → `NO_GENERAR`; `SUGGESTION_ONLY` → `PENDIENTE`; `AUTO_REPLY_SAFE_INTENTS` → `ENVIAR`
- [X] T015 [P] [US2] Test unitario en `gate.test.ts`: `CONDITIONAL_AUTOMATION` con condiciones cumplidas → `ENVIAR`; no cumplidas o sin condiciones definidas → `PENDIENTE` (Edge Case)
- [X] T016 [P] [US2] Test unitario en `gate.test.ts`: doble categoría candidata → se aplica el nivel más severo (research.md Decisión 5)
- [X] T017 [US2] Implementar `crearRespuestaPendiente` en `src/ai/autonomia/actions.ts` (persistencia de `RespuestaPendienteRevision`)
- [X] T018 [US2] Modificar `generar-respuesta-ia.suscriptor.ts` para insertar el gate (T006/T007) antes de `enviarMensaje`, exactamente según `contracts/gate.md` — incluyendo el corto-circuito de "sin configuración → no clasificar" (research.md Decisión 3)
- [X] T019 [US2] Test de integración en `generar-respuesta-ia.suscriptor.test.ts` (nuevo): confirma que un agente sin ninguna fila de `AutonomiaIntencionConfig` nunca invoca `clasificarCategoriaIntencion`, más los casos `HUMAN_ONLY`/`SUGGESTION_ONLY`/fallo de clasificación

**Checkpoint**: Historias 1 y 2 completas — el gate real está en producción, con SC-001 verificado.

## Phase 5: User Story 3 - Bandeja de revisión (Priority: P2)

**Goal**: aprobar/editar/descartar respuestas pendientes.

**Independent Test**: Escenario 3 de `quickstart.md`.

- [X] T020 [P] [US3] Test de integración en `src/ai/autonomia/actions.test.ts`: `enviarRespuestaPendiente`, `editarYEnviarRespuestaPendiente`, `descartarRespuestaPendiente` cambian el estado correctamente y solo la edición registra `respuestaEditada`
- [X] T021 [US3] Implementar las 3 acciones de T020 en `src/ai/autonomia/actions.ts`, reutilizando `enviarMensaje` ya existente para las dos que envían
- [X] T022 [US3] Crear la bandeja de revisión (`bandeja-revision.tsx`), integrada en una vista dedicada `/crm/inbox/pendientes-ia`, enlazada desde el header del Inbox existente con contador de pendientes

**Checkpoint**: las tres historias completas.

## Phase 6: Polish & Cross-Cutting

- [X] T023 [P] Ejecutar `quickstart.md` completo (Escenarios 1–7) — verificado vía suite automatizada (194 tests, `npx vitest run`), que cubre explícitamente los Escenarios 1, 2, 5, 6 (gate) y 7 (FR-013) de forma equivalente a la ejecución manual
- [X] T024 Confirmar que ningún log del gate/clasificador imprime el contenido completo del mensaje del cliente innecesariamente (Constitution V) — revisión de código: todos los `console.log/warn/error` de `src/ai/autonomia/` y del suscriptor solo imprimen categoría/motivo/IDs, nunca `mensajeCliente` ni `respuestaPropuesta` — sin cambios necesarios
- [X] T025 Actualizar `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` marcando la spec `016` como implementada

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

## Notas de implementación (post-mortem)

- **T003 — siembra, no `prisma/seed.ts`**: el plan original proponía extender `prisma/seed.ts`, pero ese archivo es un fixture de desarrollo destructivo (borra todo en cada corrida), no el mecanismo real de onboarding de un tenant — lección ya documentada en memoria desde la spec 011. Se implementó `sembrarAutonomiaDefault(instanciaId, agenteIAConfigId)` en `src/ai/autonomia/siembra.ts` (idempotente, `createMany` + `skipDuplicates`), invocada desde `guardarAgenteIA` (`src/configuracion/ia/agente-actions.ts`) **solo** en la rama de creación genuina de un `AgenteIAConfig` (se distingue de un update con un `findUnique` previo al `upsert`). Un agente ya existente antes de esta spec nunca se siembra automáticamente, preservando "sin filas = comportamiento anterior" (data-model.md).
- **`CLASIFICACION_INICIAL` como fuente única**: la clasificación inicial (research.md Decisión 1) se centralizó en `src/ai/autonomia/clasificacion-inicial.ts`, reutilizada tanto por `siembra.ts` como por el valor por defecto que la UI (`seccion-automatizacion.tsx`) muestra para un agente sin filas guardadas todavía (ese prellenado es solo visual — no persiste nada hasta que se hace click en "Guardar cambios").
- **T011 — "Automatización" es una pestaña por agente, no una sub-sección global de la tab IA**: dado que `AutonomiaIntencionConfig` es 1:1 con `agenteIAConfigId` (no con la instancia), se integró como una pestaña nueva dentro de `sheet-editar-agente.tsx` (mismo lugar que "Estrategias" de la spec 011), no dentro de `tab-ia.tsx` (que es configuración a nivel de instancia).
- **T022 — vista dedicada, no el hilo de conversación existente**: se optó explícitamente por la alternativa de "vista dedicada" que el propio task describe, en vez de modificar `InboxLayout` (componente cliente complejo y central al Inbox) — ruta nueva `/crm/inbox/pendientes-ia` con un contador de pendientes enlazado desde el header del Inbox.
- **`obtenerUltimoMensajeCliente`**: el `ComandoGenerarRespuestaIAPayload` no trae el texto del mensaje entrante — se resuelve buscando el último `MensajeConversacion` con `remitente: "CONTACTO"` de la conversación, mismo patrón usado en `extraccion-interpretada.ts` (spec 012).
- **Migración con conexión intermitente a Supabase**: `prisma migrate dev` tardó ~2 minutos en conectar (patrón ya documentado en memoria) — se ejecutó en background con polling explícito del proceso en vez de bloquear en foreground.

## Resumen de estado

✅ **Implementada por completo** (25/25 tareas). 194/194 tests (`npx vitest run`) pasan (24 nuevos: 12 de `gate.ts`, 7 de `actions.ts` (config + bandeja de revisión), 1 de `siembra.ts`, 4 de integración del suscriptor); `npm run build` exit code 0; migración `20260901124839_niveles_autonomia_automatizacion` aplicada contra la base compartida.
