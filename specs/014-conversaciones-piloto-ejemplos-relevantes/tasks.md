# Tasks: Conversaciones piloto y recuperación de ejemplos relevantes

**Input**: Design documents from `/specs/014-conversaciones-piloto-ejemplos-relevantes/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/server-actions.md, quickstart.md; specs `009`, `011`, `013` implementadas

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [ ] T001 Agregar enums `ClasificacionPiloto`, `EstadoRecomendacion` y modelos `ConversacionPiloto`, `RecomendacionComportamiento`, `EjemploPrompt` a `prisma/schema.prisma` según `data-model.md`
- [ ] T002 Generar y aplicar la migración Prisma (`npm run db:migrate`)

## Phase 2: Foundational (bloqueante para todas las historias)

- [ ] T003 [P] Crear `src/ai/piloto/schema.ts` con los Zod schemas de `crearConversacionPiloto` y demás inputs
- [ ] T004 [P] Implementar `anonimizarContenido` en `src/ai/piloto/anonimizacion.ts` según `research.md` Decisión 1
- [ ] T005 [P] Crear `src/ai/piloto/queries.ts` con listados scoped a instancia (conversaciones piloto, recomendaciones, ejemplos)
- [ ] T006 Crear `src/ai/piloto/actions.ts` con `crearConversacionPiloto`, `anonimizarConversacionPiloto`, `incluirEnPerfil`, `excluirDePerfil` según `contracts/server-actions.md`

**Checkpoint**: base de datos y mutaciones de gestión de piloto existen.

## Phase 3: User Story 1 - Marcar conversaciones reales como ejemplos piloto (Priority: P1) 🎯 MVP

**Goal**: seleccionar, clasificar, etiquetar, anonimizar, incluir/excluir.

**Independent Test**: Escenario 1 de `quickstart.md`.

- [ ] T007 [P] [US1] Test unitario en `src/ai/piloto/anonimizacion.test.ts` (nuevo): sustituye nombre/email/teléfono conocidos en un set de mensajes de prueba, deja el resto del texto intacto
- [ ] T008 [P] [US1] Test de integración en `src/ai/piloto/actions.test.ts` (nuevo): `incluirEnPerfil` rechaza una conversación piloto sin `anonimizadaEn` (Edge Case)
- [ ] T009 [US1] Crear `src/ai/piloto/components/seleccionar-conversacion-piloto.tsx`: desde el inbox de conversaciones existente, acción "Marcar como piloto" que abre el formulario de clasificación/etiquetas/explicación
- [ ] T010 [US1] Crear la vista de gestión de conversaciones piloto (lista con estado anonimizada/incluida, acciones anonimizar/incluir/excluir), como nueva sub-sección dentro de la tab IA

**Checkpoint**: Historia 1 demostrable de forma aislada.

## Phase 4: User Story 2 - Analizar y producir recomendaciones aprobables (Priority: P2)

**Goal**: análisis genera recomendaciones; administrador decide, sin auto-aplicar.

**Independent Test**: Escenario 2 y 5 de `quickstart.md`.

- [ ] T011 [P] [US2] Test de integración en `src/ai/piloto/analizador.test.ts` (nuevo): con conversaciones piloto de prueba y un gateway simulado, `ejecutarAnalisisPiloto` persiste recomendaciones `PENDIENTE` con los campos requeridos
- [ ] T012 [P] [US2] Test de integración en `src/ai/piloto/analizador.test.ts`: sin conversaciones piloto incluidas, devuelve `recomendacionesGeneradas: 0` sin error (Edge Case)
- [ ] T013 [P] [US2] Test de integración en `src/ai/piloto/actions.test.ts`: `aprobarRecomendacion`/`rechazarRecomendacion` nunca escriben en `AgenteIAConfig`/`AgenteIAConfigVersion` (FR-008 — verificación explícita de ausencia de esa escritura)
- [ ] T014 [US2] Implementar `ejecutarAnalisisPiloto` en `src/ai/piloto/analizador.ts` según el contrato, incluyendo el contexto de recomendaciones ya rechazadas (research.md Decisión 3)
- [ ] T015 [US2] Implementar `aprobarRecomendacion`, `rechazarRecomendacion`, `asociarRecomendacionAEstrategia` en `actions.ts`
- [ ] T016 [US2] Implementar `convertirRecomendacionEnRegla` (redirección pre-cargada al flujo de `009`, research.md Decisión 4) y `convertirRecomendacionEnEjemplo` (crea `EjemploPrompt`) en `actions.ts`
- [ ] T017 [US2] Crear `src/ai/piloto/components/bandeja-recomendaciones.tsx`: lista de recomendaciones pendientes/resueltas con las 5 acciones disponibles

**Checkpoint**: Historias 1 y 2 completas.

## Phase 5: User Story 3 - Recuperar solo los ejemplos relevantes (Priority: P1)

**Goal**: 2-4 ejemplos relevantes, integrados a la capa 9 de `013`.

**Independent Test**: Escenario 3 y 4 de `quickstart.md`.

- [ ] T018 [P] [US3] Test unitario en `src/ai/piloto/recuperador-ejemplos.test.ts` (nuevo): con 6+ ejemplos de prueba, devuelve entre 2 y 4 priorizados por coincidencia de etiquetas
- [ ] T019 [P] [US3] Test unitario en `recuperador-ejemplos.test.ts`: sin coincidencias, devuelve lista vacía (no rellena con irrelevantes)
- [ ] T020 [P] [US3] Test unitario en `recuperador-ejemplos.test.ts`: nunca devuelve ejemplos de otra instancia, ni de una conversación piloto excluida, ni de una recomendación rechazada (FR-012, FR-013)
- [ ] T021 [US3] Implementar `IRecuperadorEjemplos`/`recuperador-ejemplos-por-filtro.ts` según `data-model.md` y `research.md` Decisión 2
- [ ] T022 [US3] Reemplazar el placeholder `ejemplos-piloto.ts` de `013` con la implementación real que llama a `recuperador-ejemplos.recuperar` (contrato en `contracts/server-actions.md`)

**Checkpoint**: las tres historias completas — el trabajo de esta spec tiene efecto real en el prompt generado.

## Phase 6: Polish & Cross-Cutting

- [ ] T023 [P] Ejecutar `quickstart.md` completo (Escenarios 1–5)
- [ ] T024 Confirmar que ningún log de `analizador.ts` imprime el contenido anonimizado completo (Constitution V)
- [ ] T025 Actualizar `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` marcando la spec `014` como implementada

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)**: bloqueante.
- **User Story 1 (Phase 3)**: depende solo de Phase 2.
- **User Story 2 (Phase 4)**: depende de Phase 2 y, para su prueba completa, de que existan conversaciones piloto (US1) — pero su implementación de servidor no depende de la UI de US1.
- **User Story 3 (Phase 5)**: depende de Phase 2 (necesita `EjemploPrompt`, que a su vez requiere que US2 exista para crearlos vía `convertirRecomendacionEnEjemplo`) — en la práctica, ejecutar Phase 5 después de Phase 4.
- **Polish (Phase 6)**: depende de Phase 3, 4 y 5.

## Implementation Strategy

### MVP First (User Story 1 + 3, en ese orden, con US2 como puente)

1. Setup + Foundational.
2. US1 → base de conversaciones piloto gestionable.
3. US2 → produce los `EjemploPrompt` que US3 necesita.
4. US3 → cierra el ciclo con efecto real en el prompt.

### Incremental Delivery

1. Setup + Foundational.
2. US1 → demo de gestión de piloto.
3. US2 → demo de recomendaciones aprobables.
4. US3 → demo de recuperación relevante conectada a `013`.
5. Polish.
