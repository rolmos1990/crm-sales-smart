# Research: 029-combos-productos-compuestos

## D1 — How to model the combo

- **Decision**:
  - Two booleans on `Producto`: `esCombo` (default false) and `ventaDirecta` (default true).
  - A `ProductoComponente` table: `comboId`, `componenteId`, `cantidad Int`, `@@unique([comboId, componenteId])`.
    - FK to the combo `onDelete: Cascade`.
    - FK to the component `onDelete: Restrict`.
- **Rationale**:
  - The spec asks not to create a new `TipoProducto`: a combo can be physical, a service or digital for fulfilment.
  - A relational table (instead of JSON in `metadata`) makes it possible to validate "component already used in some combo" and to compute availability with a join.
  - Products are deleted with a soft delete (`activo=false`), so `Restrict` never blocks the normal flow.
- **Alternative considered**: JSON in `Producto.metadata`. Rejected: it can't be queried by component, and it drops referential integrity.

## D2 — No nested combos, and cycles

- **Decision** (the user's choice):
  - A component cannot be a combo, nor the combo itself.
  - A product that appears as `componenteId` of some combo cannot get `esCombo=true`.
- **Consequence**: the component graph has depth 1, so a cycle is impossible (the proof is trivial). There is no need for DFS or depth-based validation.

## D3 — The combo's stock

- **Decision**:
  - A combo is always saved with `manejaStock=false`, and the server enforces it.
  - Its availability is derived with `calcularDisponibilidadCombo`: the minimum of ⌊stock / cantidad⌋ over the components that have `manejaStock`.
  - An inactive component counts as 0.
  - If no component manages stock, the result is `null` ("no stock control").
- **Rationale**:
  - FR-009 and FR-010.
  - With `manejaStock=false`, every existing stock path that doesn't know about combos (`resolver-hechos.todosConInventario`, `consultar_disponibilidad` before its update) treats the combo as "no control". That is safe, and it never records a movement against the combo.

## D4 — Inventory: one consumption function

- **Current state**: 4 copies of the same logic, each checking and deducting by line with `manejaStock`:
  - `crearPedido` (L67-92, L155-167);
  - `editarPedido` (L301-330, L469-494);
  - `aprobarCotizacion` (L644-658);
  - `generarPedidoDesdeCotizacion` (L64-81, L225-236).
- **Decision**: one pure module, `src/shared/productos/inventario.ts`:
  - `expandirConsumo(lineas)` → `Map<productoId, cantidad>`. A line with `composicion` becomes its components (qty × quantity per combo). A line without it counts against its own `productoId`.
  - `diferenciaConsumo(anterior, nuevo)` → `Map<productoId, delta>` (positive = deduct, negative = return).
  - `validarDeltas(deltas, stock)` → a list of errors for products with `manejaStock` whose positive delta is greater than what is available. The error names the combo when the demand comes from one.

  And a server module, `src/shared/productos/stock.ts`:
  - `cargarComposiciones(productoIds, instanciaId, db)`
  - `cargarStock(ids, db)`
  - `aplicarDeltas(deltas, stock, db)`: runs `increment`/`decrement` only on products with `manejaStock`.
- **How each path maps to it**:
  - **Create order:** previous state = ∅; new = the lines, with current compositions.
  - **Edit order:** previous = current lines, each with its own snapshot; new = kept lines with their snapshot plus new lines with the current composition.
  - **Quote approval** (validation only) and **order generation** (validation plus application inside the tx): previous = ∅; new = the quote lines with current compositions.
- **Rationale**:
  - FR-011, FR-013, FR-014.
  - One place to test the full truth table, instead of four copies.

## D5 — Composition snapshot

- **Decision**:
  - `PedidoLinea.composicionCombo Json?` = `[{ productoId, nombre, cantidad }]`.
  - It is saved when a combo line is created (create, edit or generate) and never updated.
  - Lines of regular products keep `null`.
- **What edits use**: previous and new consumption for existing lines is computed from `composicionCombo`, never from the current combo. That satisfies SC-007 and US2-4.
- **Lines with no snapshot** (historical ones, lines created by the AI tool, which doesn't touch stock, and CSV imports): they count as the product itself. This is exactly today's behavior, and it avoids "returning" components that were never deducted.
- **`CotizacionLinea` gets no snapshot**: a quote doesn't move stock, and the order uses the composition in effect when it is generated (US4-2).

## D6 — Behavior changes forced by consolidating (recorded, and minimal)

1. **Aggregated demand** (FR-011): today the check is per line, so two lines of the same product can oversell. It is now validated against the order total. This is stricter, and it only rejects cases that today leave stock negative.
2. **Changing the product on an existing line when editing**: today, stock isn't returned to the old product or deducted from the new one (a bug found in the analysis). With the diff by product this is fixed naturally.
3. **Stock movements stay outside the main transaction in `crearPedido`/`editarPedido`**, same as today. Moving them inside would change error semantics and is out of scope.
4. **Error messages**: the format is kept (`Stock insuficiente para "X". Disponible: d — solicitado: n`). For combo components it becomes `Stock insuficiente para "Base" (componente de "Luminaria Luna Grande"). Disponible: d — solicitado: n`.

## D7 — Picker and filters

- **Decision**:
  - `obtenerProductosCatalogo` returns every active product (direct sale or not) with `esCombo`, `ventaDirecta` and `disponibilidad` (number | null).
  - `SelectorProductoLinea` lists only `ventaDirecta` products, filtered by tab. It still resolves the label of a selected product that is not for direct sale (FR-020).
- **Filter logic**: a pure function, `filtrarCatalogo(productos, filtro)`, testable.
- **Initial filter**: a `filtroInicial` prop, taken from `ConfiguracionEmpresa.filtroProductosPedido`. The pages and the Server Action `obtenerDatosFormularioCotizacion` already load `ConfiguracionEmpresa`, or they will.
- **Empty state per tab**. The `productos.length > 0` guard in the three forms keeps working, because it covers "empty catalog", not "empty tab".

## D8 — Company preference

- **Decision**:
  - `enum FiltroCatalogoVenta { TODOS PRODUCTOS COMBOS }` and `ConfiguracionEmpresa.filtroProductosPedido FiltroCatalogoVenta @default(TODOS)`.
  - Action `guardarPreferenciaCatalogoVenta`, following the pattern of `guardarConfiguracionEnvio`.
  - UI in `tab-preferencias.tsx`, which is a placeholder today.
- **Rationale**: FR-021/022. There is no sales-settings model, and `ConfiguracionEmpresa` already holds sales flags (`permiteConvertirSinConfirmarCostoEnvio`).

## D9 — AI

- `buscar_productos` and the catalog layer (028) filter on `ventaDirecta: true`.
- `consultar_disponibilidad` for a combo returns the availability derived with the same pure function.
- `crear_pedido` (AI) does not move stock today, and keeps not doing so.
