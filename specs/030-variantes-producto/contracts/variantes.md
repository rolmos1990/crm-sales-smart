# Contracts: 030-variantes-producto

## 1. `src/shared/productos/variantes.ts` (pure)

```ts
type AtributoVariante = { nombre: string; valores: string[] };
type ValoresVariante = Record<string, string>;

generarCombinaciones(atributos): ValoresVariante[]          // producto cartesiano, orden estable
claveVariante(valores, atributos): string                    // normalizada (minúsculas, trim, orden de atributos)
nombreVariante(valores, atributos): string                   // "Amarilla / Grande"
validarConfiguracionVariantes(atributos, variantes): string | null
planConversionStock({ stockActual, manejaStock, variantes }): { ok: true } | { ok: false; error: string }
```

Configuration errors:
- `"Agrega al menos un atributo con valores"`
- `"Máximo 3 atributos por producto"`
- `"El atributo «X» está repetido"`
- `"El valor «Y» está repetido en «X»"`
- `"La combinación «Amarilla / Grande» está duplicada"`
- `"El SKU «S» se repite en más de una variante"`
- `"Máximo 100 variantes por producto"`
- `"La variante «N» no coincide con los atributos del producto"`

Conversion error: `"Distribuye el stock actual (10) entre las variantes: asignado 9"`

## 2. Product Server Actions (extended input)

`CrearProductoSchema` gains:
- `tieneVariantes?: boolean`
- `atributosVariantes?: { nombre: string; valores: string[] }[]`
- `variantes?: { id?: string; valores: Record<string,string>; sku?: string; precio?: number | null; cantidadDisponible?: number; activo?: boolean }[]`

Errors, besides the ones in §1:
- `"Un combo no puede tener variantes"`
- `"Este producto es componente de «X» y no puede tener variantes"`
- `"No se pueden desactivar las variantes: ya hay ventas de alguna variante. Desactiva variantes individuales en su lugar"`
- `"Variante no encontrada"` (the id does not belong to the product)

## 3. Order and quote lines

`LineaPedidoSchema` and `LineaCotizacionSchema` gain `varianteId?: string | ""`.

Rejected with `{ exito: false, error }`:
- `"Selecciona una variante de «P»"`
- `"La variante seleccionada no pertenece a «P»"`
- `"La variante «V» de «P» no está activa"`
- `"«P» no tiene variantes"`

## 4. Catalog

```ts
interface VarianteCatalogo { id; nombre; sku: string | null; precio: number /* efectivo */; disponibilidad: number | null; activo: boolean }
ProductoCatalogo += { tieneVariantes: boolean; variantes: VarianteCatalogo[] }
```

- For a product with variants, `disponibilidad` = Σ active variants, or `null` if the product has no stock control.
- `SelectorProductoLinea` changes:
  - `onSeleccionar(producto, variante?)`;
  - new optional prop `varianteId?`.
