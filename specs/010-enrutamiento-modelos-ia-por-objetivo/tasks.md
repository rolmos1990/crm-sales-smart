# Tasks: Enrutamiento de modelos de IA por objetivo

**Input**: Design documents from `/specs/010-enrutamiento-modelos-ia-por-objetivo/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/server-actions.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [ ] T001 Agregar `IDENTIFICACION_PRODUCTO` al enum `TareaIA` en `prisma/schema.prisma` (aditivo, sin tocar valores existentes)
- [ ] T002 Generar y aplicar la migración Prisma (`npm run db:migrate`), confirmando que es puramente aditiva

## Phase 2: Foundational (bloqueante para todas las historias)

- [ ] T003 Documentar y tipar el shape `CasosDeUsoProveedor` (`{ objetivos: Array<TareaIA | "CHAT_RAZONAMIENTO_SUPERIOR"> }`) en `src/ai/orquestador/types.ts` (nuevo o extendiendo `src/ai/proveedores/types.ts` si ya existe un lugar natural)
- [ ] T004 Implementar `resolverProveedorPorObjetivo(instanciaId, tarea, requiereRazonamientoSuperior?)` en `src/ai/orquestador/orquestador.ts` según `contracts/server-actions.md`, leyendo `casosDeUso` de los `ProveedorIA` activos ya obtenidos por `obtenerProveedoresActivos`
- [ ] T005 Integrar `resolverProveedorPorObjetivo` dentro de `seleccionarProveedor`: si devuelve un proveedor, se usa directo (respetando circuit breaker); si devuelve `null`, se conserva el ordenamiento actual por `tipoAgenteIA` sin cambios
- [ ] T006 [P] Extender `SolicitudIA` y `SolicitudConHerramientas` en `src/ai/gateway/types.ts` con `requiereRazonamientoSuperior?: boolean`
- [ ] T007 Pasar `requiereRazonamientoSuperior` desde `generarRespuesta`/`generarConHerramientas` (`src/ai/gateway/gateway.ts`) hacia `seleccionarProveedor`

**Checkpoint**: la lógica de enrutamiento existe y es testeable de forma aislada, aunque todavía no haya UI para configurarla.

## Phase 3: User Story 1 - Asignar qué proveedor de IA usar para cada objetivo (Priority: P1) 🎯 MVP

**Goal**: configurar, desde un dropdown por objetivo, qué proveedor activo atiende cada uno.

**Independent Test**: asignar proveedores distintos a 2+ objetivos, guardar, recargar, confirmar persistencia (Escenario 1 de `quickstart.md`).

- [ ] T008 [P] [US1] Test unitario en `src/configuracion/ia/asignaciones-objetivo.test.ts` (nuevo): rechaza asignar un `proveedorIAId` que no está activo o no pertenece a la instancia (FR-003)
- [ ] T009 [US1] Definir `ObjetivoEnrutamientoSchema` y `AsignacionObjetivoIASchema` en `src/configuracion/ia/schema.ts` según `data-model.md`
- [ ] T010 [US1] Implementar `guardarAsignacionesObjetivoIA` en `src/configuracion/ia/actions.ts` según el contrato — transacción que actualiza `casosDeUso` de cada `ProveedorIA` afectado
- [ ] T011 [US1] Implementar `obtenerAsignacionesObjetivoIA` en `src/configuracion/ia/queries.ts` según el contrato, incluyendo el flag `proveedorInvalido`
- [ ] T012 [US1] Crear `src/configuracion/ia/components/seccion-enrutamiento.tsx`: tabla de 7 objetivos, cada uno con un `<Select>` de proveedores activos (recordar pasar `items` al `<Select>` raíz por `docs/selects.md`, ya que el value=`proveedorIAId` no coincide con la etiqueta visible=nombre del proveedor), opción "usar criterio por defecto" para `proveedorIAId = null`

**Checkpoint**: la Historia 1 es demostrable de forma aislada (configurar y persistir), incluso antes de que el enforcement de la Historia 2 esté conectado a un flujo real.

## Phase 4: User Story 2 - El sistema usa realmente el proveedor asignado a cada objetivo (Priority: P1)

**Goal**: enforcement end-to-end — la asignación de la Historia 1 cambia efectivamente qué proveedor atiende cada llamada.

**Independent Test**: con asignaciones configuradas, disparar llamadas de distintos objetivos y verificar en `UsoIA` qué proveedor las atendió (Escenario 2 y 3 de `quickstart.md`).

- [ ] T013 [P] [US2] Test unitario en `src/ai/orquestador/orquestador.test.ts` (nuevo): `resolverProveedorPorObjetivo` devuelve el proveedor correcto cuando hay una asignación exacta para la tarea
- [ ] T014 [P] [US2] Test unitario en `src/ai/orquestador/orquestador.test.ts`: `resolverProveedorPorObjetivo` devuelve `null` cuando no hay ninguna asignación, y `seleccionarProveedor` cae al criterio actual sin diferencia observable (retrocompatibilidad, SC-003)
- [ ] T015 [P] [US2] Test unitario en `src/ai/orquestador/orquestador.test.ts`: con `tarea = "CHAT"` y `requiereRazonamientoSuperior = true`, se resuelve el proveedor asignado a `CHAT_RAZONAMIENTO_SUPERIOR`, distinto del asignado a `CHAT` estándar
- [ ] T016 [US2] Verificar/ajustar que el circuit breaker y el resguardo por fallas (`registrarFalla`/`registrarExito`) siguen aplicando igual quel proveedor haya sido resuelto por objetivo o por el criterio actual (FR-007)
- [ ] T017 [US2] Agregar el indicador de "asignación inválida" (`proveedorInvalido`) en `seccion-enrutamiento.tsx` (T012) cuando el proveedor asignado a un objetivo deja de estar activo (FR-008, Escenario 3)

**Checkpoint**: Historias 1 y 2 completas — el ahorro de costos configurado es real, no decorativo.

## Phase 5: User Story 3 - Ver qué proveedor atendió cada llamada y por qué (Priority: P3)

**Goal**: visibilidad de objetivo + proveedor en el historial de uso de IA.

**Independent Test**: generar llamadas de 3+ objetivos y confirmar que el panel de estadísticas de uso de IA existente las muestra con su objetivo y proveedor (Escenario 5 de `quickstart.md`).

- [ ] T018 [US3] Revisar `obtenerResumenUsoIA` (`src/ai/queries.ts`) y su UI asociada: confirmar que ya expone `tarea` y `proveedorIA` por registro; si no, extender el `select`/la vista para incluirlos sin cambiar su forma general
- [ ] T019 [US3] Si la UI de estadísticas no diferencia visualmente por objetivo, agregar una columna/filtro por `tarea` en la vista existente (sin crear una pantalla nueva)

**Checkpoint**: las tres historias completas y consistentes entre sí.

## Phase 6: Polish & Cross-Cutting

- [ ] T020 [P] Ejecutar `quickstart.md` completo (Escenarios 1–5) contra un ambiente de desarrollo con 2+ proveedores activos
- [ ] T021 Actualizar `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` marcando la spec `010` como implementada

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)**: bloqueante (enum + función de resolución).
- **User Story 1 (Phase 3)** y **User Story 2 (Phase 4)**: ambas dependen solo de Phase 2; pueden desarrollarse en paralelo por personas distintas (US1 es UI+persistencia, US2 es la integración en el gateway/orquestador), pero US2 es más valiosa para probarse junto con datos reales de US1.
- **User Story 3 (Phase 5)**: depende de que existan llamadas reales generadas bajo US2 para tener algo que mostrar, pero su implementación (extender una query/vista existente) no depende técnicamente de US1/US2 estar mergeadas.
- **Polish (Phase 6)**: depende de Phase 3, 4 y 5 completas.

## Implementation Strategy

### MVP First (User Story 1 + 2 — van juntas por ser ambas P1)

1. Setup + Foundational.
2. User Story 1 (configuración) + User Story 2 (enforcement) — se recomienda entregarlas juntas ya que por separado ninguna es útil sola (Historia 1 sin Historia 2 es decorativa; Historia 2 sin Historia 1 no tiene forma de configurarse).
3. Validar con Escenario 1, 2, 3 y 4 de `quickstart.md`.

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 + US2 → demo con ahorro de costo real y verificable.
3. US3 → visibilidad/auditoría.
4. Polish.
