# Implementation Plan: Combos (productos compuestos)

**Branch**: `029-combos-productos-compuestos` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/029-combos-productos-compuestos/spec.md`

## Summary

Everything below is one small layer on top of the existing product catalog. No new screens.

**Data**
- `Producto` gains `esCombo` and `ventaDirecta`.
- A new `ProductoComponente` table holds (combo, component, quantity).
- `PedidoLinea` gains `composicionCombo`, a JSON snapshot of the combo's components at the time the line is created.

**One pure inventory function** (`src/shared/productos/inventario.ts`)
- It expands order lines into "consumption per product" (a combo becomes its components) and computes the stock difference between two states of a document.
- It replaces the per-line stock logic that is duplicated today in four places:
  - `crearPedido`
  - `editarPedido`
  - `aprobarCotizacion`
  - `generarPedidoDesdeCotizacion`
- The deduct and return moments do not change.

**Catalog and picker**
- The catalog query returns `esCombo`, `ventaDirecta` and the computed availability.
- The shared picker `SelectorProductoLinea` gains:
  - Todos / Productos / Combos tabs, with an initial value set by the company preference;
  - a COMBO badge;
  - availability shown per item.

**Product form**
- A "Este producto es un combo" section with a component editor.
- A "Disponible para venta directa" toggle.

**Company settings**
- `ConfiguracionEmpresa.filtroProductosPedido`, edited in the Preferencias tab.

## Technical Context

**Language/Version**: TypeScript 5, Node 20+

**Primary Dependencies**: Next.js 15 App Router, Prisma 7, Zod v4, React Hook Form, shadcn/ui (cmdk Command, Base UI Select)

**Storage**: PostgreSQL. One additive migration:
- 2 columns on `Producto` (with defaults);
- 1 nullable column on `PedidoLinea`;
- 1 new table;
- 1 enum plus 1 column on `ConfiguracionEmpresa`.

**Testing**: Vitest. The pure inventory and availability functions get exhaustive unit tests. Product actions and the picker filter get unit tests with mocks.

**Target Platform**: web app plus worker (the quote → order generation runs in the RabbitMQ consumer)

**Project Type**: web application

**Performance Goals**: the catalog adds one include (the components of each combo) to the existing query. It is still one query, no N+1.

**Constraints**:
- Existing products behave exactly the same (FR-023).
- Historical orders stay untouched (FR-024).
- The deduct and return moments stay the same (FR-016).
- Tenant isolation: components are always validated against `instanciaId`.

**Scale/Scope**: typical catalogs of dozens to hundreds of products; combos with 1–10 components.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Modular architecture | ✅ Everything lives inside `src/shared/productos` (model, catalog, inventory) and the existing sales modules. The stock logic ends up in one function instead of the current 4 copies. |
| II. Rules enforced on the server | ✅ Composition rules (at least 1 component, no self, no combos, same tenant, a component can't become a combo) and stock checks run in Server Actions with Zod plus DB queries. The UI only helps. |
| III. Reliable data | ✅ Components are saved in a transaction (replace all of them). In the quote → order path, stock is deducted inside the existing transaction. In `crearPedido`/`editarPedido`, stock keeps running outside the main transaction as it does today: moving it inside is a separate behavior change, recorded in research.md D6. |
| IV. Integrations | ✅ No new integration. The AI tools only read `ventaDirecta`/`esCombo`. |
| V. Security and quality | ✅ `instanciaId` is checked on every component read and write. Pure-function tests cover every case the user listed. |
| Migrations | ✅ Additive with defaults: `esCombo=false`, `ventaDirecta=true`, `filtroProductosPedido=TODOS`. |

**Result**: no violations.

## Project Structure

```text
prisma/schema.prisma                                    # Producto +2, ProductoComponente, PedidoLinea +1, ConfiguracionEmpresa +1, enum
prisma/migrations/<ts>_combos_productos_compuestos/

src/shared/productos/
├── inventario.ts            # NEW (pure): expandirConsumo, diferenciaConsumo, calcularDisponibilidad
├── inventario.test.ts       # NEW
├── stock.ts                 # NEW (server): cargar composiciones/stock, validar y aplicar deltas
├── schema.ts                # esCombo, ventaDirecta, componentes[]
├── actions.ts               # crear/actualizar with composition rules; combo → manejaStock=false
├── actions-combo.test.ts    # NEW
├── queries.ts               # catalog with esCombo/ventaDirecta/disponibilidad; productosParaComponentes
├── types.ts                 # ProductoCatalogo +3, FiltroCatalogo
└── components/
    ├── form-producto.tsx               # combo section + venta directa toggle
    ├── editor-componentes-combo.tsx    # NEW
    ├── selector-producto-linea.tsx     # tabs, badge, availability, hide ventaDirecta=false
    └── filtro-catalogo.ts              # NEW (pure): filtrarCatalogo + tests

src/sales/pedidos/actions.ts                            # crearPedido/editarPedido → stock.ts
src/sales/cotizaciones/actions.ts                       # aprobarCotizacion → stock.ts
src/sales/cotizaciones/services/generar-pedido-desde-cotizacion.service.ts   # → stock.ts inside the tx + snapshot
src/sales/pedidos/components/{form-pedido,dialog-editar-pedido}.tsx         # filtroInicial
src/sales/cotizaciones/components/form-cotizacion.tsx                        # filtroInicial
src/app/sales/pedidos/{nuevo,[id]}/page.tsx, src/app/sales/cotizaciones/{nueva,[id]/editar}/page.tsx, obtenerDatosFormularioCotizacion
src/app/productos/{nuevo,[id]/editar}/page.tsx         # pass products that can be components
src/configuracion/empresa/{schema,actions}.ts + components/tab-preferencias.tsx
src/ai/tools/providers/{product.tool,consultar-disponibilidad.tool}.ts, src/ai/contexto/capas/catalogo.ts
```

## Complexity Tracking

No violations.
