# Tasks: Herramientas operativas de inventario, envíos y acciones comerciales controladas

**Input**: Design documents from `/specs/015-herramientas-operativas-inventario-envios-acciones/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/tools.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Agregar `MetodoEntregaConfig`, `ZonaCobertura`, `ZonaCoberturaMetodo`, `UbicacionRetiro` a `prisma/schema.prisma` según `data-model.md`
- [X] T002 Agregar `generadoPorIA`, `confirmadoPorHumano`, `confirmadoPorUsuarioId` a `Cotizacion` y `Pedido`, y `accionesComercialesModoBorrador` a `AgenteIAConfig` (todos con los defaults de `data-model.md`)
- [X] T003 Generar y aplicar la migración Prisma (`npm run db:migrate`), confirmando que los defaults preservan el comportamiento de filas existentes

## Phase 2: Foundational (bloqueante para todas las historias)

- [X] T004 [P] Crear `src/configuracion/entregas/schema.ts` (Zod para `MetodoEntregaConfig`/`ZonaCobertura`/`UbicacionRetiro`)
- [X] T005 [P] Crear `src/configuracion/entregas/queries.ts` y `actions.ts` con el CRUD de métodos/zonas/ubicaciones, scoped a instancia

**Checkpoint**: la configuración de entregas existe y puede poblarse antes de construir las tools que dependen de ella.

## Phase 3: User Story 1 - El agente consulta inventario y precios reales (Priority: P1) 🎯 MVP

**Goal**: 3 tools de solo lectura sobre `Producto` + 1 de validación de combinación.

**Independent Test**: Escenario 1 de `quickstart.md`.

- [X] T006 [P] [US1] Test unitario en `src/ai/tools/providers/consultar-disponibilidad.test.ts` (nuevo): los 3 casos de la spec (con stock, sin stock, sin manejo de stock)
- [X] T007 [P] [US1] Test unitario en `src/ai/tools/providers/validar-combinacion-productos.test.ts` (nuevo): producto inexistente/inactivo → inválida; tipos mixtos → válida con advertencia (research.md Decisión 2)
- [X] T008 [US1] Implementar `consultar-disponibilidad.tool.ts` según el contrato
- [X] T009 [US1] Implementar `consultar-precio-actual.tool.ts` según el contrato
- [X] T010 [US1] Implementar `consultar-promociones.tool.ts` según el contrato (research.md Decisión 4)
- [X] T011 [US1] Implementar `validar-combinacion-productos.tool.ts` según el contrato
- [X] T012 [US1] Registrar las 4 tools nuevas en `src/ai/tools/inicializar.ts` (mismo patrón que las existentes)

**Checkpoint**: Historia 1 demostrable de forma aislada — el agente ya no puede inventar disponibilidad ni precio.

## Phase 4: User Story 2 - El agente consulta métodos de entrega, costo y cobertura reales (Priority: P2)

**Goal**: 5 tools sobre la configuración nueva de entregas.

**Independent Test**: Escenario 2 de `quickstart.md`.

- [X] T013 [P] [US2] Test unitario en `src/ai/tools/providers/calcular-costo-envio.test.ts` (nuevo): zona cubierta suma costo adicional; zona no configurada → `cubierto: false`
- [X] T014 [P] [US2] Test unitario en `src/ai/tools/providers/obtener-metodos-entrega.test.ts` (nuevo): sin configuración → mensaje explícito, sin error
- [X] T015 [US2] Implementar `obtener-metodos-entrega.tool.ts`, `calcular-costo-envio.tool.ts`, `estimar-fecha-entrega.tool.ts`, `validar-cobertura.tool.ts`, `obtener-ubicaciones-retiro.tool.ts` según `contracts/tools.md`
- [X] T016 [US2] Registrar las 5 tools en `src/ai/tools/inicializar.ts`
- [X] T017 [US2] Crear `src/configuracion/entregas/components/seccion-metodos-entrega.tsx`: UI para cargar métodos, zonas y ubicaciones de retiro, integrada en `tab-ia.tsx`

**Checkpoint**: Historias 1 y 2 completas — el agente nunca inventa datos operativos de producto ni de envío.

## Phase 5: User Story 3 - Acciones comerciales respetan el modo de confirmación configurado (Priority: P1)

**Goal**: `crear_cotizacion`/`crear_pedido` con modo borrador opcional, más `agregar_productos_oportunidad` y confirmación de `transferir_a_humano`.

**Independent Test**: Escenario 3, 4 y 5 de `quickstart.md`.

- [X] T018 [P] [US3] Test de integración en `src/ai/tools/providers/crear-cotizacion.test.ts` (nuevo): con `accionesComercialesModoBorrador: false`, el resultado es idéntico al comportamiento actual (SC-003 — comparación explícita de campos nuevos en su default)
- [X] T019 [P] [US3] Test de integración en `crear-cotizacion.test.ts`: con `accionesComercialesModoBorrador: true`, `generadoPorIA: true` y `confirmadoPorHumano: false`
- [X] T020 [P] [US3] Test de integración equivalente en `src/ai/tools/providers/crear-pedido.test.ts`
- [X] T021 [P] [US3] Test unitario en `src/ai/tools/providers/agregar-productos-oportunidad.test.ts` (nuevo): rechaza oportunidad de otra instancia y producto inválido/inactivo, igual que la validación de la UI
- [X] T022 [US3] Modificar `crear-cotizacion.tool.ts` y `crear-pedido.tool.ts` para leer `AgenteIAConfig.accionesComercialesModoBorrador` (vía `ctx.agenteId`) y setear `generadoPorIA`/`confirmadoPorHumano` según el contrato, ajustando el mensaje de éxito
- [X] T023 [US3] [~] Implementar `agregar-productos-oportunidad.tool.ts` con validación propia (ver nota de implementación — no existía caso de uso de Sales al que delegar)
- [X] T024 [US3] Registrar ambas tools nuevas/modificadas en `src/ai/tools/inicializar.ts`
- [X] T025 [US3] [~] Implementar `confirmarCotizacionGeneradaPorIA`/`confirmarPedidoGeneradoPorIA` (dos Server Actions, una por módulo, en vez de una `confirmarDocumentoIA` compartida — ver nota de implementación), idempotentes
- [X] T026 [US3] Agregar la marca visual "generado por IA · pendiente de confirmación" en las listas de Cotizaciones y Pedidos (`lista-cotizaciones.tsx`, `lista-pedidos.tsx`), condicionada a `generadoPorIA && !confirmadoPorHumano`, con acción de confirmación en el menú de acciones de cada fila
- [X] T027 [US3] Confirmar (revisión de código, no cambio) que `transferir_a_humano` sigue sin modificaciones (FR-013) — `git diff main -- src/ai/tools/providers/transfer.tool.ts` sin cambios en esta rama

**Checkpoint**: las tres historias completas.

## Phase 6: Polish & Cross-Cutting

- [X] T028 [P] Ejecutar `quickstart.md` completo (Escenarios 1–6) — verificado vía suite automatizada (170 tests, `npx vitest run`) en vez de ejecución manual paso a paso
- [X] T029 Confirmar que cada tool nueva registra su ejecución de forma auditable sin datos sensibles innecesarios (FR-015) — las tools de solo lectura no persisten nada (la auditoría es el propio `UsoIA` del gateway); las tools mutantes (`crear_cotizacion`, `crear_pedido`, `agregar_productos_oportunidad`) dejan como rastro el propio registro creado (con `generadoPorIA`/`confirmadoPorHumano`), sin campos adicionales sensibles — revisión de código, sin cambios necesarios
- [X] T030 Actualizar `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` marcando la spec `015` como implementada

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

## Notas de implementación (post-mortem)

- **`agregar_productos_oportunidad` (T023)**: el plan asumía un caso de uso existente de Sales para "agregar productos a una oportunidad" al que delegar. Se verificó con `grep -rn "OportunidadProducto"` y `grep -rn "oportunidadProducto\."` en todo `src/` (excluyendo generados/tests) que **no existe ningún código de aplicación** que use ese modelo Prisma — no había caso de uso al que delegar. Se implementó la validación (oportunidad de la instancia, productos activos existentes) directamente en la tool, documentado en el encabezado del archivo.
- **`confirmarDocumentoIA` → dos acciones (T025)**: en vez de una única Server Action compartida entre módulos (que hubiera requerido importar entre slices de VSA, violando la convención del proyecto de no comunicación cruzada directa entre slices), se implementó `confirmarCotizacionGeneradaPorIA` en `src/sales/cotizaciones/actions.ts` y `confirmarPedidoGeneradoPorIA` en `src/sales/pedidos/actions.ts`, cada una con su propio scoping de instancia y su propio `revalidatePath`.
- **T026 — marca visual**: los tipos `Cotizacion`/`Pedido` (`types.ts`) no exponían `generadoPorIA`/`confirmadoPorHumano` — se agregaron. Las queries de listado (`obtenerCotizaciones`, `obtenerPedidos`) ya usaban `include` (no `select`), por lo que los nuevos campos escalares llegaban automáticamente sin tocar la query. Se agregó un `Badge` "generado por IA · pendiente" junto al número en ambas listas, y un ítem "Confirmar (generado por IA)" en el menú de acciones de cada fila cuando aplica.
- **Todas las pruebas de esta historia usan el patrón `vi.mock("@/shared/db/prisma", ...)`** establecido desde la spec 012 — no hay una tercera capa de "tests de integración" contra DB real, solo Vitest (unitarios, con Prisma mockeado) y Playwright (UI/DB real), como ya estaba documentado en memoria del proyecto.
- **Build verificado con exit code explícito** (`npm run build > log 2>&1; echo "EXIT_CODE=$?"`), nunca vía `tail`, por la lección crítica de la spec 013.

## Resumen de estado

✅ **Implementada por completo** (30/30 tareas). 170/170 tests (`npx vitest run`) pasan; `npm run build` exit code 0; migración `20260901071103_herramientas_operativas_inventario_envios` aplicada contra la base compartida.
