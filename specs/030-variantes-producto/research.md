# Research: 030-variantes-producto

## D1 — Model: 2 structures instead of 5

- **Decision**: attributes are stored as JSON on the product; variants get their own table.
  - `Producto.atributosVariantes Json?` = `[{ nombre: string, valores: string[] }]`.
  - `ProductoVariante`:
    - `valores Json` = `{ [atributo]: valor }`, for example `{"Color de luz":"Amarilla","Tamaño":"Grande"}`;
    - `clave String`, the normalized combination (`color de luz=amarilla|tamaño=grande`, lowercased, trimmed, sorted by the attribute's position);
    - `@@unique([productoId, clave])`.
- **Rationale**:
  - Attributes and their values are configuration. No sale, stock movement or history ever references an individual value: what gets sold is the variant.
  - Normalizing them into `ProductoAtributo` / `ProductoAtributoValor` / `ProductoVarianteValor` would add 3 tables and cascading deletes with no functional gain.
  - The variant does need a table, because order and quote lines reference it and its stock is mutable.
  - This follows the pattern already used for flexible configuration in JSON (`AgenteIAConfig.respuestasGuia`, `configuracionTono`).
- **Alternative considered**: the conceptual 5-table model. Rejected because it over-engineers for the scale involved (≤ 3 attributes, ≤ 100 variants).
- **Consequence**: renaming a value regenerates the key, so it behaves like "a different combination". The old variant is deactivated (if it has history) or deleted, and a new one is created. The editor warns about this.

## D2 — Stock source of truth

- **Without variants**: `Producto.cantidadDisponible`, same as today.
- **With variants**: `ProductoVariante.cantidadDisponible`.
  - `Producto.cantidadDisponible` is forced to 0 whenever `tieneVariantes` is true.
  - The inventory function treats the product itself as "no stock control", so it never moves a product-level stock that has stopped being the truth.
- **The product's `manejaStock` is the flag for all its variants.**
- **Total** = Σ active variants. It is computed on read (catalog, AI) and is never stored.

## D3 — Conversion, and turning variants off

- **Conversion** (false → true):
  - If `manejaStock` and stock > 0, the server requires Σ(initial stock of the variants) == current stock. Otherwise it returns the error `"Distribuye el stock actual (10): asignado 9"`.
  - In the same transaction it creates the variants and sets the product's `cantidadDisponible = 0`.
  - The UI suggests "asignar todo a la primera variante" and shows the pending total.
- **Turning off** (true → false):
  - Allowed only if no variant has lines (`pedidoLineas` / `cotizacionLineas`).
  - In a transaction: product `cantidadDisponible` = Σ variants, and the variants are deleted.
  - If some variant has history, the server rejects it. The user can deactivate variants instead.
- **Rationale**: FR-008/FR-009 and SC-002. The only possible stock movement is a transfer that adds up to the same total.

## D4 — Editing variants that already exist

- **Payload**: the form sends `variantes: [{ id?, valores, sku, precio, cantidadDisponible, activo }]`.
- **Matching**: the server matches by `id` if there is one, otherwise by `clave`, verifying that the `id` belongs to the product.
- **Variants missing from the payload**:
  - with history → `activo = false`;
  - without history → deleted (FR-005).
- **Stock of variants that already exist**: it is edited directly, just like product stock is edited today from the form. That is the current behavior for setting absolute inventory.

## D5 — Inventory: the variant as a stock unit

- **`LineaConsumo`** gains `varianteId?: string | null`.
- **`expandirConsumo`** uses the key `variante:<id>` when a line has a variant. It keeps `productoId` for everything else: common products, and components of combos (which never have variants, D7).
- **`cargarStock`**:
  - loads products and variants by key;
  - a variant's `manejaStock` = its product's;
  - a product with `tieneVariantes` is reported with `manejaStock = false`.
- **`aplicarDeltas`** updates `producto` or `productoVariante` depending on the key.
- **Name in error messages**: `"Base Luminaria — Amarilla"`.

## D6 — Validation of lines (a single helper)

`validarVariantesLineas(lineas, { instanciaId, existentes })` works as follows:

- **Which lines it checks**: new lines, and existing lines whose product or variant changed. For a product with `tieneVariantes`:
  - `varianteId` is required;
  - the variant must belong to that product;
  - the variant must be active.
- **`varianteId` on a product without variants**: rejected.
- **Unchanged lines** (same product + variant as before) are accepted even if the variant is now inactive, or the product was converted afterwards. This is what keeps history editable.
- **Return value**: it returns the variant names so the caller can build the snapshot.
- **Quotes**: `actualizarCotizacion` recreates every line (`deleteMany` + create). It passes the current lines as `existentes`. For pairs that already existed it keeps the previous `varianteNombre`.

## D7 — Combos

- **Mutually exclusive for now**:
  - `esCombo` and `tieneVariantes` can't both be true;
  - a product with variants can't be a component;
  - a product that is a component can't turn variants on.
- **Rationale**: 029 expands components per `productoId`. Supporting "component = product + variant" means adding `ProductoComponente.varianteId` and expanding by variant. The inventory function (D5) already supports that key, so it is a later, additive step that this model doesn't block.

## D8 — History and display

- **Snapshot**: `varianteNombre` on the line is the name when it was sold.
- **Order and quote detail**: they show `producto.nombre` (as today) and, below it, "Variante: {varianteNombre}".
- **Text copied to the customer**: `"2x Base Luminaria — Amarilla"`.
- **Line description**: when a variant is chosen, the editor sets it to `"Producto — Variante"`, so preparation and exports show it without changes.

## D9 — Flow rules and AI

- **`todosConInventario`** (resolver-hechos): for a line with a variant, compare against the variant's stock.
- **AI catalog layer**: a product with variants lists one line per active variant, each with its effective price.
- **`buscar_productos`**: returns `variantes: [{ id, nombre, precio }]`.
- **`consultar_disponibilidad`**: returns the total plus the breakdown per variant.
- **AI `crear_pedido` / `crear_cotizacion`**: unchanged. They don't validate products and don't move stock (see the spec).
