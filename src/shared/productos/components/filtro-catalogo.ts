import type { FiltroCatalogo, ProductoCatalogo } from "../types";

type ProductoFiltrable = Pick<ProductoCatalogo, "esCombo" | "ventaDirecta">;

/**
 * 029-combos-productos-compuestos — qué muestra cada pestaña del selector de
 * productos en pedidos/cotizaciones. Nunca muestra lo que no es de venta
 * directa (p. ej. piezas que solo se venden dentro de un combo).
 */
export function filtrarCatalogo<T extends ProductoFiltrable>(productos: T[], filtro: FiltroCatalogo): T[] {
  return productos.filter((p) => {
    // `?? true`: un producto previo a la migración cuenta como venta directa.
    if (!(p.ventaDirecta ?? true)) return false;
    if (filtro === "COMBOS") return p.esCombo === true;
    if (filtro === "PRODUCTOS") return !p.esCombo;
    return true;
  });
}
