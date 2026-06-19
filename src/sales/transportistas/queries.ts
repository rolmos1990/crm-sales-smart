import { prisma } from "@/shared/db/prisma";

export async function obtenerTransportistas(instanciaId: string) {
  return prisma.transportista.findMany({
    where: { instanciaId },
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
  });
}
