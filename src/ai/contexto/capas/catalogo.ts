// 028-respuestas-guia-catalogo-ia — capa 8 real ("Información operativa
// verificada"): el catálogo vigente con sus precios. Sin esto, ante un
// "precio por favor" sin producto la IA no tenía término para buscar y la
// regla anti-invención la empujaba a preguntar en vez de responder.

import { prisma } from "@/shared/db/prisma";

export const LIMITE_CATALOGO_DEFECTO = 30;

export interface InsumosCapaCatalogo {
  instanciaId: string;
  activo: boolean;
  limite: number;
}

// Tolerante a fallo (mismo criterio que las capas 4/5/9): si la consulta
// falla, la respuesta se genera igual, sin catálogo.
export async function producirCapaCatalogo({ instanciaId, activo, limite }: InsumosCapaCatalogo): Promise<string | null> {
  if (!activo) return null;

  try {
    // `limite + 1` dice si hay más productos sin un `count` aparte.
    const productos = await prisma.producto.findMany({
      // 029 — sin piezas que solo se venden dentro de un combo.
      where: { instanciaId, activo: true, ventaDirecta: true, precio: { gt: 0 } },
      orderBy: [{ actualizadoEn: "desc" }],
      take: limite + 1,
      select: { nombre: true, sku: true, precio: true, moneda: true, unidad: true, categoria: true },
    });
    if (productos.length === 0) return null;

    const hayMas = productos.length > limite;
    const lineas = productos.slice(0, limite).map((p) => {
      const sku = p.sku ? ` (${p.sku})` : "";
      const categoria = p.categoria ? ` · ${p.categoria}` : "";
      return `- ${p.nombre}${sku} — ${Number(p.precio).toFixed(2)} ${p.moneda} / ${p.unidad}${categoria}`;
    });

    return [
      "Catálogo vigente de la empresa (precios reales, úsalos tal cual):",
      ...lineas,
      ...(hayMas ? ["Hay más productos que no aparecen en esta lista: usa buscar_productos para encontrarlos."] : []),
    ].join("\n");
  } catch (err) {
    console.error("[capa-catalogo] No se pudo cargar el catálogo:", err instanceof Error ? err.message : err);
    return null;
  }
}
