---

description: "Tasks for 029-combos-productos-compuestos"
---

# Tasks: Combos (productos compuestos)

**Input**: `/specs/029-combos-productos-compuestos/` (spec, plan, research, data-model, contracts, quickstart)

**Tests**: included. The user explicitly asked for 15 test cases, listed in the checklist notes.

## Phase 1: Setup

- [X] T001 Migration in prisma/schema.prisma:
  - `Producto`: add `esCombo`, `ventaDirecta` and the relations `componentes`/`usadoEnCombos`;
  - new model `ProductoComponente`;
  - `PedidoLinea.composicionCombo Json?`;
  - `enum FiltroCatalogoVenta` and `ConfiguracionEmpresa.filtroProductosPedido`.

  Additive SQL in prisma/migrations/<ts>_combos_productos_compuestos/migration.sql. Regenerate the client.

## Phase 2: Foundational (blocks every story)

- [X] T002 [P] Create src/shared/productos/inventario.ts (pure): `expandirConsumo`, `diferenciaConsumo`, `validarDeltas`, `calcularDisponibilidadCombo`, following contracts §1.
- [X] T003 [P] Create src/shared/productos/inventario.test.ts covering:
  - availability 15/10 → 10;
  - 20/10 with 2+1 → 10;
  - component with no stock → 0;
  - inactive component → 0;
  - no stock control → null;
  - consumption of multiple combo units;
  - quantities > 1;
  - demand added up across a combo line and a line with the same component sold directly;
  - diff after editing up, down and removing;
  - edit against the snapshot and not the current composition;
  - a regular product identical to today;
  - error message naming the combo.
- [X] T004 Create src/shared/productos/stock.ts (server): `cargarComposiciones`, `lineasConComposicionActual`, `cargarStock`, `aplicarDeltas` (contracts §2). Filter by `instanciaId` on the combo and the component.

## Phase 3: US1 — Crear y editar combos (P1) 🎯

- [X] T005 [US1] src/shared/productos/schema.ts: add `esCombo`, `ventaDirecta` and `componentes` (int ≥ 1). src/shared/productos/types.ts: `ProductoCatalogo` +`esCombo`/`ventaDirecta`/`disponibilidad`, `FiltroCatalogo` and `ComponenteCombo`.
- [X] T006 [US1] src/shared/productos/actions.ts: in `crearProducto`/`actualizarProducto`:
  - validate the composition (contracts §3);
  - force `manejaStock=false` on a combo;
  - replace the components inside a transaction;
  - `esCombo=false` deletes the components.

  src/shared/productos/queries.ts:
  - `obtenerProductoPorId` includes the components;
  - `obtenerProductosCatalogo` returns `esCombo`/`ventaDirecta`/`disponibilidad`;
  - new `obtenerProductosParaComponentes(instanciaId, excluirId?)`.
- [X] T007 [P] [US1] src/shared/productos/actions-combo.test.ts: creating a combo, editing its components, rejecting 0 components, rejecting itself, rejecting a combo as component, rejecting a component from another instance, rejecting turning a component into a combo, and "existing product without the new fields keeps working".
- [X] T008 [US1] Create src/shared/productos/components/editor-componentes-combo.tsx:
  - list of components with a quantity input and remove button;
  - picker of simple products (reuse `SelectorProductoLinea`);
  - adding a product already in the list increases its quantity;
  - summary "Valor de los componentes" vs sale price.
- [X] T009 [US1] src/shared/productos/components/form-producto.tsx:
  - "Disponible para venta directa" toggle;
  - "Este producto es un combo" card with the editor;
  - when it's a combo, the "Control de inventario" card shows "La disponibilidad se calcula desde los componentes".

  src/app/productos/{nuevo,[id]/editar}/page.tsx pass the product list for components and the initial components.

## Phase 4: US2 — Venta y descuento de componentes (P1)

- [X] T010 [US2] src/sales/pedidos/actions.ts `crearPedido`:
  - replace the per-line check and deduction with stock.ts (previous = ∅, new = current compositions);
  - save `composicionCombo` on combo lines;
  - keep deducting after `pedido.create`, as today.
- [X] T011 [US2] src/sales/pedidos/actions.ts `editarPedido`:
  - previous = current lines with their `composicionCombo`;
  - new = kept lines with their snapshot plus new lines with the current composition;
  - validate and apply deltas;
  - new combo lines save their snapshot;
  - kept lines never rewrite it.
- [X] T012 [P] [US2] Tests in src/shared/productos/inventario.test.ts for full order flows: create 2 combos → Base 13 / Esfera 8, edit to 1, remove, snapshot vs changed composition. Plus src/sales/pedidos/actions tests if the existing mock pattern allows it.

## Phase 5: US3 — Selector con filtros (P1)

- [X] T013 [P] [US3] Create src/shared/productos/components/filtro-catalogo.ts (`filtrarCatalogo`) and filtro-catalogo.test.ts:
  - Combos only shows direct-sale combos;
  - Productos shows direct-sale non-combos;
  - Todos shows every direct-sale product;
  - products not for direct sale never show;
  - an existing product without the new fields counts as direct sale.
- [X] T014 [US3] src/shared/productos/components/selector-producto-linea.tsx:
  - Todos/Productos/Combos tabs (`filtroInicial` prop);
  - COMBO badge;
  - "n disponibles";
  - empty state per tab;
  - resolve the label of a selected product that is not for direct sale;
  - the search stays applied when switching tabs.

## Phase 6: US4 — Cotizaciones (P2)

- [X] T015 [US4] src/sales/cotizaciones/actions.ts `aprobarCotizacion`: validate stock with stock.ts, expanding the current compositions.
- [X] T016 [US4] src/sales/cotizaciones/services/generar-pedido-desde-cotizacion.service.ts:
  - defensive validation with stock.ts;
  - save `composicionCombo` on combo lines;
  - apply the deltas with `tx`, inside the existing transaction.

## Phase 7: US5 — Preferencia de la empresa (P3)

- [X] T017 [US5] src/configuracion/empresa/schema.ts + actions.ts: `guardarPreferenciaCatalogoVenta`. src/configuracion/components/tab-preferencias.tsx: "Ventas" section with a `<Select items>` for "Productos mostrados al crear pedidos".
- [X] T018 [US5] Pass `filtroInicial` from `ConfiguracionEmpresa.filtroProductosPedido`:
  - the pages src/app/sales/pedidos/nuevo, src/app/sales/pedidos/[id], src/app/sales/cotizaciones/nueva and src/app/sales/cotizaciones/[id]/editar;
  - `obtenerDatosFormularioCotizacion`;
  - then down through FormPedido, DialogEditarPedido and FormCotizacion to `SelectorProductoLinea`.

## Phase 8: Polish & Cross-Cutting

- [X] T019 [P] AI:
  - src/ai/tools/providers/product.tool.ts and src/ai/contexto/capas/catalogo.ts filter on `ventaDirecta: true`;
  - src/ai/tools/providers/consultar-disponibilidad.tool.ts computes a combo's availability with `calcularDisponibilidadCombo`;
  - update the affected tests.
- [X] T020 Run vitest on src/shared/productos, src/sales, src/ai and src/configuracion. Run tsc with no new errors, and `next build`.

## Dependencies

- T001 → T002/T003 [P] → T004.
- Then:
  - US1 (T005-T009);
  - US2 (T010-T012), which needs T004 and T005;
  - US3 (T013-T014), which needs T005;
  - US4 (T015-T016), which needs T004;
  - US5 (T017-T018), which needs T014.
- T019/T020 at the end.

## Implementation Strategy

MVP = US1 + US2 + US3 (create a combo, sell it, find it). Then US4 (quotes) and US5 (preference).

## Implementation notes (2026-09-23)

- **T001: migration not applied.** It was generated with `prisma migrate diff` against the database (read-only). The diff contained exactly the planned changes. It is **not applied**: apply it with `npx prisma migrate deploy`. Until it is applied, the catalog and product queries fail because the new columns don't exist yet.
- **T012: new test file.** No tests existed for `crearPedido`/`editarPedido`. Added `src/sales/pedidos/stock-combos.test.ts`, backed by an in-memory Prisma double that keeps real stock.
- **T020: `server-only` in tests.** Vitest couldn't resolve `server-only`, so any test that imported `stock.ts` or `vista.ts` failed to load, including `cotizaciones/actions.test.ts`. Fixed once for all tests with an alias in `vitest.config.ts` → `src/test-stubs/server-only.ts`.
- **T020: two leftover e2e calls (from the previous feature, "filtros sin URL").** Two e2e tests in `tests/e2e/sales/preparacion.spec.ts` (PREP-06 and PREP-07) still used `?q=` and `?vista=lista`, which now redirect to the clean URL. They now use the UI instead.
- **Behavior changes forced by consolidating the stock logic** (research.md D6):
  - demand is added up per product across the whole order;
  - changing the product on an existing line now returns stock to the old product and deducts it from the new one (before, neither happened).
- **Pre-existing, not related:**
  - 4 failing tests in `crear-cotizacion`/`modo-simulacion`;
  - TS errors in `resend.provider.ts`, `mock-prisma.ts`, `select-moneda.tsx`, Supabase auth, `scripts/` and the agent `onValueChange` in `panel-config-disparadores.tsx`.
