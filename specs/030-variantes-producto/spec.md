# Feature Specification: Variantes de producto

**Feature Branch**: `[030-variantes-producto]`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "Quiero implementar Variantes de Producto en Karia CRM, manteniendo compatibilidad total con los productos existentes. [...] Opcionalmente un producto pueda tener variantes [...] SKU, inventario/stock, precio, estado activo/inactivo [...] La funcionalidad de variantes debe ser opt-in [...] atributos y valores sin hardcodear Color, Tamaño [...] generar automáticamente las combinaciones [...] Conversión de un producto existente [...] NO debe asumir silenciosamente que ambas tienen stock 10 [...] al seleccionar el producto debe solicitar la variante [...] el total debe ser derivado de la suma de las variantes [...] Historial [...] Preferir Activo/Inactivo [...] Una variante siempre debe pertenecer al producto indicado y esta relación debe validarse en backend [...] Combos [...] el diseño de variantes NO debe impedir esta funcionalidad." (full request, sections 1-13, in the conversation)

## Clasificación

**Feature.** Karia never had variants: each product has a single price, SKU and stock.

## Diagnóstico del estado actual (to preserve)

- **Product and stock:** `Producto` carries `precio`, `sku`, `manejaStock` and `cantidadDisponible`. There is no stock-movement table: stock is one number on the product.
- **When stock moves:**
  - it is deducted when an order is created;
  - it is adjusted when an order is edited;
  - it is deducted when the order is generated from an approved quote;
  - it is not returned when an order is cancelled or deleted.

  Since 029 all of these go through a single consumption function (`src/shared/productos/inventario.ts` + `stock.ts`).
- **Order and quote lines:** each line keeps a snapshot of the description (the name at the time) and the unit price. Order lines also keep the combo composition (029). The detail screens show the product's current name.
- **One shared product picker** (`SelectorProductoLinea`) is used by orders and quotes.
- **Combos exist (029):** one level, and a component references a product.

## Decisiones de diseño

1. **Opt-in per product.** New property "tiene variantes" (default no). No automatic migration: every existing product stays "sin variantes" and behaves exactly as today.
2. **Generic attributes.** A product defines its own attributes (name plus values), with no fixed types. The combinations generate the variants.
3. **One source of truth for stock per mode:**
   - without variants, the product's stock (as today);
   - with variants, each variant's stock; the product total is the sum, not a stock of its own.
4. **Converting an existing product with stock:** the current stock has to be distributed among the new variants, and the total has to match exactly. The transfer is atomic (variants get their stock and the product drops to 0 in the same operation).
5. **Deactivate, don't delete:**
   - a variant used in any order or quote is deactivated instead of deleted;
   - one never used is deleted.
6. **History:** each new line with a variant records the variant and its name at that moment. Earlier lines are not touched.
7. **Combos, for now:** a product with variants can't be a combo component, a combo can't have variants, and a product that is already a component can't turn on variants. The model leaves room for a component to reference a variant later.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar variantes en un producto (Priority: P1)

In the product form the user turns on "Este producto tiene variantes" and defines attributes. For example:
- "Color de luz" with Amarilla and Multicolor;
- "Tamaño" with Pequeña and Grande.

The system generates the 4 combinations and shows them in an editable table (Variante | SKU | Precio | Stock | Activa). With the toggle off, the form stays exactly as it is today.

**Why this priority**: it is the base of the feature.

**Independent Test**: create "Camiseta" with Color (Negro, Blanco) × Talla (S, M, L). 6 variants are generated with independent SKU and stock, and saving and reopening keeps them.

**Acceptance Scenarios**:

1. **Given** a new product with variants off, **When** it is saved, **Then** it behaves exactly as today.
2. **Given** 1 attribute with 3 values, **When** variants are turned on, **Then** 3 variants are generated.
3. **Given** 2 attributes (2 × 3), **When** the combinations are generated, **Then** there are 6 variants, each with a name like "Negro / S".
4. **Given** the variants table, **When** SKU, price, stock and active state are edited for each one and saved, **Then** each variant keeps its own values.
5. **Given** a variant with no price, **When** it is sold, **Then** it uses the product's price.
6. **Given** a repeated value inside an attribute, or two identical combinations, **When** the user saves, **Then** it is rejected ("combinación duplicada").
7. **Given** two variants with the same SKU in the same product, **When** the user saves, **Then** it is rejected.
8. **Given** an attribute value removed from a combination that has already been sold, **When** the user saves, **Then** that variant is deactivated (not deleted). Variants never sold are deleted.
9. **Given** a new value added to an attribute, **When** the user saves, **Then** only the new combinations are created and the existing ones keep their SKU, price and stock.

---

### User Story 2 - Convertir un producto existente sin perder datos (Priority: P1)

"Base Luminaria" (SKU BASE-001, stock 10, $15) turns on variants Amarilla and Multicolor. The system shows the current stock (10) and asks how to distribute it (e.g. Amarilla 6, Multicolor 4). It does not let the user save unless the total is 10. It also offers a one-click option to assign all of it to the first variant.

**Why this priority**: this is the scenario the user called "MUY importante". A mistake here corrupts inventory.

**Independent Test**: convert a product with stock 10 into 2 variants (6/4). Afterwards the variants have 6 and 4, the total shown is 10, and the product has no separate stock.

**Acceptance Scenarios**:

1. **Given** a product with stock control on and stock 10, **When** variants are turned on with a distribution of 6/4, **Then** the variants end up with 6 and 4, the total is 10, and the product-level stock no longer counts (0).
2. **Given** a distribution that adds up to 9 or 11, **When** the user saves, **Then** it is rejected, showing the difference.
3. **Given** a product with SKU BASE-001, **When** it is converted, **Then** the product keeps its SKU. The variants start with no SKU, or with one the user types.
4. **Given** a product without stock control, **When** it is converted, **Then** no distribution is asked for.
5. **Given** a product with variants, none of them ever sold, **When** variants are turned off, **Then** the total variant stock goes back to the product, and the product works as before.
6. **Given** a product with variants that have sales, **When** the user tries to turn variants off, **Then** it is rejected with an explanation (they can deactivate variants instead).

---

### User Story 3 - Vender un producto con variantes en pedidos y cotizaciones (Priority: P1)

In "Agregar producto" the user still sees "Base Luminaria" (not each variant as a separate product). When they pick it, the picker asks for the variant (Amarilla — 6 disponibles · Multicolor — 4 disponibles). The line is recorded as "Base Luminaria — Amarilla", with the variant's price, and stock is deducted from that variant.

**Why this priority**: it completes the value. Without it, the variants can't be sold.

**Independent Test**: create an order with 2 × Base Luminaria / Amarilla. Amarilla goes from 6 to 4, Multicolor stays at 4, and the order shows "Base Luminaria — Variante: Amarilla".

**Acceptance Scenarios**:

1. **Given** a product without variants, **When** it is added to an order or quote, **Then** the flow is exactly today's.
2. **Given** a product with variants, **When** it is selected, **Then** the picker shows its active variants with price and availability. Choosing one completes the line.
3. **Given** an order with a variant line, **When** it is created, edited up or down, or the line is removed, **Then** the stock moves only for that variant, following today's rules.
4. **Given** a quote with a variant line, **When** it is approved and the order is generated, **Then** the order keeps the variant and deducts its stock.
5. **Given** a request with a variant that belongs to another product (or another company), **When** it reaches the server, **Then** it is rejected.
6. **Given** an inactive variant, **When** someone tries to use it in a new line, **Then** it is rejected, and it does not appear in the picker.
7. **Given** a product with variants, **When** a new line tries to use it without a variant, **Then** it is rejected with "Selecciona una variante".
8. **Given** a variant without enough stock, **When** the order is created, **Then** it is rejected with an insufficient-stock message naming the product and the variant.

---

### User Story 4 - Historial entendible (Priority: P2)

Orders and quotes keep showing which variant was sold, even if the product or the variant is later renamed, deactivated, or its price or SKU changes.

**Independent Test**: sell "Amarilla", rename it to "Ámbar" and deactivate it. The old order still says "Variante: Amarilla".

**Acceptance Scenarios**:

1. **Given** an order with variant "Amarilla", **When** the variant is renamed or deactivated, **Then** the order still shows "Amarilla".
2. **Given** historical orders of a product created before it had variants, **When** the product turns on variants, **Then** those orders don't change (lines, totals, display).
3. **Given** a historical line without a variant, of a product that now has variants, **When** the order is edited, **Then** the line can be kept or removed, and it does not move stock at product level (that stock was distributed at conversion).

---

### Edge Cases

- **A combo and a product with variants:** a product with variants can't be a component. A product that is a component can't turn on variants. A combo can't have variants (decision 7).
- **A product with variants and no active variant:** it shows 0 available and cannot be sold.
- **Product price changed:** variants without their own price follow it. Existing lines keep their price (they already store it).
- **Many combinations:** at most 100 variants per product, to prevent an accidental explosion (e.g. 5 × 5 × 5 = 125).
- **Variant stock with stock control off at product level:** variants don't control stock either (the product flag applies to all of them).
- **AI:**
  - the catalog and product search show variants with their price;
  - the availability check for a product with variants returns each variant and the total;
  - the AI order tools do not select variants (they don't move stock today either). This is recorded as a limitation.

## Requirements *(mandatory)*

### Functional Requirements

**Configuration**

- **FR-001**: Every product MUST have "tiene variantes" (default no). With it off, the product form and the product behave exactly as today.
- **FR-002**: With variants on, the user MUST be able to:
  - define 1 to 3 attributes, each with a name and 1 or more unique values;
  - generate every combination as a variant.
- **FR-003**: Each variant MUST have: a name derived from its values (e.g. "Amarilla / Grande"), an optional SKU, an optional price (empty = product price), its own stock, and an active state.
- **FR-004**: The system MUST reject: duplicate combinations, repeated values within an attribute, repeated SKUs within the product, and more than 100 variants.
- **FR-005**: When saving, variants that are no longer in the configuration MUST be deactivated if they have ever been used in an order or quote, and deleted otherwise. Combinations that remain MUST keep their SKU, price and stock.

**Stock**

- **FR-006**: The source of truth for stock MUST be:
  - the product itself, if it has no variants;
  - each variant, if it has variants.
- **FR-007**: The total stock of a product with variants MUST be the sum of its active variants. It MUST NOT be stored as a separate stock.
- **FR-008**: Turning on variants in a product with stock control and stock > 0 MUST require the variants' stock to add up exactly to the current stock. Transferring it (variants get their stock, product drops to 0) MUST be a single atomic operation.
- **FR-009**: Turning off variants MUST only be allowed if no variant has ever been used. When allowed, the sum of the variants' stock MUST go back to the product in a single operation.
- **FR-010**: Stock movements when creating, editing or generating an order MUST follow exactly today's rules. For a line with a variant, the stock that moves is the variant's.

**Sales**

- **FR-011**: The product picker in orders and quotes MUST show products with variants as a single product and ask for the variant on selection. Only active variants are listed, with their price and availability.
- **FR-012**: A new line of a product with variants MUST reference an active variant of that same product and company. The server MUST validate this.
- **FR-013**: An order line or quote line with a variant MUST record the variant and the variant's name at that moment (snapshot). Converting a quote to an order MUST keep them.
- **FR-014**: Order and quote screens (detail and copied text) MUST show the variant from the snapshot next to the product.

**Compatibility**

- **FR-015**: After the migration, every existing product MUST be "sin variantes", with the same price, SKU and stock.
- **FR-016**: Historical lines MUST NOT be modified. Lines of products that later turn on variants MUST still show correctly.
- **FR-017**: Existing contracts (server actions, AI tools) MUST keep accepting just `productoId` for products without variants.
- **FR-018**: Combos (029) MUST keep working as they do. Products with variants cannot take part in combos yet.

### Key Entities

- **Producto** (existing): gains "tiene variantes" and the definition of its attributes (name + values).
- **Variante de producto** (new): belongs to a product. It has values per attribute, a derived name, SKU, price (optional), stock, active state and order. Each combination is unique within the product.
- **Línea de pedido / de cotización** (existing): gain an optional reference to the variant, plus the variant's name at the moment of the sale.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing products keep the same price, SKU, stock and behavior after the migration (existing tests pass without changes).
- **SC-002**: Converting a product with stock N always leaves variants that add up to N. 0 cases of duplicated or lost stock in the tests.
- **SC-003**: A user configures a product with 2 attributes (2 × 3) and loads SKU and stock for the 6 variants in under 3 minutes, without leaving the product screen.
- **SC-004**: Adding a variant to an order takes at most one extra click (choosing the variant) compared to a product without variants.
- **SC-005**: 100% of historical lines with a variant still show the right variant after it is renamed, deactivated or has its price changed.
- **SC-006**: 0 lines are accepted with a variant from another product or company, or with an inactive variant (server tests).

## Assumptions

- **Cost:** `Producto` has no cost field today, so variant cost is out of scope ("si corresponde").
- **SKU at conversion:** the product keeps its SKU as the product's reference. The variants' SKUs are entered by the user.
- **Stock control:** the product's "manejaStock" flag applies to all its variants. Controlling stock per variant for only some variants is not supported.
- **AI order and quote tools:** they are not changed. They don't select variants, same as today when they don't move stock (known limitation).
- **Preparación:** it shows the line description, which already includes the variant, and groups by product.
- **Number of attributes:** at most 3 per product, which covers the typical cases (color, size, material) without complicating the UI.
