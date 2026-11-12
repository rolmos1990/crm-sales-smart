import type { ProductoListado, TipoProducto } from "./types";

export type PestanaProductos = "TODOS" | "COMBOS" | "VENTA_DIRECTA" | "SERVICIOS" | "DIGITALES";
export type EstadoFiltro = "ACTIVOS" | "INACTIVOS" | "TODOS";
export type VentaFiltro = "TODOS" | "VENTA_DIRECTA" | "SOLO_COMBOS";

export interface FiltrosProductos {
  pestana: PestanaProductos;
  busqueda: string;
  estado: EstadoFiltro;
  tipo: "TODOS" | TipoProducto;
  venta: VentaFiltro;
  /** Coincide con cualquiera de las categorías elegidas. */
  categorias: string[];
  /** El producto debe tener TODAS las etiquetas elegidas (ej. Esfera + Pequeña). */
  etiquetaIds: string[];
}

export const FILTROS_INICIALES: FiltrosProductos = {
  pestana: "TODOS",
  busqueda: "",
  estado: "ACTIVOS",
  tipo: "TODOS",
  venta: "TODOS",
  categorias: [],
  etiquetaIds: [],
};

export const PESTANAS_PRODUCTOS: { valor: PestanaProductos; etiqueta: string }[] = [
  { valor: "TODOS", etiqueta: "Todos" },
  { valor: "COMBOS", etiqueta: "Combos" },
  { valor: "VENTA_DIRECTA", etiqueta: "Venta directa" },
  { valor: "SERVICIOS", etiqueta: "Servicios" },
  { valor: "DIGITALES", etiqueta: "Digitales" },
];

/** Minúsculas y sin tildes: "pequeña" encuentra "Pequena" y viceversa. */
export function normalizarTexto(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function cumplePestana(p: ProductoListado, pestana: PestanaProductos): boolean {
  switch (pestana) {
    case "COMBOS":
      return p.esCombo;
    case "VENTA_DIRECTA":
      return p.ventaDirecta;
    case "SERVICIOS":
      return p.tipo === "SERVICIO";
    case "DIGITALES":
      return p.tipo === "DIGITAL";
    default:
      return true;
  }
}

function cumpleFiltros(p: ProductoListado, f: Omit<FiltrosProductos, "pestana">): boolean {
  if (f.estado === "ACTIVOS" && !p.activo) return false;
  if (f.estado === "INACTIVOS" && p.activo) return false;
  if (f.tipo !== "TODOS" && p.tipo !== f.tipo) return false;
  if (f.venta === "VENTA_DIRECTA" && !p.ventaDirecta) return false;
  if (f.venta === "SOLO_COMBOS" && p.ventaDirecta) return false;
  if (f.categorias.length > 0 && !f.categorias.includes(p.categoria ?? "")) return false;
  if (f.etiquetaIds.length > 0) {
    const propias = new Set(p.etiquetas.map((e) => e.id));
    if (!f.etiquetaIds.every((id) => propias.has(id))) return false;
  }
  const busqueda = normalizarTexto(f.busqueda);
  if (busqueda) {
    const texto = normalizarTexto(
      [p.nombre, p.sku, p.descripcion, p.categoria, ...p.etiquetas.map((e) => e.nombre)].filter(Boolean).join(" "),
    );
    if (!busqueda.split(/\s+/).every((palabra) => texto.includes(palabra))) return false;
  }
  return true;
}

export function filtrarProductos(productos: ProductoListado[], filtros: FiltrosProductos): ProductoListado[] {
  return productos.filter((p) => cumplePestana(p, filtros.pestana) && cumpleFiltros(p, filtros));
}

/** Conteo de cada pestaña con el resto de los filtros aplicados. */
export function contarPorPestana(productos: ProductoListado[], filtros: FiltrosProductos): Record<PestanaProductos, number> {
  const base = productos.filter((p) => cumpleFiltros(p, filtros));
  return Object.fromEntries(
    PESTANAS_PRODUCTOS.map(({ valor }) => [valor, base.filter((p) => cumplePestana(p, valor)).length]),
  ) as Record<PestanaProductos, number>;
}

/** true si hay algo que "Limpiar" (la pestaña no cuenta: es navegación). */
export function hayFiltrosActivos(f: FiltrosProductos): boolean {
  return (
    f.busqueda.trim() !== "" ||
    f.estado !== FILTROS_INICIALES.estado ||
    f.tipo !== "TODOS" ||
    f.venta !== "TODOS" ||
    f.categorias.length > 0 ||
    f.etiquetaIds.length > 0
  );
}

/** Categorías distintas presentes en el catálogo, ordenadas. */
export function categoriasDisponibles(productos: ProductoListado[]): string[] {
  return [...new Set(productos.map((p) => p.categoria).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b));
}
