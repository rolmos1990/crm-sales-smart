# Implementation Plan: Variantes de producto

**Branch**: `030-variantes-producto` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

## Summary

**Schema changes**
- `Producto` gains two fields:
  - `tieneVariantes` (default false);
  - `atributosVariantes Json?`, holding the attribute definitions (configuration, never referenced by history).
- New table `ProductoVariante`, holding each combination: values, `clave` (unique per product), name, SKU, optional price, stock, active state and order.
- `PedidoLinea` and `CotizacionLinea` gain `varianteId?` plus the snapshot `varianteNombre?`.

**Inventory**
- The inventory function from 029 (`inventario.ts`/`stock.ts`) learns a second kind of stock unit: the variant.
- A line with `varianteId` consumes that variant; everything else stays as is.

**Validation and forms**
- The variant-to-product relationship is validated on the server by a single helper (`validarVariantesLineas`), used when orders are created and edited and when quotes are created and edited.
- The shared picker gets one more step to choose the variant.
- The product form gets a "Variantes" card with:
  - the attribute editor;
  - a generated table of combinations;
  - the stock distribution needed when converting an existing product.

## Technical Context

**Language/Version**: TypeScript 5, Node 20+

**Primary Dependencies**: Next.js 15, Prisma 7, Zod v4, React Hook Form, shadcn/ui

**Storage**: PostgreSQL. Additive migration only:
- 2 columns on `Producto`;
- 1 new table;
- 2 columns each on `PedidoLinea` and `CotizacionLinea`.

**Testing**: Vitest.
- Pure logic (combinations, keys, validation, conversion, variant consumption) is tested exhaustively.
- Product actions are tested with mocks.
- `stock-combos.test.ts` gets extended with order flows that use variants.

**Constraints**:
- Products without variants are identical (FR-015).
- History is untouched (FR-016).
- Stock moments are the same as today (FR-010).
- Tenant isolation.
- No duplicated stock: product stock is 0 when `tieneVariantes`, and the transfer is atomic.

**Scale**: at most 3 attributes and 100 variants per product.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Modules | ✅ Everything lives inside `src/shared/productos` plus the existing sales modules. It extends the single inventory function from 029 instead of adding another one. |
| II. Server-enforced rules | ✅ The server validates variant configuration (duplicates, SKU, limits, exclusivity with combos, conversion total) and the variant ↔ product ↔ tenant relationship on every line. |
| III. Reliable data | ✅ Saving a product with variants, converting it and turning variants off each run inside one transaction (product + variants). No stock is duplicated. |
| IV. Integrations | ✅ The AI only reads variants. Its order and quote tools are unchanged (limitation recorded in the spec). |
| V. Security and quality | ✅ `instanciaId` is checked on variants through their product. The user's 24 cases are covered by tests. |
| Migrations | ✅ Additive with defaults (`tieneVariantes=false`); existing products are not touched. |

## Project Structure

```text
prisma/schema.prisma + migrations/<ts>_variantes_producto/

src/shared/productos/
├── variantes.ts              # NEW (pure): combinaciones, clave, nombre, validar configuración, plan de conversión
├── variantes.test.ts         # NEW
├── inventario.ts             # LineaConsumo.varianteId; claves de stock producto|variante
├── stock.ts                  # cargarStock/aplicarDeltas por variante; validarVariantesLineas
├── schema.ts / types.ts      # tieneVariantes, atributosVariantes, variantes[]; VarianteCatalogo
├── actions.ts                # guardar variantes en transacción (conversión, alta, baja/inactivación, apagado)
├── queries.ts                # catálogo con variantes; producto con variantes; excluir de componentes
└── components/
    ├── editor-variantes.tsx          # NEW: atributos + tabla de combinaciones + distribución de stock
    ├── form-producto.tsx             # tarjeta "Este producto tiene variantes"
    └── selector-producto-linea.tsx   # paso de elección de variante

src/sales/pedidos/{schema,actions}.ts, components/{form-pedido,dialog-editar-pedido}.tsx
src/sales/cotizaciones/{schema,actions}.ts, services/generar-pedido-desde-cotizacion.service.ts, components/form-cotizacion.tsx
src/app/sales/pedidos/[id]/page.tsx, src/app/sales/cotizaciones/[id]/page.tsx   # show the snapshot variant
src/sales/flujo-venta/reglas/resolver-hechos.ts        # todosConInventario per variant
src/ai/contexto/capas/catalogo.ts, src/ai/tools/providers/{product,consultar-disponibilidad}.tool.ts
```

## Complexity Tracking

No violations.
