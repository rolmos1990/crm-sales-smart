# Contracts: 029-combos-productos-compuestos

## 1. `src/shared/productos/inventario.ts` (pure, no I/O)

```ts
type ComponenteSnapshot = { productoId: string; nombre: string; cantidad: number };
type LineaConsumo = { productoId: string | null; cantidad: number; composicion: ComponenteSnapshot[] | null; nombre?: string };

expandirConsumo(lineas: LineaConsumo[]): Map<string, { cantidad: number; origenes: string[] }>
diferenciaConsumo(anterior, nuevo): Map<string, { delta: number; origenes: string[] }>
validarDeltas(deltas, stock: Map<string, { nombre; manejaStock; cantidadDisponible }>): string[]   // mensajes de error
calcularDisponibilidadCombo(componentes: { cantidad; manejaStock; cantidadDisponible; activo }[]): number | null
```

Notes:
- `origenes` holds the names of the combos a product's demand comes from. It is used to build the message: `Stock insuficiente para "Base" (componente de "Luminaria Luna Grande"). Disponible: 1 — solicitado: 2`.
- `validarDeltas` ignores products without `manejaStock` and deltas ≤ 0.

## 2. `src/shared/productos/stock.ts` (server)

```ts
cargarComposiciones(productoIds: string[], instanciaId: string, db): Promise<Map<comboId, ComponenteSnapshot[]>>
lineasConComposicionActual(lineas, composiciones): LineaConsumo[]
cargarStock(productoIds: string[], db): Promise<Map<id, { nombre; manejaStock; cantidadDisponible }>>
aplicarDeltas(deltas, stock, db): Promise<void>   // increment/decrement solo manejaStock
```

## 3. Server Actions for products (extended input)

`CrearProductoSchema` gains:
- `esCombo?: boolean`
- `ventaDirecta?: boolean`
- `componentes?: { productoId: string; cantidad: number (int ≥ 1) }[]`

Errors, returned as `{ exito: false, error }`:
- `"Un combo necesita al menos un componente"`
- `"Un combo no puede incluirse a sí mismo"`
- `"Un combo solo puede tener productos simples como componentes"`
- `"Componente no encontrado"` (the product doesn't exist or belongs to another instance)
- `"Este producto es componente de «X» y no puede convertirse en combo"`

## 4. Picker

```ts
type FiltroCatalogo = "TODOS" | "PRODUCTOS" | "COMBOS";
filtrarCatalogo(productos: ProductoCatalogo[], filtro: FiltroCatalogo): ProductoCatalogo[]   // siempre excluye ventaDirecta=false
<SelectorProductoLinea productos productoId onSeleccionar onLimpiar filtroInicial? />
```

- Each combo item shows a `COMBO` badge.
- Every item with stock control shows `"{n} disponibles"`.

## 5. Preference

- `guardarPreferenciaCatalogoVenta({ filtroProductosPedido: "TODOS" | "PRODUCTOS" | "COMBOS" })`
- Requires the permission `configuracion:modificar`, and runs `revalidatePath("/configuracion")`.
