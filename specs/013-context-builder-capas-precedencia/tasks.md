# Tasks: Construcción del contexto de IA por capas con precedencia

**Input**: Design documents from `/specs/013-context-builder-capas-precedencia/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/context-builder.md, quickstart.md, y las specs `009`, `011`, `012` ya implementadas

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [ ] T001 Capturar, antes de tocar código, el prompt generado hoy para 2-3 agentes de prueba representativos ("agentes legacy") — insumo del test de retrocompatibilidad de la Historia 1

## Phase 2: Foundational (bloqueante para todas las historias)

- [ ] T002 Definir `CapaContexto`, `InsumosContexto`, `ContextoCompuesto` en `src/ai/contexto/context-builder.ts` según `data-model.md`
- [ ] T003 [P] Extraer `politicas-seguridad.ts` en `src/ai/contexto/capas/` copiando literalmente el bloque fijo existente de `construirSystemPrompt` (research.md Decisión 3 — sin reformular texto)
- [ ] T004 [P] Extraer `identidad-agente.ts` y `reglas-negocio.ts` copiando literalmente la lógica existente de `construirSystemPrompt` post-`009`
- [ ] T005 [P] Extraer `estado-conversacion.ts` copiando literalmente la lógica existente de `construirContexto`
- [ ] T006 [P] Extraer `herramientas-permitidas.ts` formalizando la lista ya calculada por `obtenerHerramientasPermitidas` (sin cambiar su fuente)
- [ ] T007 [P] Extraer `instruccion-final.ts` copiando literalmente el texto ya existente en el suscriptor/`actions-ia.ts`
- [ ] T008 [P] Crear los 3 placeholders (`datos-conocidos-faltantes.ts`, `info-operativa.ts`, `ejemplos-piloto.ts`) que siempre devuelven `null`, cada uno con comentario apuntando a su spec futura (research.md Decisión 1)
- [ ] T009 Implementar `construirContextoCompuesto` en `context-builder.ts` orquestando las capas 1-3, 6-11 en orden de precedencia (T003-T008), sin conectar todavía las capas 4 y 5

**Checkpoint**: con solo Phase 2, el refactor de estructura ya es funcionalmente equivalente al sistema anterior (Historia 1 lista para probarse), sin depender todavía de `011`/`012`.

## Phase 3: User Story 1 - El prompt se compone en capas nombradas con precedencia verificable (Priority: P1) 🎯 MVP

**Goal**: refactor completo con retrocompatibilidad textual exacta.

**Independent Test**: Escenario 1 de `quickstart.md`.

- [ ] T010 [P] [US1] Test de regresión en `src/ai/contexto/context-builder.test.ts` (nuevo): para cada agente de prueba capturado en T001, el prompt generado por `construirContextoCompuesto` (sin estrategia/perfil) es idéntico byte a byte al capturado antes del refactor
- [ ] T011 [P] [US1] Test unitario en `context-builder.test.ts`: una capa que devuelve `null` no deja ningún rastro (línea vacía, separador huérfano) en el `systemPrompt` final
- [ ] T012 [US1] Reescribir `construirSystemPrompt` (`src/ai/prompt/builder.ts`) para delegar en `construirContextoCompuesto`, preservando su firma pública exacta
- [ ] T013 [US1] Reescribir `construirContexto` (`src/ai/contexto/constructor.ts`) para delegar en `construirContextoCompuesto`, preservando su firma pública y el shape de `ContextoIA` exacto (con los 2 campos nuevos opcionales de metadata agregados sin romper a quien no los lea)
- [ ] T014 [US1] Correr toda la suite de tests existente de `src/ai/` y `src/configuracion/ia/` (de `009`) para confirmar cero regresiones

**Checkpoint**: Historia 1 completa — refactor seguro, sin cambio de comportamiento observable todavía.

## Phase 4: User Story 2 - La estrategia y el perfil se incorporan de verdad (Priority: P1)

**Goal**: capas 4 y 5 conectadas a `011`/`012` en el flujo real.

**Independent Test**: Escenario 2, 3 y 4 de `quickstart.md`.

- [ ] T015 [P] [US2] Test unitario en `capas/estrategia-activa.test.ts` (nuevo): con una estrategia asignada que coincide, la capa produce el texto esperado y llama a `registrarSeleccionEstrategia`
- [ ] T016 [P] [US2] Test unitario en `capas/perfil-cliente.test.ts` (nuevo): con un perfil calculado, la capa produce texto distinguiendo objetivo de interpretado
- [ ] T017 [P] [US2] Test unitario en `context-builder.test.ts`: una regla obligatoria (capa 3) y una estrategia contradictoria (capa 4) conviven en el resultado con la regla obligatoria en posición de mayor precedencia (Escenario 3)
- [ ] T018 [US2] Implementar `perfil-cliente.ts` según el contrato — llama a `PerfilClienteService.obtenerPerfil` y puebla `insumos.perfilCliente` para que la capa 4 lo use
- [ ] T019 [US2] Implementar `estrategia-activa.ts` según el contrato — llama a `listarAsignacionesDeAgente` + `seleccionarEstrategia` + `registrarSeleccionEstrategia`
- [ ] T020 [US2] Conectar T018 y T019 dentro de `construirContextoCompuesto` (T009), respetando el orden de cómputo vs. precedencia de `research.md` Decisión 2
- [ ] T021 [US2] Manejar explícitamente el fallo/ausencia de cada una (try/catch → `null`) para cumplir FR-009

**Checkpoint**: Historias 1 y 2 completas — el trabajo de `011` y `012` tiene efecto real por primera vez.

## Phase 5: User Story 3 - Placeholders reservados para capas futuras (Priority: P3)

**Goal**: confirmar que 7, 8, 9 quedan documentadas y neutras.

**Independent Test**: Escenario 5 de `quickstart.md`.

- [ ] T022 [US3] Revisar que los 3 placeholders de T008 tengan el comentario de spec futura correcto y estén en su posición de precedencia correcta dentro del array de `construirContextoCompuesto`

**Checkpoint**: las tres historias completas.

## Phase 6: Polish & Cross-Cutting

- [ ] T023 [P] Ejecutar `quickstart.md` completo (Escenarios 1–5)
- [ ] T024 Actualizar `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` marcando la spec `013` como implementada

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)**: bloqueante — Phase 2 ya requiere el refactor completo de las capas sin estrategia/perfil.
- **User Story 1 (Phase 3)**: depende de Phase 2; es el checkpoint de "no rompí nada".
- **User Story 2 (Phase 4)**: depende de Phase 3 completa (no tiene sentido conectar capas nuevas sobre una base todavía no validada como retrocompatible).
- **User Story 3 (Phase 5)**: depende solo de Phase 2 (T008); puede validarse en paralelo a Phase 3/4.
- **Polish (Phase 6)**: depende de Phase 3, 4 y 5.

## Implementation Strategy

### MVP First (User Story 1)

1. Setup + Foundational (el refactor estructural completo, sin capas nuevas activas).
2. User Story 1 — validar retrocompatibilidad exacta antes de avanzar.
3. **STOP y VALIDAR**: correr el Escenario 1 de `quickstart.md` — es la puerta de seguridad antes de tocar el flujo de producción real con contenido nuevo.

### Incremental Delivery

1. Setup + Foundational + US1 → refactor seguro, cero cambio de comportamiento (deploy de bajo riesgo).
2. US2 → activa el valor real de `011`/`012` en producción (deploy de mayor atención, con el Escenario 3 de `quickstart.md` como criterio de aceptación no negociable).
3. US3 → housekeeping para las specs siguientes.
4. Polish.
