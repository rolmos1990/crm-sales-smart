import { prisma } from "@/shared/db/prisma";
import { OBJETIVOS_ENRUTAMIENTO, type ObjetivoEnrutamiento } from "./schema";
import type { CasosDeUsoProveedor } from "@/ai/proveedores/types";

export async function obtenerConfigIA(instanciaId: string) {
  return prisma.configuracionIA.findUnique({
    where: { instanciaId },
  });
}

export async function obtenerProveedoresIA(instanciaId: string) {
  return prisma.proveedorIA.findMany({
    where: { instanciaId },
    orderBy: { prioridad: "desc" },
    select: {
      id: true,
      alias: true,
      proveedor: true,
      tipoAgenteIA: true,
      activo: true,
      prioridad: true,
      modelosDisponibles: true,
      limitePorMinuto: true,
      limitePorDia: true,
      timeoutMs: true,
      reintentosMax: true,
      baseUrl: true,
      costoInputPorMilToken: true,
      costoOutputPorMilToken: true,
      creadoEn: true,
      // La API key nunca se devuelve al cliente
    },
  });
}

export async function obtenerProveedorIA(id: string, instanciaId: string) {
  return prisma.proveedorIA.findFirst({
    where: { id, instanciaId },
    select: {
      id: true,
      alias: true,
      proveedor: true,
      activo: true,
      prioridad: true,
      modelosDisponibles: true,
      limitePorMinuto: true,
      limitePorDia: true,
      timeoutMs: true,
      reintentosMax: true,
      baseUrl: true,
    },
  });
}

// --- 010-enrutamiento-modelos-ia-por-objetivo ---

function parsearObjetivos(valor: unknown): ObjetivoEnrutamiento[] {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return [];
  const objetivos = (valor as CasosDeUsoProveedor)["objetivos"];
  return Array.isArray(objetivos) ? (objetivos as ObjetivoEnrutamiento[]) : [];
}

export interface AsignacionObjetivoIA {
  objetivo: ObjetivoEnrutamiento;
  proveedorIAId: string | null;
  proveedorNombre: string | null;
  proveedorAlias: string | null;
  proveedorInvalido: boolean;
}

/** Mapa inverso objetivo → proveedor, para los 7 objetivos de enrutamiento. */
export async function obtenerAsignacionesObjetivoIA(instanciaId: string): Promise<AsignacionObjetivoIA[]> {
  const proveedores = await prisma.proveedorIA.findMany({
    where: { instanciaId },
    select: { id: true, alias: true, proveedor: true, activo: true, casosDeUso: true },
  });

  const mapa = new Map<ObjetivoEnrutamiento, { id: string; proveedor: string; alias: string; activo: boolean }>();
  for (const p of proveedores) {
    for (const objetivo of parsearObjetivos(p.casosDeUso)) {
      mapa.set(objetivo, { id: p.id, proveedor: p.proveedor, alias: p.alias, activo: p.activo });
    }
  }

  return OBJETIVOS_ENRUTAMIENTO.map((objetivo) => {
    const asignado = mapa.get(objetivo);
    return {
      objetivo,
      proveedorIAId: asignado?.id ?? null,
      proveedorNombre: asignado?.proveedor ?? null,
      proveedorAlias: asignado?.alias ?? null,
      proveedorInvalido: asignado ? !asignado.activo : false,
    };
  });
}

export async function obtenerResumenUsoIA(instanciaId: string) {
  const [hoy, mes] = await Promise.all([
    prisma.usoIA.aggregate({
      where: {
        instanciaId,
        exito: true,
        creadoEn: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
      _sum: { tokensInput: true, tokensOutput: true },
      _count: { id: true },
    }),
    prisma.usoIA.aggregate({
      where: {
        instanciaId,
        exito: true,
        creadoEn: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
      _sum: { tokensInput: true, tokensOutput: true },
      _count: { id: true },
    }),
  ]);

  return {
    hoy: {
      llamadas: hoy._count.id,
      tokens: (hoy._sum.tokensInput ?? 0) + (hoy._sum.tokensOutput ?? 0),
    },
    mes: {
      llamadas: mes._count.id,
      tokens: (mes._sum.tokensInput ?? 0) + (mes._sum.tokensOutput ?? 0),
    },
  };
}
