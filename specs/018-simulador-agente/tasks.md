# Tasks: Simulador de agente y experiencia de configuración consolidada

**Input**: Design documents from `/specs/018-simulador-agente/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/simulador.md, quickstart.md; specs `009`–`017` implementadas

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [ ] T001 Agregar `modoSimulacion?: boolean` a `ContextoTool` en `src/ai/tools/types.ts`
- [ ] T002 (Opcional, ver research.md Decisión 3) Agregar `SimulacionEjecutada` a `prisma/schema.prisma` y generar/aplicar la migración si se decide persistir historial de simulaciones

## Phase 2: Foundational (bloqueante para todas las historias)

- [ ] T003 [P] Agregar el chequeo de `ctx.modoSimulacion` a `crear-cotizacion.tool.ts` según el contrato — devuelve previsualización con el mismo cálculo de subtotales/impuestos, sin `prisma.cotizacion.create`
- [ ] T004 [P] Agregar el mismo chequeo a `crear-pedido.tool.ts`
- [ ] T005 [P] Agregar el mismo chequeo a `agregar-productos-oportunidad.tool.ts` (`015`)
- [ ] T006 [P] Agregar el mismo chequeo a `transferir_a_humano.tool.ts` — no actualiza `Conversacion.clasificacion` en modo simulación
- [ ] T007 [P] Agregar el mismo chequeo a `actualizar-info-contacto.tool.ts` y `agregar-etiqueta-contacto.tool.ts`
- [ ] T008 [P] Test unitario por cada tool de T003-T007 (6 archivos o casos): con `modoSimulacion: true`, cero llamadas reales a Prisma de escritura (espía/mock), resultado con la misma forma que el modo real
- [ ] T009 Crear `src/ai/simulador/tipos.ts` con `EscenarioSimulacion`, `ClienteSimulado`, `DiagnosticoRespuestaSimulada` según `data-model.md`

**Checkpoint**: todas las tools que escriben son seguras de invocar desde cualquier flujo de simulación futuro.

## Phase 3: User Story 1 - Probar una conversación simulada de punta a punta sin efectos reales (Priority: P1) 🎯 MVP

**Goal**: simulación completa con diagnóstico, cero efectos reales.

**Independent Test**: Escenario 1 y 2 de `quickstart.md`.

- [ ] T010 [P] [US1] Test de integración en `src/ai/simulador/servicio.test.ts` (nuevo): `ejecutar` con un escenario de prueba devuelve un `DiagnosticoRespuestaSimulada` con todos los campos disponibles poblados
- [ ] T011 [P] [US1] Test de integración en `servicio.test.ts`: tras ejecutar una simulación que invoca `crear_cotizacion`, no existe ninguna `Cotizacion` nueva en la base de datos (SC-002, verificación explícita de conteo antes/después)
- [ ] T012 [P] [US1] Test de integración en `servicio.test.ts`: sin ningún `MetodoEntregaConfig`, la información faltante queda señalada en el diagnóstico (Escenario 2)
- [ ] T013 [US1] Implementar `SimuladorService.ejecutar` en `src/ai/simulador/servicio.ts` según el contrato, construyendo el perfil simulado (research.md Decisión 2) y propagando `modoSimulacion: true`
- [ ] T014 [US1] Crear `src/ai/simulador/components/panel-simulador.tsx`: selector de agente, formulario de cliente simulado, caja de mensajes de prueba, y visualización de cada sección del diagnóstico
- [ ] T015 [US1] Integrar `panel-simulador.tsx` como la sección "Simulador" de la configuración del agente

**Checkpoint**: Historia 1 demostrable de forma aislada — el valor central de toda la spec.

## Phase 4: User Story 2 - Cambiar el cliente simulado y comparar (Priority: P2)

**Goal**: reejecutar el mismo mensaje con distinto cliente simulado sin reconfigurar todo.

**Independent Test**: Escenario 3 de `quickstart.md`.

- [ ] T016 [US2] Agregar a `panel-simulador.tsx` la posibilidad de cambiar `ClienteSimulado` y reejecutar el último mensaje sin perder el resto del escenario (agente, historial de mensajes previos)

**Checkpoint**: Historia 2 completa.

## Phase 5: User Story 3 - Comparar versión publicada vs. borrador (Priority: P2)

**Goal**: modo comparar lado a lado.

**Independent Test**: Escenario 4 de `quickstart.md`.

- [ ] T017 [P] [US3] Test de integración en `servicio.test.ts`: `ejecutar` con `usarBorrador: true` resuelve la configuración desde la fila `BORRADOR` de `009`, no desde `AgenteIAConfig` vigente
- [ ] T018 [US3] Extender `ejecutar` para soportar `usarBorrador` según research.md Decisión 4
- [ ] T019 [US3] Crear `src/ai/simulador/components/comparador-versiones.tsx`: ejecuta el mismo mensaje dos veces (publicada y borrador) y muestra ambos resultados identificados

**Checkpoint**: las tres primeras historias completas.

## Phase 6: User Story 4 - Navegación consolidada en 10 secciones (Priority: P3)

**Goal**: un único punto de navegación para toda la configuración del agente.

**Independent Test**: Escenario 6 de `quickstart.md`.

- [ ] T020 [US4] Crear `src/ai/simulador/components/` → sección "Conocimiento" (vista de solo lectura combinando instrucciones de `009` + resumen de tools/datos operativos de `015`, sin campos editables nuevos)
- [ ] T021 [US4] Reestructurar `src/app/configuracion/ia/` (o el layout de la tab IA existente) para exponer las 10 secciones de la tabla de `contracts/simulador.md` bajo una navegación única, sin duplicar ni mover la lógica de cada componente ya construido
- [ ] T022 [US4] Test Playwright smoke: navegar por las 10 secciones desde un único punto de entrada, confirmando que cada una renderiza su contenido esperado

**Checkpoint**: las cuatro historias completas — plan de 10 specs (`009`–`018`) cerrado.

## Phase 7: Polish & Cross-Cutting

- [ ] T023 [P] Ejecutar `quickstart.md` completo (Escenarios 1–6)
- [ ] T024 Revisión final: confirmar que ninguna simulación ejecutada durante las pruebas de esta spec dejó datos reales residuales (limpieza/verificación de la base de datos de desarrollo)
- [ ] T025 Actualizar `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` marcando la spec `018` como implementada — cierre del plan completo de evolución del agente de IA

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)**: bloqueante — ninguna simulación es segura sin el chequeo de `modoSimulacion` en las 6 tools.
- **User Story 1 (Phase 3)**: depende de Phase 2.
- **User Story 2 (Phase 4)**: depende de Phase 3.
- **User Story 3 (Phase 5)**: depende de Phase 3 (reutiliza `SimuladorService.ejecutar`).
- **User Story 4 (Phase 6)**: depende de que Phase 3 y 5 existan (necesita `panel-simulador.tsx` y `comparador-versiones.tsx` para completar la sección "Simulador" de la navegación), y de que `009`–`017` ya tengan sus componentes construidos.
- **Polish (Phase 7)**: depende de todas las fases anteriores.

## Implementation Strategy

### MVP First (User Story 1)

1. Setup + Foundational (las 6 tools seguras para simular).
2. User Story 1 — simulación completa con diagnóstico.
3. Validar con Escenario 1 y 2 de `quickstart.md`, con énfasis en SC-002/SC-003 (cero efectos reales) como criterio de aceptación no negociable.

### Incremental Delivery

1. Setup + Foundational.
2. US1 → demo del simulador core.
3. US2 → comparación de tipos de cliente.
4. US3 → comparación de versiones (cierra el ciclo de `009`).
5. US4 → navegación consolidada (cierra el ciclo de experiencia de configuración del plan completo).
6. Polish.
