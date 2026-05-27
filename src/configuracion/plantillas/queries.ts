import { prisma } from "@/shared/db/prisma";
import type { Plantilla } from "./types";

export async function obtenerPlantillas(instanciaId: string): Promise<Plantilla[]> {
  return prisma.plantillaCRM.findMany({
    where: { instanciaId },
    orderBy: { creadoEn: "desc" },
  });
}

export async function obtenerPlantilla(id: string, instanciaId: string): Promise<Plantilla | null> {
  return prisma.plantillaCRM.findFirst({
    where: { id, instanciaId },
  });
}
