import { prisma } from "@/shared/db/prisma";
import type { Prisma } from "@/generated/prisma/client";

const incluirRelaciones = {
  contacto: { select: { id: true, nombre: true, apellido: true, email: true, telefonoPrincipal: true, telefonoSecundario: true, cargo: true } },
  empresa: { select: { id: true, nombre: true, ruc: true, industria: true, telefono: true, email: true, sitioWeb: true } },
  entrega: { select: { metodoEntrega: true } },
} as const;

export interface PedidosFiltros {
  desde?: Date;
  hasta?: Date;
  estado?: string;
  metodoEntrega?: string;
  contactoId?: string;
  productoId?: string;
  /** Busca por número de pedido, nombre/apellido del contacto o razón social */
  busqueda?: string;
}

function construirWhere(instanciaId: string, filtros?: PedidosFiltros): Prisma.PedidoWhereInput {
  const where: Prisma.PedidoWhereInput = { instanciaId };

  if (!filtros) return where;

  if (filtros.desde || filtros.hasta) {
    where.fechaPedido = {
      ...(filtros.desde ? { gte: filtros.desde } : {}),
      ...(filtros.hasta ? { lte: filtros.hasta } : {}),
    };
  }
  if (filtros.estado) where.estado = filtros.estado as Prisma.EnumEstadoPedidoFilter["equals"];
  if (filtros.metodoEntrega) where.entrega = { is: { metodoEntrega: filtros.metodoEntrega as never } };
  if (filtros.contactoId) where.contactoId = filtros.contactoId;
  if (filtros.productoId) where.lineas = { some: { productoId: filtros.productoId } };
  if (filtros.busqueda) {
    const q = filtros.busqueda;
    where.OR = [
      { numero: { contains: q, mode: "insensitive" } },
      { nombre: { contains: q, mode: "insensitive" } },
      { apellido: { contains: q, mode: "insensitive" } },
      { empresaNombre: { contains: q, mode: "insensitive" } },
      { contacto: { is: { OR: [{ nombre: { contains: q, mode: "insensitive" } }, { apellido: { contains: q, mode: "insensitive" } }] } } },
      { empresa: { is: { nombre: { contains: q, mode: "insensitive" } } } },
    ];
  }

  return where;
}

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

export async function obtenerPedidos(instanciaId: string, filtros?: PedidosFiltros) {
  return prisma.pedido.findMany({
    where: construirWhere(instanciaId, filtros),
    include: {
      ...incluirRelaciones,
      flujoVentaEtapa: { select: { id: true, nombre: true, color: true, esFinal: true, esCancelacion: true, esSecuencial: true, permiteEditarPedido: true, orden: true, parentId: true } },
    },
    orderBy: { creadoEn: "desc" },
  });
}

export interface PedidosKpis {
  totalPedidos: number;
  totalVentas: number;
  pendientes: number;
  expirados: number;
  entregados: number;
}

/**
 * KPIs del listado — "Pendientes"/"Expirados" se calculan contra
 * `fechaExpiracion` (el límite que el usuario le da al pedido, no la fecha
 * de entrega): pendientes = todavía no vence y no está cerrado; expirados =
 * ya venció y sigue sin cerrarse (ni entregado ni cancelado).
 */
export async function obtenerPedidosKpis(instanciaId: string, filtros?: PedidosFiltros): Promise<PedidosKpis> {
  const where = construirWhere(instanciaId, filtros);
  const ahora = new Date();
  const abiertos: Prisma.EnumEstadoPedidoFilter = { notIn: ["ENTREGADO", "CANCELADO"] };

  const [totales, pendientes, expirados, entregados] = await Promise.all([
    prisma.pedido.aggregate({ where, _count: true, _sum: { total: true } }),
    prisma.pedido.count({ where: { ...where, estado: abiertos, fechaExpiracion: { gte: ahora } } }),
    prisma.pedido.count({ where: { ...where, estado: abiertos, fechaExpiracion: { lt: ahora } } }),
    prisma.pedido.count({ where: { ...where, estado: "ENTREGADO" } }),
  ]);

  return {
    totalPedidos: totales._count,
    totalVentas: Number(totales._sum.total ?? 0),
    pendientes,
    expirados,
    entregados,
  };
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
