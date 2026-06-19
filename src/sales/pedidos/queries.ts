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
    include: {
      ...incluirRelaciones,
      flujoVentaEtapa: { select: { id: true, nombre: true, color: true, esFinal: true, esCancelacion: true, esSecuencial: true, permiteEditarPedido: true, orden: true, parentId: true } },
    },
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
      flujoVentaEtapa: { select: { id: true, nombre: true, color: true, esFinal: true, esCancelacion: true, esSecuencial: true, permiteEditarPedido: true, permiteEditarEntrega: true, orden: true, parentId: true } },
      flujoVenta: {
        select: {
          id: true,
          etapas: {
            where: { activo: true },
            orderBy: { orden: "asc" as const },
            select: { id: true, nombre: true, color: true, esFinal: true, esCancelacion: true, esInicial: true, esSecuencial: true, permiteEditarPedido: true, permiteEditarEntrega: true, orden: true, parentId: true },
          },
        },
      },
      entrega: {
        include: {
          transportista: { select: { id: true, nombre: true, tipo: true } },
        },
      },
      historialEtapas: {
        select: {
          id: true,
          etapaNombre: true,
          etapaAnteriorNombre: true,
          tipo: true,
          origen: true,
          notas: true,
          referencia: true,
          usuarioId: true,
          usuarioNombre: true,
          creadoEn: true,
          etapa: { select: { color: true } },
        },
        orderBy: { creadoEn: "desc" },
      },
      historial: {
        select: {
          id: true,
          accion: true,
          valorAnterior: true,
          valorNuevo: true,
          usuarioId: true,
          usuarioNombre: true,
          creadoEn: true,
        },
        orderBy: { creadoEn: "desc" },
      },
    },
  });
}

export async function generarNumeroPedido(instanciaId: string): Promise<string> {
  const count = await prisma.pedido.count({ where: { instanciaId } });
  const año = new Date().getFullYear();
  return `PED-${año}-${String(count + 1).padStart(4, "0")}`;
}
