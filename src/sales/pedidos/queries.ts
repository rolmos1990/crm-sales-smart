import { prisma } from "@/shared/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { obtenerEtapasFlujoActivo } from "@/sales/flujo-venta/queries";

const incluirRelaciones = {
  contacto: { select: { id: true, nombre: true, apellido: true, email: true, telefonoPrincipal: true, telefonoSecundario: true, cargo: true } },
  empresa: { select: { id: true, nombre: true, ruc: true, industria: true, telefono: true, email: true, sitioWeb: true } },
  entrega: { select: { metodoEntrega: true } },
} as const;

export interface PedidosFiltros {
  desde?: Date;
  hasta?: Date;
  /** Estado del enum legacy — solo se usa cuando el tenant NO tiene un Flujo
   *  de Venta dinámico activo (ver flujoVentaEtapaId). */
  estado?: string;
  /** Etapa del Flujo de Venta dinámico — cuando existe, es la fuente real
   *  del "estado" que se ve en la tabla (EstadoBadge prioriza `flujoVentaEtapa`
   *  sobre el enum `estado`, que con flujo dinámico queda congelado desde la
   *  creación — ver motor.ts:_moverInterno, que solo actualiza
   *  flujoVentaEtapaId, nunca `estado`). Mutuamente excluyente con `estado`
   *  en la práctica: el filtro de la UI ofrece uno u otro según el tenant. */
  flujoVentaEtapaId?: string;
  metodoEntrega?: string;
  contactoId?: string;
  productoId?: string;
  /** Busca por número de pedido, nombre/apellido del contacto o razón social */
  busqueda?: string;
  /** Filtro por fechaEntrega (columna "Entrega estimada") — independiente
   *  del rango `desde`/`hasta`, que filtra por fechaPedido. */
  entregaDesde?: Date;
  entregaHasta?: Date;
  /** "Ver cerrados" desmarcado (default en la UI): oculta del listado los
   *  pedidos ya cerrados — no afecta a obtenerPedidosKpis, cuyos totales son
   *  históricos por diseño (ver obtenerPedidos). Se ignora si ya hay un
   *  filtro explícito de estado/etapa. */
  ocultarCerrados?: boolean;
  /** Ids de etapas del flujo dinámico marcadas esFinal/esCancelacion — solo
   *  se pasa cuando el tenant tiene un flujo activo (ver obtenerPedidos). */
  etapaIdsCerradas?: string[];
}

// Filtros que no son de fecha — se reutiliza tal cual para "Total ventas ·
// mes actual", que necesita las mismas condiciones (estado, método, cliente,
// producto, búsqueda) pero SIEMPRE con su propio rango de fechaPedido (mes
// actual), sin importar qué rango de fecha o de entrega esté aplicado en la
// pantalla — ver obtenerPedidosKpis.
function construirWhereBase(instanciaId: string, filtros?: PedidosFiltros): Prisma.PedidoWhereInput {
  const where: Prisma.PedidoWhereInput = { instanciaId };
  if (!filtros) return where;

  if (filtros.estado) where.estado = filtros.estado as Prisma.EnumEstadoPedidoFilter["equals"];
  if (filtros.flujoVentaEtapaId) where.flujoVentaEtapaId = filtros.flujoVentaEtapaId;
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

function construirWhere(instanciaId: string, filtros?: PedidosFiltros): Prisma.PedidoWhereInput {
  const where = construirWhereBase(instanciaId, filtros);
  if (!filtros) return where;

  if (filtros.desde || filtros.hasta) {
    where.fechaPedido = {
      ...(filtros.desde ? { gte: filtros.desde } : {}),
      ...(filtros.hasta ? { lte: filtros.hasta } : {}),
    };
  }
  if (filtros.entregaDesde || filtros.entregaHasta) {
    where.fechaEntrega = {
      ...(filtros.entregaDesde ? { gte: filtros.entregaDesde } : {}),
      ...(filtros.entregaHasta ? { lt: filtros.entregaHasta } : {}),
    };
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
  const where = construirWhere(instanciaId, filtros);

  // "Ver cerrados" desmarcado: oculta pedidos en etapa final/cancelación (o
  // ENTREGADO/CANCELADO sin flujo dinámico) — solo aplica al listado, nunca
  // a los KPIs. Si el usuario ya filtró por una etapa/estado puntual, ese
  // filtro manda y no se oculta nada más.
  if (filtros?.ocultarCerrados && !filtros.estado && !filtros.flujoVentaEtapaId) {
    if (filtros.etapaIdsCerradas) {
      if (filtros.etapaIdsCerradas.length > 0) where.flujoVentaEtapaId = { notIn: filtros.etapaIdsCerradas };
    } else {
      where.estado = { notIn: ["ENTREGADO", "CANCELADO"] };
    }
  }

  return prisma.pedido.findMany({
    where,
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
  /** Suma de `total` con fechaPedido entre el 1° del mes actual y ahora —
   *  siempre ese rango exacto, sin importar filtros de fecha/entrega
   *  aplicados en pantalla (ver rangoMesActual). */
  totalVentasMesActual: number;
  pendientes: number;
  expirados: number;
  entregados: number;
}

/**
 * KPIs del listado — "Pendientes"/"Expirados" se calculan contra
 * `fechaExpiracion` (el límite que el usuario le da al pedido, no la fecha
 * de entrega): pendientes = todavía no vence y no está cerrado; expirados =
 * ya venció y sigue sin cerrarse (ni entregado ni cancelado).
 *
 * "Cerrado"/"Entregado" se determina por Flujo de Venta dinámico si el
 * tenant tiene uno activo (etapas con esFinal/esCancelacion — mutuamente
 * excluyentes, ver panel-config-etapas.tsx) en vez del enum `estado`, que
 * queda congelado al mover un pedido por el flujo y no sirve para esto (ver
 * motor.ts:_moverInterno, que solo actualiza flujoVentaEtapaId). Sin flujo
 * dinámico, se usa el enum legacy como siempre.
 *
 * `rangoMesActual` viene ya resuelto en la zona horaria de negocio (ver
 * utils/fechas-zona.ts) — esta función no calcula fechas, solo agrega en BD
 * (SUM/COUNT), nunca trae los pedidos completos a memoria para sumarlos.
 */
export async function obtenerPedidosKpis(
  instanciaId: string,
  filtros: PedidosFiltros | undefined,
  rangoMesActual: { desde: Date; hasta: Date }
): Promise<PedidosKpis> {
  const where = construirWhere(instanciaId, filtros);
  // "Total ventas · mes actual" usa las mismas condiciones no-relacionadas a
  // fecha (estado, método, cliente, producto, búsqueda) pero SIEMPRE fuerza
  // fechaPedido al mes actual — ignora cualquier filtro de fecha de pedido o
  // de entrega estimada que esté activo, para no dejar de representar
  // "ventas del mes actual según fecha de pedido".
  const whereMesActual: Prisma.PedidoWhereInput = {
    ...construirWhereBase(instanciaId, filtros),
    fechaPedido: { gte: rangoMesActual.desde, lte: rangoMesActual.hasta },
  };
  const ahora = new Date();

  const etapasFlujo = await obtenerEtapasFlujoActivo(instanciaId);
  let condicionAbiertos: Prisma.PedidoWhereInput;
  let condicionEntregados: Prisma.PedidoWhereInput;

  if (etapasFlujo.length > 0) {
    const idsCerrados = etapasFlujo.filter((e) => e.esFinal || e.esCancelacion).map((e) => e.id);
    const idsEntregados = etapasFlujo.filter((e) => e.esFinal && !e.esCancelacion).map((e) => e.id);
    condicionAbiertos = idsCerrados.length > 0 ? { flujoVentaEtapaId: { notIn: idsCerrados } } : {};
    condicionEntregados = { flujoVentaEtapaId: { in: idsEntregados } };
  } else {
    condicionAbiertos = { estado: { notIn: ["ENTREGADO", "CANCELADO"] } };
    condicionEntregados = { estado: "ENTREGADO" };
  }

  const [totales, totalesMes, pendientes, expirados, entregados] = await Promise.all([
    prisma.pedido.aggregate({ where, _count: true, _sum: { total: true, costoEnvio: true } }),
    prisma.pedido.aggregate({ where: whereMesActual, _sum: { total: true, costoEnvio: true } }),
    prisma.pedido.count({ where: { ...where, ...condicionAbiertos, fechaExpiracion: { gte: ahora } } }),
    prisma.pedido.count({ where: { ...where, ...condicionAbiertos, fechaExpiracion: { lt: ahora } } }),
    prisma.pedido.count({ where: { ...where, ...condicionEntregados } }),
  ]);

  // "Total ventas"/"Total ventas · mes actual" restan el costo de envío del
  // total — el envío se cobra al cliente (está incluido en `total`) pero no
  // es ganancia, así que no debe contar como venta en estos KPIs.
  return {
    totalPedidos: totales._count,
    totalVentas: Number(totales._sum.total ?? 0) - Number(totales._sum.costoEnvio ?? 0),
    totalVentasMesActual: Number(totalesMes._sum.total ?? 0) - Number(totalesMes._sum.costoEnvio ?? 0),
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
