---

description: "Tasks for 030-variantes-producto"
---

# Tasks: Variantes de producto

**Input**: `/specs/030-variantes-producto/`

**Tests**: included. The user asked for 24 cases (see the checklist notes).

## Phase 1: Setup

- [X] T001 Update prisma/schema.prisma:
  - `Producto`: add `tieneVariantes` and `atributosVariantes`, plus the `variantes` relation;
  - new model `ProductoVariante`;
  - `PedidoLinea` and `CotizacionLinea`: add `varianteId` and `varianteNombre`.

  Generate the additive migration with `prisma migrate diff`, then run `prisma generate`.

## Phase 2: Foundational

- [X] T002 [P] src/shared/productos/variantes.ts (pure, contracts §1): `generarCombinaciones`, `claveVariante`, `nombreVariante`, `validarConfiguracionVariantes`, `planConversionStock`.
- [X] T003 [P] src/shared/productos/variantes.test.ts:
  - 1 attribute with several values;
  - multiple attributes (2 × 3 = 6);
  - stable order;
  - normalized key (case and spaces);
  - duplicate combinations;
  - repeated value;
  - repeated SKU;
  - more than 3 attributes;
  - more than 100 variants;
  - variant that doesn't match the attributes;
  - conversion: exact total OK, 9 or 11 rejected, product without stock control OK.
- [X] T004 src/shared/productos/inventario.ts + stock.ts:
  - `LineaConsumo.varianteId`;
  - key `variante:<id>`;
  - `cargarStock` loads products and variants (a variant uses its product's `manejaStock`; a product with `tieneVariantes` reports `manejaStock=false`);
  - `aplicarDeltas` writes to the matching table;
  - `validarVariantesLineas` (research.md D6).
- [X] T005 [P] Extend src/shared/productos/inventario.test.ts:
  - variant consumption doesn't touch the product or other variants;
  - edit/remove of a variant line.

## Phase 3: US1 + US2 — Configure and convert (P1) 🎯

- [X] T006 [US1] src/shared/productos/schema.ts + types.ts:
  - `tieneVariantes`, `atributosVariantes` and `variantes[]` in the schema;
  - types `VarianteCatalogo`, `AtributoVariante` and `VarianteEditable`;
  - `ProductoCatalogo` gains `tieneVariantes` and `variantes`.
- [X] T007 [US1] src/shared/productos/actions.ts: `crearProducto`/`actualizarProducto` with variants, in a single transaction:
  - validate the configuration;
  - make combos and variants mutually exclusive;
  - conversion (Σ = current stock, and product stock goes to 0);
  - upsert by id or key;
  - deactivate or delete variants that were left out, depending on history;
  - turning variants off only if there is no history, returning Σ to the product;
  - force `cantidadDisponible = 0` while `tieneVariantes` is on.
- [X] T008 [US1] src/shared/productos/queries.ts:
  - `obtenerProductoPorId` with its variants;
  - `obtenerProductosCatalogo` with its variants and total availability;
  - `obtenerProductosParaComponentes` excludes `tieneVariantes`.

  src/shared/productos/actions.ts `validarComposicion`: reject components that have variants.
- [X] T009 [P] [US1] src/shared/productos/actions-variantes.test.ts:
  - create without variants (same as today);
  - edit without variants;
  - create with variants directly;
  - independent SKU and stock per variant;
  - turn variants on in an existing product with 6/4 distribution (total 10, product 0);
  - distribution of 9 rejected;
  - no duplicated stock;
  - edit keeps the variants that have history (deactivates them);
  - turn off without history returns Σ;
  - turn off with history rejected;
  - duplicate combination rejected;
  - a combo can't have variants;
  - a component can't turn variants on.
- [X] T010 [US1] src/shared/productos/components/editor-variantes.tsx:
  - attributes with value chips (+ add), up to 3;
  - combination table generated live, merged with the existing variants by key;
  - SKU, Precio, Stock and Activa editable inline;
  - "Stock actual por distribuir" bar with an "Asignar todo a la primera" button when converting.
- [X] T011 [US1] src/shared/productos/components/form-producto.tsx:
  - "Este producto tiene variantes" card;
  - when on, "Control de inventario" keeps the switch but shows the total derived from the variants instead of the input;
  - the variants from `inicial` are passed through.

## Phase 4: US3 — Selling with variants (P1)

- [X] T012 [US3] src/sales/pedidos/schema.ts and src/sales/cotizaciones/schema.ts: add `varianteId` to the lines.
- [X] T013 [US3] src/sales/pedidos/actions.ts:
  - `crearPedido`/`editarPedido` run `validarVariantesLineas`;
  - consumption by variant;
  - snapshot of `varianteId`/`varianteNombre`;
  - "same line" = same product + variant.
- [X] T014 [US3] src/sales/cotizaciones/actions.ts:
  - `crearCotizacion`/`actualizarCotizacion` run `validarVariantesLineas`, keeping the existing lines' snapshot;
  - `aprobarCotizacion` checks stock per variant.

  src/sales/cotizaciones/services/generar-pedido-desde-cotizacion.service.ts: copy the variant, deduct from it.
- [X] T015 [US3] src/shared/productos/components/selector-producto-linea.tsx: variant step (active only, with price and availability), `varianteId` prop, trigger label "Producto — Variante".

  Editors src/sales/pedidos/components/{form-pedido,dialog-editar-pedido}.tsx and src/sales/cotizaciones/components/form-cotizacion.tsx:
  - set `varianteId`, description and price;
  - clear the variant when the line is cleared;
  - the initial values of existing lines include `varianteId` (src/app/sales/pedidos/[id]/page.tsx, obtenerDatosEdicionCotizacionAction, src/app/sales/cotizaciones/[id]/editar/page.tsx).
- [X] T016 [P] [US3] Extend src/sales/pedidos/stock-combos.test.ts with variants:
  - order with product + variant;
  - order without variants, unchanged;
  - variant from another product rejected;
  - inactive variant rejected for a new line;
  - historical line with an inactive variant can still be edited;
  - product with variants and no variant rejected.

  Plus a quote test (with/without variant, variant from another product) in src/sales/cotizaciones/variantes.test.ts.

## Phase 5: US4 — History (P2)

- [X] T017 [US4] Show the snapshot variant:
  - src/app/sales/pedidos/[id]/page.tsx: line and data sent to the DIGITAL delivery section;
  - src/app/sales/cotizaciones/[id]/page.tsx: line and `lineasParaCopiar`.

## Phase 6: Polish

- [X] T018 [P] Other consumers:
  - src/sales/flujo-venta/reglas/resolver-hechos.ts: `todosConInventario` per variant;
  - src/ai/contexto/capas/catalogo.ts: variants listed with their effective price;
  - src/ai/tools/providers/product.tool.ts: return `variantes`;
  - src/ai/tools/providers/consultar-disponibilidad.tool.ts: total plus breakdown;
  - update their tests.
- [X] T019 Validation:
  - vitest (full suite);
  - tsc with no new errors;
  - `next build`;
  - `prisma migrate status`: the migration is created; it is applied only with the user's OK.

## Implementation notes (2026-09-24)

- **T001 migration** `20260924100000_variantes_producto`: generated with `prisma migrate diff`. It is additive, and the diff contains exactly the planned changes. Applying it requires the user's OK: `npx prisma migrate deploy`.
- **T007: new module.** The logic was split into `src/shared/productos/variantes-server.ts` (`prepararVariantes`), so `actions.ts` wouldn't grow further. `crearProducto` and `actualizarProducto` now save the product and its variants inside `prisma.$transaction`, which is what makes a conversion atomic.
- **T010: attribute matching in the editor.** Combinations are matched by *values in attribute order*, not by name. Renaming an attribute character by character therefore doesn't lose SKU or stock, and each saved variant is reused at most once, so stock is never duplicated on screen.
- **T016: tests.** Variant validation is covered in `src/shared/productos/stock-variantes.test.ts`, which is shared by orders and quotes, instead of a quote-specific test. Quotes use the same helper with `existentes`.
- **Pre-existing, not related:** 4 failing tests in `crear-cotizacion`/`modo-simulacion`; TS errors in Supabase auth, `scripts/`, `resend.provider.ts`, `mock-prisma.ts`, `select-moneda.tsx` and the agent `onValueChange`.
