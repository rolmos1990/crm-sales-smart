import { prisma } from "@/shared/db/prisma";

const incluirRelaciones = {
  contacto: { select: { id: true, nombre: true, apellido: true } },
  empresa: { select: { id: true, nombre: true } },
} as const;

export async function obtenerPedidos() {
  return prisma.pedido.findMany({
    include: incluirRelaciones,
    orderBy: { creadoEn: "desc" },
  });
}

export async function obtenerPedidoPorId(id: string) {
  return prisma.pedido.findUnique({
    where: { id },
    include: {
      ...incluirRelaciones,
      lineas: { include: { producto: { select: { id: true, nombre: true } } } },
      cotizacion: { select: { id: true, numero: true } },
    },
  });
}

export async function generarNumeroPedido(): Promise<string> {
  const count = await prisma.pedido.count();
  const año = new Date().getFullYear();
  return `PED-${año}-${String(count + 1).padStart(4, "0")}`;
}
