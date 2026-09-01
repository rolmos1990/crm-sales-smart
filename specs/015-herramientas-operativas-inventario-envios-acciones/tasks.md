# Tasks: Herramientas operativas de inventario, envíos y acciones comerciales controladas

**Input**: Design documents from `/specs/015-herramientas-operativas-inventario-envios-acciones/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/tools.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [ ] T001 Agregar `MetodoEntregaConfig`, `ZonaCobertura`, `ZonaCoberturaMetodo`, `UbicacionRetiro` a `prisma/schema.prisma` según `data-model.md`
- [ ] T002 Agregar `generadoPorIA`, `confirmadoPorHumano`, `confirmadoPorUsuarioId` a `Cotizacion` y `Pedido`, y `accionesComercialesModoBorrador` a `AgenteIAConfig` (todos con los defaults de `data-model.md`)
- [ ] T003 Generar y aplicar la migración Prisma (`npm run db:migrate`), confirmando que los defaults preservan el comportamiento de filas existentes

## Phase 2: Foundational (bloqueante para todas las historias)

- [ ] T004 [P] Crear `src/configuracion/entregas/schema.ts` (Zod para `MetodoEntregaConfig`/`ZonaCobertura`/`UbicacionRetiro`)
- [ ] T005 [P] Crear `src/configuracion/entregas/queries.ts` y `actions.ts` con el CRUD de métodos/zonas/ubicaciones, scoped a instancia

**Checkpoint**: la configuración de entregas existe y puede poblarse antes de construir las tools que dependen de ella.

## Phase 3: User Story 1 - El agente consulta inventario y precios reales (Priority: P1) 🎯 MVP

**Goal**: 3 tools de solo lectura sobre `Producto` + 1 de validación de combinación.

**Independent Test**: Escenario 1 de `quickstart.md`.

- [ ] T006 [P] [US1] Test unitario en `src/ai/tools/providers/consultar-disponibilidad.test.ts` (nuevo): los 3 casos de la spec (con stock, sin stock, sin manejo de stock)
- [ ] T007 [P] [US1] Test unitario en `src/ai/tools/providers/validar-combinacion-productos.test.ts` (nuevo): producto inexistente/inactivo → inválida; tipos mixtos → válida con advertencia (research.md Decisión 2)
- [ ] T008 [US1] Implementar `consultar-disponibilidad.tool.ts` según el contrato
- [ ] T009 [US1] Implementar `consultar-precio-actual.tool.ts` según el contrato
- [ ] T010 [US1] Implementar `consultar-promociones.tool.ts` según el contrato (research.md Decisión 4)
- [ ] T011 [US1] Implementar `validar-combinacion-productos.tool.ts` según el contrato
- [ ] T012 [US1] Registrar las 4 tools nuevas en `src/ai/tools/inicializar.ts` (mismo patrón que las existentes)

**Checkpoint**: Historia 1 demostrable de forma aislada — el agente ya no puede inventar disponibilidad ni precio.

## Phase 4: User Story 2 - El agente consulta métodos de entrega, costo y cobertura reales (Priority: P2)

**Goal**: 5 tools sobre la configuración nueva de entregas.

**Independent Test**: Escenario 2 de `quickstart.md`.

- [ ] T013 [P] [US2] Test unitario en `src/ai/tools/providers/calcular-costo-envio.test.ts` (nuevo): zona cubierta suma costo adicional; zona no configurada → `cubierto: false`
- [ ] T014 [P] [US2] Test unitario en `src/ai/tools/providers/obtener-metodos-entrega.test.ts` (nuevo): sin configuración → mensaje explícito, sin error
- [ ] T015 [US2] Implementar `obtener-metodos-entrega.tool.ts`, `calcular-costo-envio.tool.ts`, `estimar-fecha-entrega.tool.ts`, `validar-cobertura.tool.ts`, `obtener-ubicaciones-retiro.tool.ts` según `contracts/tools.md`
- [ ] T016 [US2] Registrar las 5 tools en `src/ai/tools/inicializar.ts`
- [ ] T017 [US2] Crear `src/configuracion/entregas/components/seccion-metodos-entrega.tsx`: UI para cargar métodos, zonas y ubicaciones de retiro

**Checkpoint**: Historias 1 y 2 completas — el agente nunca inventa datos operativos de producto ni de envío.

## Phase 5: User Story 3 - Acciones comerciales respetan el modo de confirmación configurado (Priority: P1)

**Goal**: `crear_cotizacion`/`crear_pedido` con modo borrador opcional, más `agregar_productos_oportunidad` y confirmación de `transferir_a_humano`.

**Independent Test**: Escenario 3, 4 y 5 de `quickstart.md`.

- [ ] T018 [P] [US3] Test de integración en `src/ai/tools/providers/crear-cotizacion.test.ts` (nuevo): con `accionesComercialesModoBorrador: false`, el resultado es idéntico al comportamiento actual (SC-003 — comparación explícita de campos nuevos en su default)
- [ ] T019 [P] [US3] Test de integración en `crear-cotizacion.test.ts`: con `accionesComercialesModoBorrador: true`, `generadoPorIA: true` y `confirmadoPorHumano: false`
- [ ] T020 [P] [US3] Test de integración equivalente en `src/ai/tools/providers/crear-pedido.test.ts`
- [ ] T021 [P] [US3] Test unitario en `src/ai/tools/providers/agregar-productos-oportunidad.test.ts` (nuevo): reutiliza las validaciones existentes de Sales, rechaza productos inválidos igual que la UI
- [ ] T022 [US3] Modificar `crear-cotizacion.tool.ts` y `crear-pedido.tool.ts` para leer `AgenteIAConfig.accionesComercialesModoBorrador` (vía `ctx.agenteId`) y setear `generadoPorIA`/`confirmadoPorHumano` según el contrato, ajustando el mensaje de éxito
- [ ] T023 [US3] Implementar `agregar-productos-oportunidad.tool.ts`, delegando en el caso de uso existente de Sales para esa operación
- [ ] T024 [US3] Registrar ambas tools nuevas/modificadas en `src/ai/tools/inicializar.ts`
- [ ] T025 [US3] Implementar `confirmarDocumentoIA` (Server Action) en el módulo correspondiente de Sales (cotizaciones/pedidos), idempotente
- [ ] T026 [US3] Agregar la marca visual "generado por IA · pendiente de confirmación" en las listas/detalle de Cotizaciones y Pedidos existentes, condicionada a `generadoPorIA && !confirmadoPorHumano`
- [ ] T027 [US3] Confirmar (revisión de código, no cambio) que `transferir_a_humano` sigue sin modificaciones (FR-013)

**Checkpoint**: las tres historias completas.

## Phase 6: Polish & Cross-Cutting

- [ ] T028 [P] Ejecutar `quickstart.md` completo (Escenarios 1–6)
- [ ] T029 Confirmar que cada tool nueva registra su ejecución de forma auditable sin datos sensibles innecesarios (FR-015)
- [ ] T030 Actualizar `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` marcando la spec `015` como implementada

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)**: bloqueante para Historia 2 (necesita la configuración de entregas); Historia 1 y 3 solo dependen de Phase 1.
- **User Story 1 (Phase 3)**: depende solo de Phase 1.
- **User Story 2 (Phase 4)**: depende de Phase 2.
- **User Story 3 (Phase 5)**: depende solo de Phase 1 (no de la configuración de entregas) — puede desarrollarse en paralelo a Historia 2.
- **Polish (Phase 6)**: depende de Phase 3, 4 y 5.

## Implementation Strategy

### MVP First (User Story 1)

1. Setup.
2. User Story 1 — inventario y precio reales, el gap más citado del pedido original.
3. Validar con Escenario 1 de `quickstart.md`.

### Incremental Delivery

1. Setup + Foundational (configuración de entregas).
2. US1 → demo de inventario/precio real.
3. US3 → demo de modo de confirmación (en paralelo a US2 si hay capacidad).
4. US2 → demo de envíos/cobertura reales.
5. Polish.
