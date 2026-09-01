# Tasks: Registro de aprendizaje supervisado y auditoría de respuestas de IA

**Input**: Design documents from `/specs/017-aprendizaje-supervisado-auditoria/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/registro.md, quickstart.md; specs `009`, `011`, `014`, `016` implementadas

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [ ] T001 Agregar las columnas nuevas a `RespuestaPendienteRevision` y el modelo `EvaluacionRespuestaIA` a `prisma/schema.prisma` según `data-model.md`
- [ ] T002 Generar y aplicar la migración Prisma (`npm run db:migrate`)

## Phase 2: Foundational (bloqueante para todas las historias)

- [ ] T003 Implementar `ensamblarYPersistirRegistro` en `src/ai/autonomia/registro.ts` según el contrato, con `try/catch` que nunca propaga (FR-010)
- [ ] T004 [P] Extender `transfer.tool.ts` para asegurar que `motivo` queda disponible en `ResultadoTool.data` de forma consistente (confirmar/ajustar, ya lo hace parcialmente)
- [ ] T005 Modificar `ejecutarConTools` en `generar-respuesta-ia.suscriptor.ts` para acumular `herramientasEjecutadas` y el `motivo` de `transferir_a_humano` si se ejecutó

**Checkpoint**: el ensamblador de registro existe y puede recibir todos los campos.

## Phase 3: User Story 1 - Cada respuesta generada queda registrada con su traza completa (Priority: P1) 🎯 MVP

**Goal**: registro completo en ambos caminos (automático y revisado).

**Independent Test**: Escenario 1, 2 y 3 de `quickstart.md`.

- [ ] T006 [P] [US1] Test unitario en `src/ai/autonomia/registro.test.ts` (nuevo): con todos los campos disponibles, `ensamblarYPersistirRegistro` persiste la fila completa
- [ ] T007 [P] [US1] Test unitario en `registro.test.ts`: con campos ausentes (sin tools, sin estrategia, sin ejemplos), persiste con esos campos `null`/vacíos, sin error
- [ ] T008 [P] [US1] Test de integración en `generar-respuesta-ia.suscriptor.test.ts`: el camino `ENVIAR` del gate de `016` ahora también crea un registro con `estado: ENVIADA_AUTOMATICAMENTE`
- [ ] T009 [US1] Modificar el suscriptor para llamar a `ensamblarYPersistirRegistro` en el camino `ENVIAR` (después de `enviarMensaje` exitoso), pasando `usoIAId`, `herramientasEjecutadas`, `motivoTransferencia`, `estrategiaUtilizadaId`/`ejemplosUtilizadosIds` (desde `ContextoCompuesto` de `013`/`014`)
- [ ] T010 [US1] Confirmar que el camino `PENDIENTE` ya existente de `016` pasa por el mismo `ensamblarYPersistirRegistro` (unificación, no duplicación)
- [ ] T011 [US1] Implementar `listarRegistrosRespuesta` en `src/ai/autonomia/queries.ts` según el contrato (con el join a `UsoIA` resuelto)
- [ ] T012 [US1] Exponer una vista de auditoría simple (tabla/lista) usando `listarRegistrosRespuesta`, integrada donde el equipo ya revisa conversaciones o como sub-sección de la tab IA

**Checkpoint**: Historia 1 demostrable de forma aislada.

## Phase 4: User Story 2 - Evaluación posterior de una respuesta (Priority: P2)

**Goal**: calificar cualquier respuesta ya registrada, sin límite de una sola evaluación.

**Independent Test**: Escenario 4 de `quickstart.md`.

- [ ] T013 [P] [US2] Test de integración en `src/ai/autonomia/actions.test.ts` (extendido de `016`): `agregarEvaluacion` permite más de una evaluación para el mismo registro, ninguna se pierde
- [ ] T014 [US2] Implementar `agregarEvaluacion` en `src/ai/autonomia/actions.ts`
- [ ] T015 [US2] Agregar la acción de evaluar (con las dos opciones + comentario) en la vista de auditoría de T012

**Checkpoint**: Historias 1 y 2 completas.

## Phase 5: User Story 3 - Correcciones alimentan recomendaciones, nunca cambian el agente automáticamente (Priority: P2)

**Goal**: `ejecutarAnalisisPiloto` puede incluir correcciones recientes como insumo.

**Independent Test**: Escenario 5 de `quickstart.md`.

- [ ] T016 [P] [US3] Test de integración en `src/ai/piloto/analizador.test.ts` (extendido de `014`): con `incluirCorreccionesRecientes: true`, el resultado sigue siendo `RecomendacionComportamiento` en `PENDIENTE`; `AgenteIAConfig` no cambia
- [ ] T017 [US3] Extender `ejecutarAnalisisPiloto` (`src/ai/piloto/analizador.ts`) para aceptar `opciones.incluirCorreccionesRecientes` y sumar el resumen de correcciones al contenido analizado, según el contrato

**Checkpoint**: las tres historias completas.

## Phase 6: Polish & Cross-Cutting

- [ ] T018 [P] Ejecutar `quickstart.md` completo (Escenarios 1–7)
- [ ] T019 Confirmar que ningún fallo de `ensamblarYPersistirRegistro` interrumpe el envío/generación real de una respuesta (Escenario 6, prueba explícita de resiliencia)
- [ ] T020 Actualizar `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` marcando la spec `017` como implementada

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)**: bloqueante.
- **User Story 1 (Phase 3)**: depende de Phase 2.
- **User Story 2 (Phase 4)**: depende de Phase 3 (necesita registros existentes sobre los que evaluar).
- **User Story 3 (Phase 5)**: depende de Phase 3 (necesita registros con correcciones) y de `014` implementada.
- **Polish (Phase 6)**: depende de Phase 3, 4 y 5.

## Implementation Strategy

### MVP First (User Story 1)

1. Setup + Foundational.
2. User Story 1 — el registro completo es el valor central de toda la spec.
3. Validar con Escenario 1, 2 y 3 de `quickstart.md`.

### Incremental Delivery

1. Setup + Foundational.
2. US1 → demo de trazabilidad completa.
3. US2 → demo de evaluación posterior.
4. US3 → demo de correcciones como insumo de mejora continua, sin riesgo de auto-modificación.
5. Polish.
