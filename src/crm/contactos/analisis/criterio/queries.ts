import { prisma } from "@/shared/db/prisma";
import { CriterioContenidoSchema, type CriterioContenido, type PlantillaCriterio } from "./schema";
import { PLANTILLAS, PLANTILLA_POR_DEFECTO } from "./plantillas";

export interface CriterioVigente {
  contenido: CriterioContenido;
  versionId: string | null;
  numero: number | null;
  plantillaAplicada: PlantillaCriterio | null;
}

/**
 * Criterio con el que se evalúa ahora. Sin versión publicada —o con un
 * contenido que ya no valida— se usa GENERAL en memoria, sin escribir nada
 * (research D12): el motor nunca se detiene por un criterio roto.
 */
export async function obtenerCriterioVigente(instanciaId: string): Promise<CriterioVigente> {
  const criterio = await prisma.criterioAnalisisContactos.findUnique({
    where: { instanciaId },
    select: { versionPublicadaId: true },
  });

  if (criterio?.versionPublicadaId) {
    const version = await prisma.criterioAnalisisContactosVersion.findFirst({
      where: { id: criterio.versionPublicadaId, instanciaId },
      select: { id: true, numero: true, contenido: true },
    });
    const parseado = version ? CriterioContenidoSchema.safeParse(version.contenido) : null;
    if (version && parseado?.success) {
      return { contenido: parseado.data, versionId: version.id, numero: version.numero, plantillaAplicada: null };
    }
    console.error("[analisis-contactos] Criterio publicado inválido; se usa GENERAL", { instanciaId });
  }

  return {
    contenido: PLANTILLAS[PLANTILLA_POR_DEFECTO].contenido,
    versionId: null,
    numero: null,
    plantillaAplicada: PLANTILLA_POR_DEFECTO,
  };
}

export interface VersionCriterioEdicion {
  id: string;
  numero: number | null;
  plantillaOrigen: string;
  contenido: CriterioContenido;
  publicadaEn: string | null;
}

export interface CriterioParaEdicion {
  publicada: VersionCriterioEdicion | null;
  borrador: VersionCriterioEdicion | null;
  plantillas: Array<{ clave: PlantillaCriterio; nombre: string; descripcion: string }>;
  /** Lo que se evalúa hoy: la publicada, o GENERAL si la cuenta no publicó nada. */
  vigente: { contenido: CriterioContenido; plantillaAplicada: PlantillaCriterio | null; numero: number | null };
}

function aVersion(v: { id: string; numero: number | null; plantillaOrigen: string; contenido: unknown; publicadaEn: Date | null }): VersionCriterioEdicion | null {
  const parseado = CriterioContenidoSchema.safeParse(v.contenido);
  if (!parseado.success) return null;
  return { id: v.id, numero: v.numero, plantillaOrigen: v.plantillaOrigen, contenido: parseado.data, publicadaEn: v.publicadaEn?.toISOString() ?? null };
}

/** 042 (Historia 3) — Datos del editor de criterio en Configuración → IA. */
export async function obtenerCriterioParaEdicion(instanciaId: string): Promise<CriterioParaEdicion> {
  const criterio = await prisma.criterioAnalisisContactos.findUnique({
    where: { instanciaId },
    select: {
      versionPublicadaId: true,
      versiones: {
        where: { estado: { in: ["PUBLICADA", "BORRADOR"] } },
        select: { id: true, numero: true, estado: true, plantillaOrigen: true, contenido: true, publicadaEn: true },
      },
    },
  });
  const publicadaFila = criterio?.versiones.find((v) => v.id === criterio.versionPublicadaId) ?? null;
  const borradorFila = criterio?.versiones.find((v) => v.estado === "BORRADOR") ?? null;
  const vigente = await obtenerCriterioVigente(instanciaId);
  return {
    publicada: publicadaFila ? aVersion(publicadaFila) : null,
    borrador: borradorFila ? aVersion(borradorFila) : null,
    plantillas: (Object.keys(PLANTILLAS) as PlantillaCriterio[]).map((clave) => ({
      clave,
      nombre: PLANTILLAS[clave].nombre,
      descripcion: PLANTILLAS[clave].descripcion,
    })),
    vigente: { contenido: vigente.contenido, plantillaAplicada: vigente.plantillaAplicada, numero: vigente.numero },
  };
}
