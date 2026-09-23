# Data Model: 030-variantes-producto

## Producto (existing): new fields

| Field | Type | Default | Rule |
|---|---|---|---|
| `tieneVariantes` | Boolean | false | Mutually exclusive with `esCombo`. While true, `cantidadDisponible` stays at 0: the stock lives in the variants. |
| `atributosVariantes` | Json? | null | `[{ nombre: string, valores: string[] }]`. 1–3 attributes; unique names; unique, non-empty values. |

## ProductoVariante (new)

| Field | Type | Rule |
|---|---|---|
| `id` | cuid | |
| `productoId` | FK Producto, onDelete Cascade | |
| `valores` | Json | `{ [nombreAtributo]: valor }`: exactly one value per attribute of the product |
| `clave` | String | normalized combination; `@@unique([productoId, clave])` |
| `nombre` | String | derived: values joined with " / ", in attribute order |
| `sku` | String? | unique within the product (validated on the server) |
| `precio` | Decimal? | null = uses `Producto.precio` |
| `cantidadDisponible` | Decimal, default 0 | only meaningful if `Producto.manejaStock` |
| `activo` | Boolean, default true | inactive = not offered in new sales |
| `orden` | Int, default 0 | order within the table |
| `creadoEn` / `actualizadoEn` | DateTime | |

Relations: `pedidoLineas PedidoLinea[]` and `cotizacionLineas CotizacionLinea[]`. The FK from the lines uses `onDelete: Restrict`: a variant with history is never deleted, only deactivated.

## PedidoLinea / CotizacionLinea (existing): new fields

| Field | Type | Rule |
|---|---|---|
| `varianteId` | String?, FK ProductoVariante (Restrict) | must belong to `productoId` (validated on the server) |
| `varianteNombre` | String? | snapshot of the name at the time of the sale; not rewritten afterwards |

## Migration

Additive only. Existing products get `tieneVariantes = false`, and existing lines get `varianteId = NULL`. Nothing is backfilled.
