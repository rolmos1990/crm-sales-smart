import { prisma } from "@/shared/db/prisma";
import { MONEDA_DEFAULT } from "@/shared/moneda/constants";
import type { ConfigEmpresa } from "./types";

export async function obtenerConfiguracionEmpresa(instanciaId: string): Promise<ConfigEmpresa | null> {
  return prisma.configuracionEmpresa.findUnique({
    where: { instanciaId },
  });
}

export async function obtenerMonedaPrincipal(instanciaId: string): Promise<string> {
  const config = await prisma.configuracionEmpresa.findUnique({
    where: { instanciaId },
    select: { monedaPrincipal: true },
  });
  return config?.monedaPrincipal ?? MONEDA_DEFAULT;
}
