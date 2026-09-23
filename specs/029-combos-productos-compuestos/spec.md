# Feature Specification: Combos (productos compuestos)

**Feature Branch**: `[029-combos-productos-compuestos]`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "Quiero agregar a Karia el concepto de Combo / Producto compuesto, integrado con el sistema actual de Productos, Inventario, Cotizaciones y Pedidos. [...] Un Combo es un producto vendible que está compuesto por uno o varios productos existentes. [...] El precio del combo es independiente de la suma de los precios individuales. [...] No crear stock independiente para el combo. [...] disponible = MIN(stockComponente / cantidadRequerida) [...] Respetar exactamente el momento actual en que Karia descuenta/revierte inventario [...] Disponible para venta directa [...] filtros rápidos [ Todos ] [ Productos ] [ Combos ] [...] Productos mostrados al crear pedidos: Todos / Solo productos / Solo combos [...] Si se modifica la composición de un combo, no debe cambiar retroactivamente qué compró el cliente." (full request, sections 1-12, in the conversation that originated this spec)

## Clasificación

**Feature.** Karia never had composite products. There is no model or screen that relates one product to others.

## Decisiones de diseño ya acordadas

These decisions were made with the user or come from the analysis of the current code before this spec was written. `/speckit-plan` inherits them and does not reopen them.

1. **No new product type.** Every product keeps its current type (physical, service, digital). Two independent properties are added:
   - "Es combo", default no;
   - "Disponible para venta directa", default yes.
2. **Combos are built only from simple products.** A combo cannot contain another combo, and a product that is already a component of some combo cannot be turned into a combo. Chosen by the user over nested combos. With one level only, cycles (direct or indirect) are impossible by construction.
3. **The combo has no stock of its own.** Its availability is computed from its components.
4. **Stock timing is exactly what it is today.**

   Analysis of the current code: Karia deducts stock at three points only:
   - when an order is created;
   - when an order is edited: it returns stock for removed lines or reduced quantities, and deducts for new lines or increased quantities;
   - when the order is generated from an approved quote.

   Today Karia does not return stock when an order is cancelled, deleted, changes status or moves stage. The combo follows the same rules: at each of those points, the stock that moves is the components' stock. Changing when stock is returned is out of scope (see Assumptions).
5. **Composition snapshot.** Each order line that sells a combo records which components, in what quantities, were used at that moment. Later changes to the combo do not affect orders already created or the stock returned when they are edited.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear y editar un combo desde Productos (Priority: P1)

A non-technical user creates "Luminaria Luna Grande" as a new product with its own price ($26):
1. They turn on "Este producto es un combo".
2. They add "Base Luminaria Grande × 1" and "Esfera Luna Grande × 1".
3. They save.

While configuring, they see the combined value of the components ($25) as an internal reference only.

**Why this priority**: without combos configured, nothing else in the feature has anything to work with.

**Independent Test**: create the combo from Productos → Nuevo producto, save, reopen it, and check that the components and quantities were kept.

**Acceptance Scenarios**:

1. **Given** existing products Base ($15, stock 15) and Esfera ($10, stock 10), **When** the user creates the combo with Base × 1 and Esfera × 1 and price $26, **Then** the combo is saved with those two components and its own price of $26.
2. **Given** a product being configured as a combo, **When** the user adds a component that is already in the list, **Then** it is not duplicated: its quantity increases.
3. **Given** the combo toggle on and no components, **When** the user tries to save, **Then** the system blocks it with "Un combo necesita al menos un componente".
4. **Given** a combo being edited, **When** the user changes a quantity, removes a component and adds another, **Then** the new composition is saved and orders already created keep their original composition.
5. **Given** a combo, **When** the user searches for a component, **Then** the combo itself and other combos are not offered as options.
6. **Given** a product that is a component of some combo, **When** the user tries to turn it into a combo, **Then** the system blocks it and says which combo uses it.
7. **Given** the combo configuration, **When** the user looks at the component summary, **Then** they see the combined component value ("Valor de los componentes: $25.00") next to the sale price, as a reference.

---

### User Story 2 - Vender un combo y que el inventario de sus componentes se mueva correctamente (Priority: P1)

The user adds "2 × Luminaria Luna Grande" to an order. The order shows a single line, "Luminaria Luna Grande — 2 × $26 — $52". Base and Esfera each go down by 2. If the user later edits the order and removes or reduces the combo line, the components come back exactly as they were deducted.

**Why this priority**: this is the core value. A combo that does not move inventory correctly breaks stock control.

**Independent Test**: with Base 15 and Esfera 10, create an order with 2 combos → Base 13 and Esfera 8. Edit it down to 1 combo → Base 14 and Esfera 9. Remove the line → Base 15 and Esfera 10.

**Acceptance Scenarios**:

1. **Given** Base 15 and Esfera 10, **When** an order with 2 × Luminaria Luna Grande is created, **Then** the order has one line (the combo, 2 × $26 = $52) and the stock ends at Base 13 and Esfera 8. No stock movement is recorded for the combo itself.
2. **Given** a combo that needs 2 Bases and 1 Esfera, **When** 3 combos are sold, **Then** 6 Bases and 3 Esferas are deducted.
3. **Given** an order with 2 combos, **When** it is edited down to 1, **Then** 1 unit of each component is returned (per its quantity per combo). When the line is removed, the rest is returned.
4. **Given** an order created while the combo was Base × 1 + Esfera × 1, and the combo later changed to Base × 2, **When** the old order is edited and the line is removed, **Then** 1 Base and 1 Esfera per combo are returned, per the original composition. The current composition is not used.
5. **Given** an order line whose component stock is not enough, **When** the order is created or edited, **Then** it is rejected with an insufficient-stock message naming the combo and the component that is short.
6. **Given** a component that does not manage stock (e.g. a service), **When** the combo is sold, **Then** only the components that manage stock are deducted.
7. **Given** an order line with a regular product, **When** it is created, edited or removed, **Then** stock behaves exactly as it does today.
8. **Given** an order with combos, **When** it is cancelled, deleted, or moved to another status or stage, **Then** stock does not change, same as today for any product.

---

### User Story 3 - Encontrar combos rápido en el selector de productos (Priority: P1)

When adding products to an order or quote, the product picker offers quick filters **[Todos] [Productos] [Combos]**, keeps the search, and shows combos with a discreet **COMBO** badge and their computed availability ("10 disponibles"). Products marked as not for direct sale (e.g. Base, Esfera) do not appear.

**Why this priority**: it completes the flow the user asked for ("Pedido → Agregar productos → Combos → Luminaria Luna Grande → Agregar").

**Independent Test**: with Base and Esfera marked as not for direct sale and the combo for direct sale, open "Agregar producto" in an order. "Combos" shows only the combo with "10 disponibles"; "Productos" shows no Base or Esfera; "Todos" shows everything for direct sale.

**Acceptance Scenarios**:

1. **Given** the Combos filter, **When** the picker opens, **Then** only combos available for direct sale appear.
2. **Given** the Productos filter, **When** the picker opens, **Then** only products for direct sale that are not combos appear.
3. **Given** the Todos filter, **When** the picker opens, **Then** everything for direct sale appears, combos included, and nothing marked "no venta directa".
4. **Given** a search term, **When** the user changes filter, **Then** the search stays applied.
5. **Given** a combo with Base 20 and Esfera 10 that needs 2 Bases and 1 Esfera, **When** it appears in the picker, **Then** it shows "10 disponibles".
6. **Given** a combo whose component has no stock, **When** it appears in the picker, **Then** it shows "0 disponibles" (sin stock).
7. **Given** a filter with no results, **When** the picker opens, **Then** an empty state explains it and the user can switch filter.
8. **Given** an existing order with a line whose product is no longer for direct sale, **When** it is edited, **Then** that line is still shown correctly with its name. It just can't be picked again as a new line.

---

### User Story 4 - Cotizar un combo y convertir la cotización en pedido (Priority: P2)

A quote shows "Luminaria Luna Grande — Cantidad 2 — $26 — $52", with no internal components. When the quote is approved and the order is generated, the order keeps the combo line, and inventory deducts the components at that moment (as happens today with regular products).

**Why this priority**: it extends the same behavior to the other sales channel. It depends on stories 1-3.

**Independent Test**: quote 2 combos, approve the quote. The generated order has the combo line and Base and Esfera went down by 2.

**Acceptance Scenarios**:

1. **Given** a quote with 2 combos, **When** it is viewed or its text is copied to send to the customer, **Then** only "Luminaria Luna Grande" with its price appears, never the components or their prices.
2. **Given** an approved quote with combos, **When** the order is generated, **Then** it keeps the combo line, records the composition in effect at that moment, and deducts the components.
3. **Given** a quote with combos whose components are short of stock, **When** someone tries to approve it, **Then** it is rejected with the same insufficient-stock message as orders.

---

### User Story 5 - Negocios que venden principalmente combos (Priority: P3)

In the company's settings there is a preference, "Productos mostrados al crear pedidos", with the options Todos (default), Solo productos and Solo combos. It only sets which filter the product picker opens with. The user can still change the filter manually.

**Why this priority**: it improves speed for businesses that only sell combos. Without it, the feature works with one extra click.

**Independent Test**: set "Solo combos", open a new order and click "Agregar producto". The picker opens on the Combos filter, and the user can still switch to Todos.

**Acceptance Scenarios**:

1. **Given** the preference "Solo combos", **When** the picker opens in an order or quote, **Then** it starts on the Combos filter.
2. **Given** the preference "Solo combos", **When** the user picks "Todos", **Then** the picker shows everything for direct sale, without restrictions.
3. **Given** a company that never set the preference, **When** the picker opens, **Then** it starts on Todos, as today.

---

### Edge Cases

- **Component deactivated after it was used in a combo:** the combo shows 0 available and cannot be sold until the component is reactivated or replaced.
- **Component quantity:** whole numbers ≥ 1 (e.g. "2 Bases"). A stock that isn't a whole number rounds down when computing availability.
- **Combo with every component outside stock control:** availability is "sin control de stock", the same as a regular product without stock control. Nothing blocks the sale.
- **The same combo twice in one order,** or a combo plus one of its components sold separately: stock is checked against the combined total of each component across the whole order.
- **The combo's own stock:** the combo does not manage stock itself. Its "Control de inventario" section is replaced by the computed availability.
- **Turning off "es combo" on a product that already has orders:** existing orders keep their line and snapshot. Later edits to those orders use the snapshot to return stock.
- **Historical orders created before this feature:** they have no composition snapshot and behave exactly as today.
- **AI tools:**
  - the product-search tool and the catalog shown to the AI do not offer products marked "no venta directa";
  - the availability check for a combo is computed from its components.
- **Other companies:** components and combos always belong to the same company. A combo can never use another company's products.

## Requirements *(mandatory)*

### Functional Requirements

**Combo configuration**

- **FR-001**: Every product MUST have the properties "Es combo" (default no) and "Disponible para venta directa" (default yes). Both are editable from the product form.
- **FR-002**: With "Es combo" on, the product form MUST show a "Componentes del combo" section. The user adds existing products with a quantity (whole number ≥ 1), changes quantities and removes components.
- **FR-003**: Adding a product that is already a component MUST increase its quantity instead of duplicating it.
- **FR-004**: The system MUST reject saving a combo with no components.
- **FR-005**: The system MUST reject these components:
  - the combo itself;
  - another combo;
  - a product from another company.
- **FR-006**: The system MUST reject turning on "Es combo" for a product that is a component of some combo, and say which combo uses it.
- **FR-007**: While configuring, the form MUST show the combined component value (Σ component price × quantity) next to the combo's sale price, as an internal reference.
- **FR-008**: The combo's sale price MUST be its own and independent of the component value.
- **FR-009**: A combo MUST NOT have stock of its own. Its inventory control is replaced by the computed availability.

**Availability**

- **FR-010**: A combo's availability MUST be the minimum, over the components that manage stock, of ⌊component stock / quantity per combo⌋.
  - If none of its components manages stock, the combo is "sin control de stock".
  - An inactive component, or one with no stock, makes availability 0.
- **FR-011**: Stock checks for orders and quotes MUST add up the total demand for each component across the whole document: combos expanded into their components, plus direct sales of the same product.

**Sales and inventory**

- **FR-012**: An order or quote line that sells a combo MUST show and store the combo as the product sold (name, quantity, combo price, total). The components MUST NOT be shown on screen, in copied text, or in any customer-facing document.
- **FR-013**: When an order is created, and when an order is generated from an approved quote, the system MUST deduct each component that manages stock by (quantity sold × quantity per combo). It MUST NOT record any stock movement for the combo.
- **FR-014**: When an order is edited, the system MUST return or deduct component stock according to the difference between the previous state and the new one. Lines that already existed use the composition recorded in the line; new lines use the current composition.
- **FR-015**: Each order line that sells a combo MUST record its composition at the moment it was created: which components, in what quantity per combo.
- **FR-016**: Cancelling, deleting, changing status or moving stage of an order with combos MUST change stock in exactly the same way as today for any product (today it changes nothing).
- **FR-017**: Order lines with regular products MUST keep exactly today's behavior.

**Product picker**

- **FR-018**: The product picker used in orders and quotes MUST offer the filters Todos, Productos and Combos, keep the search, and show only products available for direct sale:
  - Todos: all of them;
  - Productos: those that are not combos;
  - Combos: only combos.
- **FR-019**: Each combo in the picker MUST show a "COMBO" badge and its computed availability. A product with stock control MUST show its available stock.
- **FR-020**: Lines already saved on existing orders or quotes MUST still show correctly, even if their product is no longer for direct sale.

**Preference**

- **FR-021**: The company's settings MUST offer "Productos mostrados al crear pedidos", with the options Todos (default), Solo productos and Solo combos.
- **FR-022**: The preference MUST only set the picker's initial filter, in orders and in quotes. The user MUST still be able to change the filter manually.

**Compatibility**

- **FR-023**: After the migration, every existing product MUST be "not a combo" and "available for direct sale", and MUST behave exactly as before.
- **FR-024**: Historical orders and quotes MUST NOT change their lines, totals or stock behavior.
- **FR-025**: The AI tools that search products or build the catalog for the AI MUST exclude products marked "no venta directa". The availability check for a combo MUST use FR-010.

### Key Entities

- **Producto** (existing): gains "es combo" and "disponible para venta directa". A combo keeps its own price, type and name.
- **Componente de combo** (new): combo, component product and quantity per combo. A given component appears at most once per combo, and both products belong to the same company.
- **Composición registrada en la línea del pedido** (new): an immutable record, on each order line that sells a combo, of the components and quantities used when the line was created. It is used to return stock correctly on later edits.
- **Configuración de la empresa** (existing): gains the preference "Productos mostrados al crear pedidos".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A non-technical user creates a 2-component combo in under 2 minutes, following Productos → Nuevo → activar combo → agregar componentes → Guardar.
- **SC-002**: In 100% of the test cases (create, edit up, edit down, remove line, quote → order), component stock ends exactly at the expected value, and the combo registers no movement of its own.
- **SC-003**: The availability shown for combos matches the MIN(⌊stock / quantity⌋) formula in 100% of the cases tested, including a component with no stock and quantities > 1.
- **SC-004**: 0 customer-visible documents or texts (quote/order detail, copied text) show components or their prices.
- **SC-005**: With the preference "Solo combos", a user adds a combo to an order in at most 3 clicks from "Agregar producto".
- **SC-006**: Every existing test for products, orders and quotes passes without modification. Existing products keep their exact behavior.
- **SC-007**: Changing a combo's composition changes 0 existing orders: same lines, totals, and stock returned on later edits.

## Assumptions

- **When stock is returned (existing gap, out of scope).** Today Karia does not return stock when an order is cancelled or deleted, only when lines are edited. Per the request ("respetar exactamente el momento actual"), combos inherit that behavior. Fixing it for every product deserves its own Hotfix spec and is left recorded as a finding.
- **AI order tool (existing gap, out of scope).** Today the AI's order-creation tool does not deduct stock for any product. That stays the same.
- **Integer quantities per combo.** Quantities per combo are whole numbers (you sell "2 Bases", not "1.5").
- **Deactivating a combo** uses the existing product deactivation (soft delete). No combo-specific rule is needed.
- **Preparación (picking lists)** shows the combo as the product to prepare, same as the order line. Listing the combo's components on the preparation board is a possible later improvement, out of scope.
- **Quotes** do not deduct or reserve stock (same as today). They only validate stock when approved, now with components expanded.
- **Price:** the combo's price is edited like any other product's price. Changes do not affect existing lines, because the line already keeps its unit price.
