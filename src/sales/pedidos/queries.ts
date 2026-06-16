import { prisma } from "@/shared/db/prisma";

const incluirRelaciones = {
  contacto: { select: { id: true, nombre: true, apellido: true, email: true, telefonoPrincipal: true, telefonoSecundario: true, cargo: true } },
  empresa: { select: { id: true, nombre: true, ruc: true, industria: true, telefono: true, email: true, sitioWeb: true } },
} as const;

// Fragmento reutilizable para traer oportunidad + sus campos dinámicos del pipeline
const incluirOportunidadConCampos = {
  select: {
    id: true,
    titulo: true,
    metadata: true,
    pipeline: {
      select: {
        campos: {
          where: { activo: true },
          orderBy: { orden: "asc" as const },
          select: { id: true, nombre: true, clave: true, tipo: true },
        },
      },
    },
  },
} as const;

export async function obtenerPedidos(instanciaId: string) {
  return prisma.pedido.findMany({
    where: { instanciaId },
    include: incluirRelaciones,
    orderBy: { creadoEn: "desc" },
  });
}

export async function obtenerPedidoPorId(id: string, instanciaId: string) {
  return prisma.pedido.findFirst({
    where: { id, instanciaId },
    include: {
      ...incluirRelaciones,
      lineas: { include: { producto: { select: { id: true, nombre: true } } } },
      cotizacion: {
        select: {
          id: true,
          numero: true,
          oportunidad: incluirOportunidadConCampos,
        },
      },
      oportunidad: incluirOportunidadConCampos,
    },
  });
}

export async function generarNumeroPedido(instanciaId: string): Promise<string> {
  const count = await prisma.pedido.count({ where: { instanciaId } });
  const año = new Date().getFullYear();
  return `PED-${año}-${String(count + 1).padStart(4, "0")}`;
}
