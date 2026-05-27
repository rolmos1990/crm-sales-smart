import { prisma } from "@/shared/db/prisma";
import type { ConfigEmpresa } from "./types";

export async function obtenerConfiguracionEmpresa(instanciaId: string): Promise<ConfigEmpresa | null> {
  return prisma.configuracionEmpresa.findUnique({
    where: { instanciaId },
  });
}
