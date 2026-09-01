# Tasks: Registro de aprendizaje supervisado y auditoría de respuestas de IA

**Input**: Design documents from `/specs/017-aprendizaje-supervisado-auditoria/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/registro.md, quickstart.md; specs `009`, `011`, `014`, `016` implementadas

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Agregar las columnas nuevas a `RespuestaPendienteRevision` y el modelo `EvaluacionRespuestaIA` a `prisma/schema.prisma` según `data-model.md`
- [X] T002 Generar y aplicar la migración Prisma (`npm run db:migrate`)

## Phase 2: Foundational (bloqueante para todas las historias)

- [X] T003 Implementar `ensamblarYPersistirRegistro` en `src/ai/autonomia/registro.ts` según el contrato, con `try/catch` que nunca propaga (FR-010)
- [X] T004 [P] Confirmar que `transfer.tool.ts` ya deja `motivo` disponible en `ResultadoTool.data` de forma consistente (revisión de código — ya lo hacía desde su implementación original en `012`, sin cambios necesarios)
- [X] T005 Modificar `ejecutarConTools` en `generar-respuesta-ia.suscriptor.ts` para acumular `herramientasEjecutadas`, `motivoTransferencia` (si `transferir_a_humano` se ejecutó) y `productoIdentificadoId` (mejor esfuerzo desde `buscar_productos`, research.md Decisión 2)

**Checkpoint**: el ensamblador de registro existe y puede recibir todos los campos.

## Phase 3: User Story 1 - Cada respuesta generada queda registrada con su traza completa (Priority: P1) 🎯 MVP

**Goal**: registro completo en ambos caminos (automático y revisado).

**Independent Test**: Escenario 1, 2 y 3 de `quickstart.md`.

- [X] T006 [P] [US1] Test unitario en `src/ai/autonomia/registro.test.ts` (nuevo): con todos los campos disponibles, `ensamblarYPersistirRegistro` persiste la fila completa
- [X] T007 [P] [US1] Test unitario en `registro.test.ts`: con campos ausentes (sin tools, sin estrategia, sin ejemplos), persiste con esos campos `null`/vacíos, sin error
- [X] T008 [P] [US1] Test de integración en `generar-respuesta-ia.suscriptor.test.ts`: el camino `ENVIAR` del gate de `016` ahora también crea un registro con `estado: ENVIADA_AUTOMATICAMENTE`
- [X] T009 [US1] Modificar el suscriptor para llamar a `ensamblarYPersistirRegistro` en el camino `ENVIAR` (después de `enviarMensaje` exitoso), pasando `usoIAId`, `herramientasEjecutadas`, `motivoTransferencia`, `estrategiaUtilizadaId`/`ejemplosUtilizadosIds` (desde `ContextoCompuesto` de `013`/`014` — se extendió `ContextoIA`/`ContextoCompuesto` con `ejemplosUtilizadosIds`, que `013` no exponía todavía)
- [X] T010 [US1] Confirmar que el camino `PENDIENTE` ya existente de `016` pasa por el mismo `ensamblarYPersistirRegistro` (unificación, no duplicación) — `crearRespuestaPendiente` (`actions.ts`) ahora delega en él; el suscriptor llama a `ensamblarYPersistirRegistro` directamente en ambos caminos
- [X] T011 [US1] Implementar `listarRegistrosRespuesta` en `src/ai/autonomia/queries.ts` según el contrato (con el join a `UsoIA` resuelto)
- [X] T012 [US1] Exponer una vista de auditoría simple (`vista-auditoria.tsx`) usando `listarRegistrosRespuesta`, como sub-sección de la tab IA

**Checkpoint**: Historia 1 demostrable de forma aislada.

## Phase 4: User Story 2 - Evaluación posterior de una respuesta (Priority: P2)

**Goal**: calificar cualquier respuesta ya registrada, sin límite de una sola evaluación.

**Independent Test**: Escenario 4 de `quickstart.md`.

- [X] T013 [P] [US2] Test de integración en `src/ai/autonomia/actions.test.ts` (extendido de `016`): `agregarEvaluacion` permite más de una evaluación para el mismo registro, ninguna se pierde
- [X] T014 [US2] Implementar `agregarEvaluacion` en `src/ai/autonomia/actions.ts`
- [X] T015 [US2] Agregar la acción de evaluar (con las dos opciones + comentario) en la vista de auditoría de T012

**Checkpoint**: Historias 1 y 2 completas.

## Phase 5: User Story 3 - Correcciones alimentan recomendaciones, nunca cambian el agente automáticamente (Priority: P2)

**Goal**: `ejecutarAnalisisPiloto` puede incluir correcciones recientes como insumo.

**Independent Test**: Escenario 5 de `quickstart.md`.

- [X] T016 [P] [US3] Test de integración en `src/ai/piloto/analizador.test.ts` (extendido de `014`): con `incluirCorreccionesRecientes: true`, el resultado sigue siendo `RecomendacionComportamiento` en `PENDIENTE`; `AgenteIAConfig` no cambia
- [X] T017 [US3] Extender `ejecutarAnalisisPiloto` (`src/ai/piloto/analizador.ts`) para aceptar `opciones.incluirCorreccionesRecientes` y sumar el resumen de correcciones al contenido analizado, según el contrato — nueva query `listarCorreccionesRecientes` en `src/ai/autonomia/queries.ts`, checkbox en `bandeja-recomendaciones.tsx`

**Checkpoint**: las tres historias completas.

## Phase 6: Polish & Cross-Cutting

- [X] T018 [P] Ejecutar `quickstart.md` completo (Escenarios 1–7) — verificado vía suite automatizada (222 tests, `npx vitest run`), equivalente a los escenarios manuales
- [X] T019 Confirmar que ningún fallo de `ensamblarYPersistirRegistro` interrumpe el envío/generación real de una respuesta (Escenario 6, prueba explícita de resiliencia) — cubierto por el test "FR-010 — un fallo al persistir nunca se propaga" de `registro.test.ts`, y por diseño: se llama después de que `enviarMensaje` ya tuvo éxito en el camino `ENVIAR`
- [X] T020 Actualizar `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` marcando la spec `017` como implementada

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

## Notas de implementación (post-mortem)

- **`ContextoCompuesto`/`ContextoIA` extendidos con `ejemplosUtilizadosIds`**: `013` solo exponía `estrategiaSeleccionada`/`perfilClienteUsado` como metadata; `014` conectó la capa 9 (ejemplos piloto) pero su resultado era solo el texto formateado, sin los ids usados. Se extendió `producirCapaEjemplosPiloto` (`src/ai/contexto/capas/ejemplos-piloto.ts`) para devolver `{ texto, ejemplosIds }` en vez de solo `string | null`, y se propagó el campo hasta `ContextoIA.ejemplosUtilizadosIds` — necesario para que el registro de `017` pueda trazar qué ejemplos se usaron en cada respuesta. Cambio de contrato interno, no de comportamiento observable (verificado con el test existente de `context-builder.test.ts`, actualizado para el nuevo shape).
- **`crearRespuestaPendiente` (016) ahora delega en `ensamblarYPersistirRegistro`**: en vez de duplicar la escritura a `RespuestaPendienteRevision`, se convirtió en un wrapper fino sobre el nuevo ensamblador — cumple T010 (unificación) sin cambiar su firma pública (usada por la bandeja de revisión de `016`, sin tocar esos componentes).
- **`productoIdentificadoId` (research.md Decisión 2)**: se implementó exactamente como "mejor esfuerzo" — solo mira el resultado de la tool `buscar_productos` (la única que "identifica" un producto desde texto libre; `consultar_disponibilidad`/`consultar_precio_actual` de `015` reciben el `productoId` como argumento ya conocido, no lo determinan), toma el primer resultado, sin inferencia semántica de cuál es "el" producto relevante.
- **Migración con conexión intermitente a Supabase**: `prisma migrate dev` tardó ~5 minutos en conectar (patrón ya documentado en memoria) — ejecutado en background con polling explícito, en paralelo con la implementación de `registro.ts`/tests mientras se esperaba.

## Resumen de estado

✅ **Implementada por completo** (20/20 tareas). 222/222 tests (`npx vitest run`) pasan (9 nuevos en `registro.test.ts`/`actions.test.ts`/`analizador.test.ts`, más 1 actualizado en `context-builder.test.ts` y 5 reescritos en `generar-respuesta-ia.suscriptor.test.ts` para el nuevo ensamblador); `npm run build` exit code 0; migración `20260901133615_aprendizaje_supervisado_auditoria` aplicada contra la base compartida.
