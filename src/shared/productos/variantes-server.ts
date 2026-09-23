import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/prisma";
import type { AtributoVarianteSchema, VarianteEditableInput } from "./schema";
import type { z } from "zod";
import {
  claveVariante,
  nombreVariante,
  planConversionStock,
  validarConfiguracionVariantes,
  type AtributoVariante,
} from "./variantes";

type Db = Prisma.TransactionClient;
type AtributoInput = z.infer<typeof AtributoVarianteSchema>;

/** Estado previo del producto que importa para decidir qué hacer con las variantes. */
export interface ProductoAntesVariantes {
  id: string;
  tieneVariantes: boolean;
  atributosVariantes: unknown;
  manejaStock: boolean;
  cantidadDisponible: number;
}

export interface PlanVariantes {
  /** Campos a escribir en el Producto junto con el resto del formulario. */
  datosProducto: { tieneVariantes?: boolean; atributosVariantes?: Prisma.InputJsonValue | typeof Prisma.JsonNull; cantidadDisponible?: number };
  /** Escrituras de variantes: se ejecutan en la MISMA transacción que el producto. */
  sincronizar?: (tx: Db, productoId: string) => Promise<void>;
}

export function parsearAtributos(valor: unknown): AtributoVariante[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((a): a is AtributoVariante => typeof a === "object" && a !== null && typeof a.nombre === "string" && Array.isArray(a.valores))
    .map((a) => ({ nombre: a.nombre, valores: a.valores.filter((v): v is string => typeof v === "string") }));
}

const limpiarAtributos = (atributos: AtributoInput[]): AtributoVariante[] =>
  atributos
    .map((a) => ({ nombre: a.nombre.trim(), valores: a.valores.map((v) => v.trim()).filter(Boolean) }))
    .filter((a) => a.nombre || a.valores.length > 0);

/**
 * 030-variantes-producto — decide y valida qué pasa con las variantes al
 * guardar un producto. Nada se escribe acá: devuelve los campos del producto
 * y una función de sincronización para correr dentro de la transacción.
 *
 * Fuente de verdad del stock: sin variantes, el producto; con variantes,
 * cada variante (el producto queda en 0). Convertir y apagar son
 * transferencias que conservan el total.
 */
export async function prepararVariantes(params: {
  instanciaId: string;
  antes: ProductoAntesVariantes | null;
  esCombo: boolean;
  manejaStock: boolean;
  tieneVariantes: boolean | undefined;
  atributosVariantes: AtributoInput[] | undefined;
  variantes: VarianteEditableInput[] | undefined;
}): Promise<{ error: string } | PlanVariantes> {
  const { instanciaId, antes } = params;
  const teniaVariantes = antes?.tieneVariantes ?? false;
  const tieneVariantes = params.tieneVariantes ?? teniaVariantes;

  // ── Apagar variantes ─────────────────────────────────────────────────────
  if (!tieneVariantes) {
    if (!teniaVariantes || !antes) return { datosProducto: params.tieneVariantes === false ? { tieneVariantes: false } : {} };

    const existentes = await prisma.productoVariante.findMany({
      where: { productoId: antes.id },
      select: { cantidadDisponible: true, _count: { select: { pedidoLineas: true, cotizacionLineas: true } } },
    });
    if (existentes.some((v) => v._count.pedidoLineas + v._count.cotizacionLineas > 0)) {
      return {
        error: "No se pueden desactivar las variantes: ya hay ventas de alguna variante. Desactiva variantes individuales en su lugar",
      };
    }
    // El stock vuelve al producto: misma cantidad total, sin duplicar.
    const total = existentes.reduce((acc, v) => acc + Number(v.cantidadDisponible), 0);
    return {
      datosProducto: { tieneVariantes: false, atributosVariantes: Prisma.JsonNull, cantidadDisponible: total },
      sincronizar: async (tx, productoId) => {
        await tx.productoVariante.deleteMany({ where: { productoId } });
      },
    };
  }

  // ── Con variantes ────────────────────────────────────────────────────────
  if (params.esCombo) return { error: "Un combo no puede tener variantes" };
  if (antes && !teniaVariantes) {
    const usadoEn = await prisma.productoComponente.findFirst({
      where: { componenteId: antes.id, combo: { instanciaId } },
      select: { combo: { select: { nombre: true } } },
    });
    if (usadoEn) return { error: `Este producto es componente de «${usadoEn.combo.nombre}» y no puede tener variantes` };
  }

  // Sin variantes en el payload (ej. se editó solo el precio): se conservan.
  if (params.variantes === undefined && teniaVariantes) return { datosProducto: { cantidadDisponible: 0 } };

  const atributos = limpiarAtributos(params.atributosVariantes ?? parsearAtributos(antes?.atributosVariantes));
  const entrada = params.variantes ?? [];
  const error = validarConfiguracionVariantes(atributos, entrada.map((v) => ({ valores: v.valores, sku: v.sku })));
  if (error) return { error };

  // Conversión de un producto existente: el stock actual se REPARTE entre las
  // variantes (la suma tiene que coincidir), nunca se copia a cada una.
  if (antes && !teniaVariantes) {
    const conversion = planConversionStock({
      stockActual: antes.cantidadDisponible,
      manejaStock: antes.manejaStock,
      stockVariantes: entrada.map((v) => v.cantidadDisponible ?? 0),
    });
    if (!conversion.ok) return { error: conversion.error };
  }

  const existentes = antes
    ? await prisma.productoVariante.findMany({
        where: { productoId: antes.id },
        select: { id: true, clave: true, _count: { select: { pedidoLineas: true, cotizacionLineas: true } } },
      })
    : [];
  const existentePorId = new Map(existentes.map((v) => [v.id, v]));
  const existentePorClave = new Map(existentes.map((v) => [v.clave, v]));

  // Cada variante del formulario se empareja con una guardada (por id o por
  // combinación) para conservar su SKU/stock/historial; si no, es nueva.
  const planificadas: { id?: string; datos: Prisma.ProductoVarianteUncheckedCreateInput }[] = [];
  const emparejadas = new Set<string>();
  for (const [orden, v] of entrada.entries()) {
    if (v.id && !existentePorId.has(v.id)) return { error: "Variante no encontrada" };
    const clave = claveVariante(v.valores, atributos);
    const candidata = (v.id ? existentePorId.get(v.id) : undefined) ?? existentePorClave.get(clave);
    // Una variante guardada se empareja una sola vez (si dos filas apuntan a
    // la misma, la segunda es nueva).
    const existente = candidata && !emparejadas.has(candidata.id) ? candidata : undefined;
    if (existente) emparejadas.add(existente.id);
    planificadas.push({
      id: existente?.id,
      datos: {
        productoId: antes?.id ?? "",
        valores: normalizarValores(v.valores, atributos),
        clave,
        nombre: nombreVariante(v.valores, atributos),
        sku: v.sku?.trim() || null,
        precio: v.precio ?? null,
        cantidadDisponible: v.cantidadDisponible ?? 0,
        activo: v.activo ?? true,
        orden,
      },
    });
  }

  const usadas = new Set(planificadas.map((p) => p.id).filter(Boolean));
  const sobrantes = existentes.filter((v) => !usadas.has(v.id));

  return {
    datosProducto: {
      tieneVariantes: true,
      atributosVariantes: atributos as unknown as Prisma.InputJsonValue,
      cantidadDisponible: 0,
    },
    sincronizar: async (tx, productoId) => {
      // Primero se liberan las combinaciones que desaparecen, para que una
      // variante nueva pueda reutilizar su clave sin chocar con el unique.
      for (const v of sobrantes) {
        if (v._count.pedidoLineas + v._count.cotizacionLineas > 0) {
          await tx.productoVariante.update({ where: { id: v.id }, data: { activo: false } });
        } else {
          await tx.productoVariante.delete({ where: { id: v.id } });
        }
      }
      for (const p of planificadas) {
        const datos = { ...p.datos, productoId };
        if (p.id) {
          const { productoId: _p, ...cambios } = datos;
          await tx.productoVariante.update({ where: { id: p.id }, data: cambios });
        } else {
          await tx.productoVariante.create({ data: datos });
        }
      }
    },
  };
}

function normalizarValores(valores: Record<string, string>, atributos: AtributoVariante[]): Prisma.InputJsonValue {
  return Object.fromEntries(atributos.map((a) => [a.nombre, (valores[a.nombre] ?? "").trim()]));
}

