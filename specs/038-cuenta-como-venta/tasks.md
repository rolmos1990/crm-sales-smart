---

description: "Task list for 038-cuenta-como-venta"
---

# Tasks: Cuenta como Venta en el Flujo de Venta

**Input**: Design documents from `/specs/038-cuenta-como-venta/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Tests**: incluidos. No por preferencia sino por gobierno: la Constitución (principio V, NO NEGOCIABLE) exige tests proporcionales al riesgo, y esta feature cambia cómo se calcula dinero y elimina una columna.

**Organization**: agrupadas por historia de usuario, para que cada una se pueda implementar, probar y entregar por separado.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: a qué historia pertenece (US1…US4)

## Path Conventions

Web app monolítica con dominio en `src/sales/` y `src/crm/`. Migraciones en `prisma/migrations/`. Tests unitarios junto al código (`*.test.ts`, corridos por Vitest).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: columnas nuevas y backfills. Todo aditivo y reversible — nada destructivo en esta fase.

- [X] T001 Agregar `cuentaComoVenta Boolean @default(false)` al modelo `FlujoVentaEtapa` en `prisma/schema.prisma`, con el comentario que explica que se lee en vivo y nunca se copia al Pedido (ver data-model.md)
- [X] T002 Agregar `fechaVenta DateTime?` y el índice `@@index([instanciaId, fechaVenta])` al modelo `Pedido` en `prisma/schema.prisma`
- [X] T003 Crear `prisma/migrations/20261118000000_cuenta_como_venta/migration.sql` con los pasos 1 a 4 de data-model.md: ADD COLUMN del flag, backfill `esFinal AND NOT esCancelacion`, ADD COLUMN de `fechaVenta` + índice, y backfill de la fecha con la **entrega estimada** (`COALESCE(fechaEntrega, fechaPedido)`) solo para los pedidos que ya cuentan como venta
- [ ] T004 Ejecutar `npm run db:migrate` y verificar que ningún pedido en una etapa con `cuentaComoVenta = true` quedó con `fechaVenta IS NULL`. Los pedidos **abiertos** sí quedan en NULL a propósito (ver quickstart §3)

**Checkpoint**: columnas disponibles y pobladas; nada en la aplicación las usa todavía.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: exponer el flag nuevo a través de las capas de tipos y queries que US1 y US2 comparten. Se hace una sola vez para que las dos historias no choquen en los mismos archivos.

**⚠️ CRITICAL**: ninguna historia puede empezar hasta terminar esta fase.

- [X] T005 Agregar `cuentaComoVenta: true` al `select` de etapas en `obtenerEtapasFlujoActivo` en `src/sales/flujo-venta/queries.ts`
- [X] T006 [P] Agregar `cuentaComoVenta: boolean` a la interfaz `FlujoVentaEtapa` en `src/sales/flujo-venta/types.ts`
- [X] T007 [P] ~~Agregar `cuentaComoVenta: boolean` a la interfaz `EtapaFlujoVista`~~ — **descartada al implementar**: resultó innecesaria. `cargarVistaPedidos` solo usa `esFinal`/`esCancelacion` para armar `etapaIdsCerradas`; el flag lo lee `obtenerPedidosKpis` por su cuenta vía `obtenerEtapasFlujoActivo`. Agregarlo dejaba un campo requerido que nadie consume y que cada sitio de construcción tendría que suministrar.

**Checkpoint**: el flag viaja desde la base hasta la vista; ya se puede construir sobre él.

---

## Phase 3: User Story 1 - Declarar qué etapas cuentan como venta (Priority: P1) 🎯 MVP

**Goal**: el responsable comercial marca etapas como "Cuenta como Venta" y los totales de dinero pasan a sumar solo esos pedidos.

**Independent Test**: marcar "Entregado" en la configuración del Flujo de Venta y comprobar en el listado de Pedidos que "Total ventas" suma únicamente los pedidos en esa etapa; desmarcarla y ver el total volver atrás, sin ejecutar nada entre medio.

### Tests for User Story 1

- [X] T008 [P] [US1] Crear `src/sales/pedidos/condicion-venta.test.ts` cubriendo `construirCondicionVenta`: dos etapas marcadas de cuatro → filtro con esos dos ids (FR-006); **ninguna marcada → `{ in: [] }` y total 0, nunca "sin filtro"** (FR-009); arreglo vacío de etapas → `{ estado: "ENTREGADO" }` (FR-010)

### Implementation for User Story 1

- [X] T009 [US1] Agregar `cuentaComoVenta: z.boolean().optional()` a `EtapaSchema` en `src/sales/flujo-venta/schema.ts`
- [X] T010 [US1] Persistir `cuentaComoVenta` en `crearEtapa` y `actualizarEtapa` en `src/sales/flujo-venta/actions.ts`, y rechazar en el servidor que una etapa con `esCancelacion` quede marcada como venta (FR-005), siguiendo el patrón de normalización que ya usan `esInicial`/`permiteEditarPedido`
- [X] T011 [US1] Implementar la función pura `construirCondicionVenta(etapasFlujo)` en `src/sales/pedidos/queries.ts` según data-model.md
- [X] T012 [US1] En `obtenerPedidosKpis` (`src/sales/pedidos/queries.ts`), usar `condicionVenta` para `totalVentas`, `totalVentasMesActual` y el conteo que hoy es `condicionEntregados`, conservando la resta de `costoEnvio` (FR-011) (depende de T011)
- [X] T013 [US1] Agregar el toggle "Cuenta como Venta" a `DialogEditarEtapa` en `src/sales/flujo-venta/components/panel-config-etapas.tsx`, replicando el patrón de los toggles existentes (`rounded-xl border p-3`, switch `h-5 w-9`, ícono Lucide), con tooltip que explique la regla de varias etapas marcadas (FR-004)
- [X] T014 [US1] Agregar el distintivo de "Cuenta como Venta" en la fila de la etapa en `src/sales/flujo-venta/components/panel-config-etapas.tsx`, junto a los de Inicial/Final/Cancelación (FR-003)
- [X] T015 [US1] Cambiar la tarjeta "Entregados / Completados" por "Ventas / Cuentan como venta" en `src/sales/pedidos/components/pedidos-kpi-cards.tsx` (FR-012)

**Checkpoint**: US1 entregable. Los totales ya responden a la configuración, todavía sobre el eje de fecha viejo.

---

## Phase 4: User Story 2 - Atribuir la venta a la fecha en que se concretó (Priority: P1)

**Goal**: al filtrar por fechas, cada venta cuenta en el período en que llegó a su etapa actual, no en el que se creó el pedido.

**Independent Test**: tomar un pedido creado el mes pasado, moverlo hoy a una etapa marcada como venta, y verificar que suma en el filtro del mes en curso y no en el del mes pasado.

### Tests for User Story 2

- [X] T016 [P] [US2] Crear `src/sales/pedidos/eje-fecha-venta.test.ts`: el rango se aplica sobre `fechaVenta` y no sobre `fechaPedido` (FR-017); rango semiabierto; el rango forzado del mes ignora el filtro de pantalla (FR-018); zona de negocio (FR-019); composición por `AND` para no pisar el filtro de etapa del usuario
- [X] T017 [P] [US2] Crear `src/sales/flujo-venta/fecha-venta.test.ts` con doble de Prisma en memoria: se sella en el primer cruce y con el **mismo objeto `Date`** que la fila de historial (FR-014, FR-015); **no** se mueve al pasar a otra etapa que también cuenta; **no** se borra al volver a una que no cuenta; vuelve a cruzar y sigue mandando la primera (FR-014b)
  - ⚠️ **Cobertura parcial**: se probó el motor de etapas (`_moverInterno`), el camino canónico por el que pasan los movimientos manuales y los de validación. Los otros tres sitios —creación manual, conversión de cotización y ejecutor de disparadores— quedan cubiertos por el typecheck y por revisión, no por test. Montar un doble para la conversión de cotización exige simular planificación de stock, variantes y entrega digital; se dejó fuera a propósito. Si se agrega un quinto sitio, el test actual NO lo detecta: la salvaguarda es la regla documentada en CLAUDE.md §7.

### Implementation for User Story 2

- [X] T018 [US2] Sellar `fechaVenta` en la creación manual de pedido (`src/sales/pedidos/actions.ts`), solo si la etapa inicial cuenta como venta, dentro de la transacción existente y con el **mismo valor `Date`** que la fila de historial
- [X] T019 [P] [US2] Sellar `fechaVenta` en la conversión desde cotización (`src/sales/cotizaciones/services/generar-pedido-desde-cotizacion.service.ts`), solo si la etapa inicial cuenta como venta, alineado con el `creadoEn` de su fila de historial
- [X] T020 [P] [US2] Sellar `fechaVenta` en `_moverInterno` (`src/sales/flujo-venta/motor.ts`) dentro del `$transaction` existente, **solo si la etapa destino cuenta como venta y el pedido todavía no tiene fecha** (FR-014b). `moverPedidoAEtapa` suma `cuentaComoVenta` a su `select` de la etapa; `_moverInterno` lee `fechaVenta` en el `findFirst` que ya hacía
- [X] T021 [US2] Sellar `fechaVenta` en el disparador `CAMBIAR_ETAPA` (`src/crm/pipeline/disparadores/ejecutor.ts`) con la misma condición de primer sellado, **envolviendo el `update` y el `create` del historial en una transacción** — eran dos llamadas sueltas y la invariante exige que no puedan quedar desalineadas
- [X] T022 [US2] Implementar `construirWhereVentas(instanciaId, filtros, condicionVenta, rango?)` en `src/sales/pedidos/queries.ts`, reutilizando `construirWhereBase` y aplicando el rango sobre `fechaVenta`; el filtro de entrega estimada se mantiene como predicado independiente (research.md Decisión 5)
- [X] T023 [US2] En `obtenerPedidosKpis` (`src/sales/pedidos/queries.ts`), pasar `totalVentas` y `totalVentasMesActual` al eje `fechaVenta` vía `construirWhereVentas`, conservando que el KPI de mes ignore los filtros de fecha de pantalla (FR-018) (depende de T012, T022)
- [X] T024 [US2] Cambiar el subtítulo de las dos tarjetas de dinero de "Este rango de fechas" a "Vendidos en este rango" en `src/sales/pedidos/components/pedidos-kpi-cards.tsx` (FR-020)

**Checkpoint**: US1 + US2 funcionando. El núcleo de la feature queda entregado.

---

## Phase 5: User Story 3 - Eliminar la fecha de expiración del pedido (Priority: P2)

**Goal**: `Pedido.fechaExpiracion` desaparece del producto y del código.

**Independent Test**: recorrer creación, edición, detalle, listado, CSV y catálogo de Reglas sin encontrar rastro del campo, y confirmar que cotización y entrega digital conservan sus fechas.

**⚠️ ORDEN OBLIGATORIO**: la depuración de Reglas (T025-T026) va **antes** del `DROP COLUMN` (T036). Invertirlo deja pedidos bloqueados sin mensaje de error (research.md Decisión 6).

### Tests for User Story 3

- [X] T025 [P] [US3] Crear `scripts/depurar-reglas-fecha-expiracion.test.ts` sobre la función pura de poda: quita el nodo `condition` en el grupo raíz y en un grupo de nivel 2, conserva los nodos hermanos, y devuelve "árbol vacío" cuando era la única condición

### Implementation for User Story 3

- [X] T026 [US3] Crear `scripts/depurar-reglas-fecha-expiracion.ts`: podar `general.fechaExpiracion` de `FlujoVentaRegla.arbolCondiciones`, borrar las filas de `FlujoVentaReglaCondicion` con ese `campo`, pasar a `estado = 'BORRADOR'` las reglas que queden sin condiciones, y loguear id/nombre/instancia de cada regla tocada (FR-024, FR-025)
- [ ] T027 [US3] Ejecutar el script contra la base y guardar su salida como evidencia de qué reglas se modificaron
- [X] T028 [P] [US3] Quitar la entrada `general.fechaExpiracion` del catálogo en `src/sales/flujo-venta/reglas/catalogo-campos.ts:64-68`
- [X] T029 [P] [US3] Quitar `"general.fechaExpiracion"` de los hechos en `src/sales/flujo-venta/reglas/resolver-hechos.ts:61`
- [X] T030 [P] [US3] Quitar `fechaExpiracion` de `CrearPedidoSchema` y `EditarPedidoSchema` en `src/sales/pedidos/schema.ts:17,46` y de la interfaz `Pedido` en `src/sales/pedidos/types.ts:22` — **sin tocar** `ActualizarEntregaDigitalPedidoSchema`, que tiene su propio `fechaExpiracion` por línea
- [X] T031 [US3] Quitar `fechaExpiracion` del destructuring, del `diffCampo` del historial y del `update` en `src/sales/pedidos/actions.ts:282,397,423`
- [X] T032 [P] [US3] Quitar el campo del formulario en `src/sales/pedidos/components/form-pedido.tsx:33,84,195`
- [X] T033 [P] [US3] Quitar el campo del diálogo de edición en `src/sales/pedidos/components/dialog-editar-pedido.tsx:69,156`
- [X] T034 [P] [US3] Quitar `ExpiracionCell` y la columna "Expiración" en `src/sales/pedidos/components/lista-pedidos.tsx:62-80,304-308`
- [X] T035 [P] [US3] Quitar el badge de expiración/vencido del detalle en `src/app/sales/pedidos/[id]/page.tsx:141,199-208`
- [X] T036 [P] [US3] Quitar la columna y su encabezado de la exportación en `src/sales/pedidos/utils/exportar-csv.ts:29`
- [X] T037 [P] [US3] Quitar `fechaExpiracion: null` del doble de Prisma en `src/sales/pedidos/sync-fecha-entrega.test.ts:66`
- [X] T038 [US3] Crear `prisma/migrations/20261118000100_eliminar_fecha_expiracion_pedido/migration.sql` con el `DROP COLUMN` del paso 6, y quitar el campo de `Pedido` en `prisma/schema.prisma` (depende de T027)
- [X] T039 [US3] Ejecutar `npx tsc --noEmit` y confirmar que está limpio — es la comprobación que demuestra que no sobrevivió ninguna referencia (SC-006)

**Checkpoint**: el campo desapareció por completo; cotización y entrega digital intactas.

---

## Phase 6: User Story 4 - Pendientes y atrasados sobre la entrega estimada (Priority: P2)

**Goal**: las dos tarjetas que colgaban de la fecha de expiración vuelven a tener base de cálculo.

**Independent Test**: un pedido abierto con entrega de ayer cae en "Expirados"; otro con entrega de mañana, en "Pendientes"; uno cerrado con entrega de ayer, en ninguna.

### Tests for User Story 4

- [X] T040 [P] [US4] Crear `src/sales/pedidos/kpis-entrega.test.ts`: entrega ayer → Expirados; entrega hoy → Pendientes durante todo el día en zona de negocio (FR-026); entrega mañana → Pendientes; sin fecha de entrega → ninguna (FR-029); pedido cerrado → ninguna (FR-028)

### Implementation for User Story 4

- [X] T041 [US4] Pasar el inicio del día de negocio (`rangoHoy(zonaHoraria).desde` de `src/shared/fechas/rangos.ts`) desde `cargarVistaPedidos` a `obtenerPedidosKpis` en `src/sales/pedidos/vista.ts`, igual que ya se pasa `rangoMesActual` — la query no calcula fechas (CLAUDE.md §7)
- [X] T042 [US4] Recalcular `pendientes` y `expirados` contra `fechaEntrega` en `src/sales/pedidos/queries.ts:217-218`, usando el corte recibido y conservando `condicionAbiertos` (depende de T041)
- [X] T043 [US4] Actualizar el objeto de KPIs vacío del estado inicial en `src/app/sales/pedidos/page.tsx:53` si cambió la forma de `PedidosKpis`

**Checkpoint**: las seis tarjetas vuelven a tener significado coherente.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T044 [P] Actualizar `docs/fechas-y-zonas-horarias.md` con `fechaVenta` como tercer eje de fecha de Pedido y con la baja de `fechaExpiracion`
- [X] T045 [P] Documentar en `CLAUDE.md` la regla de que `fechaVenta` se escribe siempre junto a `flujoVentaEtapaId`, para que un quinto sitio futuro no abra un agujero
- [X] T046 Ejecutar la suite completa: `npx vitest run`, `npx tsc --noEmit`, `npm run build`
- [ ] T047 Recorrer [quickstart.md](./quickstart.md) completo, con atención especial a §2.2 — marcar y desmarcar una etapa **sin ejecutar nada entre medio** es la prueba de que FR-008 se implementó como está especificado
- [ ] T048 Verificar los dos conteos de cierre del despliegue: pedidos con etapa y sin fecha → 0; reglas que mencionen `fechaExpiracion` → 0

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: depende de Setup — BLOQUEA todas las historias
- **US1 (Phase 3)** y **US2 (Phase 4)**: ambas P1, dependen solo de Foundational
- **US3 (Phase 5)** y **US4 (Phase 6)**: ambas P2. **US4 depende de US3**: sus tarjetas se recalculan porque US3 elimina la base que usaban
- **Polish (Phase 7)**: al final

### User Story Dependencies

- **US1 (P1)**: independiente. Entregable por sí sola — los totales ya responden a la configuración, sobre el eje de fecha actual
- **US2 (P1)**: independiente de US1 en el código (toca el eje de fecha, no el filtro de población), pero el valor de negocio se completa con las dos juntas
- **US3 (P2)**: independiente
- **US4 (P2)**: **depende de US3**. No tiene sentido entregarla antes: hasta que `fechaExpiracion` no desaparezca, las tarjetas siguen funcionando con su base vieja

### Within Each User Story

- Tests antes que implementación
- Helpers puros (T011, T022) antes que los consumidores (T012, T023)
- En US3: depuración de Reglas (T026-T027) **antes** del `DROP COLUMN` (T038)

### Parallel Opportunities

- T006 y T007 en paralelo (archivos distintos)
- T019 y T020 en paralelo entre sí; T018 y T021 van aparte porque tocan archivos con más cambios alrededor
- En US3, casi toda la eliminación es paralelizable: T028-T037 tocan diez archivos distintos
- Todos los tests marcados [P] se pueden escribir en paralelo

---

## Parallel Example: User Story 3

```bash
# Las diez eliminaciones de superficie, en paralelo (archivos distintos):
Task: "Quitar general.fechaExpiracion del catálogo en src/sales/flujo-venta/reglas/catalogo-campos.ts"
Task: "Quitar el hecho en src/sales/flujo-venta/reglas/resolver-hechos.ts"
Task: "Quitar el campo de los esquemas en src/sales/pedidos/schema.ts y types.ts"
Task: "Quitar el campo del formulario en src/sales/pedidos/components/form-pedido.tsx"
Task: "Quitar el campo del diálogo en src/sales/pedidos/components/dialog-editar-pedido.tsx"
Task: "Quitar ExpiracionCell y su columna en src/sales/pedidos/components/lista-pedidos.tsx"
Task: "Quitar el badge del detalle en src/app/sales/pedidos/[id]/page.tsx"
Task: "Quitar la columna del CSV en src/sales/pedidos/utils/exportar-csv.ts"
Task: "Quitar la clave del doble de Prisma en src/sales/pedidos/sync-fecha-entrega.test.ts"

# Después, en serie: DROP COLUMN (T038) y tsc --noEmit (T039)
```

---

## Implementation Strategy

### MVP (US1)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1
4. **PARAR Y VALIDAR**: §2.1 y §2.2 de quickstart.md. Si marcar y desmarcar una etapa no mueve los totales sin ejecutar nada más, el diseño no está implementado como se especificó.
5. Entregable: los totales de dinero ya significan lo que el negocio declaró.

### Entrega incremental

1. Setup + Foundational → base lista
2. **US1** → validar → entregar (MVP)
3. **US2** → validar → entregar (el cierre de mes ya es correcto)
4. **US3** → validar → entregar (el campo desaparece)
5. **US4** → validar → entregar (las tarjetas operativas recuperan sentido)

Cada paso agrega valor sin romper el anterior. El corte natural para una primera entrega a producción es después de US2: US1+US2 son las dos P1 y resuelven el pedido original completo.

---

## Notes

- Los rangos de fecha son siempre semiabiertos `{ gte, lt }` sobre la columna cruda, resueltos en la zona de negocio. Nunca `lte` sobre un límite de día, nunca `AT TIME ZONE` sobre la columna (CLAUDE.md §7)
- `cuentaComoVenta` **nunca** se copia al `Pedido`. Si en algún momento aparece la tentación de materializarlo "para optimizar", se pierde FR-008 entero (research.md Decisión 1)
- `fechaVenta` se escribe siempre con el **mismo objeto `Date`** que la fila de `PedidoHistorialEtapa`, no con dos `new Date()` distintos
- Los totales bajan tras el despliegue: es la corrección buscada, no una regresión
- Commit por tarea o por grupo lógico
