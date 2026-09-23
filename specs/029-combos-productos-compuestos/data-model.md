# Data Model: 029-combos-productos-compuestos

## Producto (existing): new fields

| Field | Type | Default | Rule |
|---|---|---|---|
| `esCombo` | Boolean | false | If true: at least 1 component, and `manejaStock` is forced to false. It can't be turned on if the product is a component of some combo. |
| `ventaDirecta` | Boolean | true | If false, the product doesn't appear in the order and quote picker, but it can still be used as a component. |

New relations:
- `componentes ProductoComponente[] @relation("ComboComponentes")`
- `usadoEnCombos ProductoComponente[] @relation("ComponenteDeCombos")`

## ProductoComponente (new)

| Field | Type | Rule |
|---|---|---|
| `id` | cuid | |
| `comboId` | FK Producto, onDelete Cascade | the product must have `esCombo = true` |
| `componenteId` | FK Producto, onDelete Restrict | same `instanciaId` as the combo; `esCombo = false`; ≠ `comboId` |
| `cantidad` | Int | ≥ 1 |

- `@@unique([comboId, componenteId])`
- `@@index([componenteId])`
- Saved as "replace all" inside a transaction when the combo is created or edited.

## PedidoLinea (existing): new field

| Field | Type | Rule |
|---|---|---|
| `composicionCombo` | Json? | `[{ productoId: string, nombre: string, cantidad: number }]`. Set when the line is created if its product is a combo, and never updated. `null` = the line consumes its own `productoId` (regular product, or a historical line). |

## ConfiguracionEmpresa (existing): new field

| Field | Type | Default |
|---|---|---|
| `filtroProductosPedido` | `enum FiltroCatalogoVenta { TODOS PRODUCTOS COMBOS }` | `TODOS` |

## Derived types (not persisted)

- `ProductoCatalogo` gains `esCombo: boolean`, `ventaDirecta: boolean` and `disponibilidad: number | null`:
  - number = units that can be sold;
  - null = no stock control.
- `LineaConsumo = { productoId: string | null; cantidad: number; composicion: ComponenteSnapshot[] | null; nombre?: string }`.

## Migration

Additive only. Existing products get `esCombo = false` and `ventaDirecta = true`. Existing lines get `composicionCombo = null`, which behaves as today.
