import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/prisma";
import { descifrarToken } from "@/shared/lib/cifrado-tokens";
import { crearProveedorVoz } from "./proveedores/registro";
import { estaImplementadoVoz } from "./proveedores/disponibles";
import type { IProveedorVoz } from "./proveedores/types";

/**
 * 049 — Selección del proveedor de voz de una instancia.
 *
 * Por `prioridad` descendente, saltando los que no tengan credencial. No hay
 * un "proveedor por defecto" en la configuración a propósito: el equivalente
 * en IA (`ConfiguracionIA.proveedorDefault`) quedó muerto porque la selección
 * real siempre fue por prioridad, y duplicar esa decisión en dos lugares solo
 * crea una forma de que discrepen.
 */

export interface SeleccionProveedorVoz {
  proveedor: IProveedorVoz;
  proveedorVozId: string;
  modelo: string;
  costoPorHora: Prisma.Decimal | null;
  limiteMinutosDia: number | null;
  timeoutMs: number;
}

export async function seleccionarProveedorVoz(
  instanciaId: string,
): Promise<SeleccionProveedorVoz | null> {
  const candidatos = await prisma.proveedorVoz.findMany({
    where: { instanciaId, activo: true },
    orderBy: { prioridad: "desc" },
  });

  for (const config of candidatos) {
    if (!config.apiKeyEncriptada) continue;
    if (!estaImplementadoVoz(config.proveedor)) continue;

    try {
      const apiKey = descifrarToken(config.apiKeyEncriptada);
      return {
        proveedor: crearProveedorVoz(
          config.proveedor,
          apiKey,
          config.modelo,
          config.baseUrl ?? undefined,
        ),
        proveedorVozId: config.id,
        modelo: config.modelo,
        costoPorHora: config.costoPorHora,
        limiteMinutosDia: config.limiteMinutosDia,
        timeoutMs: config.timeoutMs,
      };
    } catch (e) {
      // Credencial ilegible o adaptador sin registrar: se intenta el
      // siguiente en vez de dejar la cuenta sin transcripción.
      console.error(`[voz] Proveedor ${config.alias} descartado:`, e);
    }
  }

  return null;
}

/** ¿Hay al menos un proveedor activo con credencial? Para la UI y el gate. */
export async function hayProveedorVozUtilizable(instanciaId: string): Promise<boolean> {
  const n = await prisma.proveedorVoz.count({
    where: { instanciaId, activo: true, apiKeyEncriptada: { not: null } },
  });
  return n > 0;
}
