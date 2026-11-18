import { prisma } from "@/shared/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { aFiltroPrisma, type RangoUtc } from "@/shared/fechas/rangos";
import { obtenerEtapasFlujoActivo } from "@/sales/flujo-venta/queries";
import { construirCondicionAbiertos, construirCondicionVenta } from "./condicion-venta";
import { ocultarCodigo } from "@/shared/lib/codigo-sensible";

const incluirRelaciones = {
  contacto: { select: { id: true, nombre: true, apellido: true, email: true, telefonoPrincipal: true, telefonoSecundario: true, cargo: true } },
  empresa: { select: { id: true, nombre: true, ruc: true, industria: true, telefono: true, email: true, sitioWeb: true } },
  entrega: { select: { metodoEntrega: true } },
  // 026-preparacion-pedidos — eje independiente del estado comercial. Es
  // nullable a propósito: una instancia que no usa Preparación ve la lista y
  // el detalle exactamente como antes (FR-026).
  preparacion: {
    select: {
      iniciadaEn: true,
      completadaEn: true,
      estado: { select: { nombre: true, color: true, esFinal: true } },
      asignadaA: { select: { nombre: true } },
    },
  },
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
    // `lt`, igual que fechaEntrega abajo: `hasta` es el inicio del día
    // siguiente, no el último instante del día elegido.
    where.fechaPedido = {
      ...(filtros.desde ? { gte: filtros.desde } : {}),
      ...(filtros.hasta ? { lt: filtros.hasta } : {}),
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

/**
 * `where` de los KPIs de dinero (038). Mismos filtros no-fecha que el resto
 * —reutiliza `construirWhereBase`, no los duplica— pero con el eje de fecha
 * puesto en `fechaVenta`: una venta pertenece al período en que se
 * CONCRETÓ, no a aquel en que se creó el pedido (FR-017).
 *
 * El filtro de entrega estimada se sigue aplicando como predicado
 * independiente: acota qué pedidos mirar, no afirma cuándo ocurrió la venta
 * (research.md Decisión 5).
 *
 * `condicionVenta` entra por `AND` y no por spread porque puede chocar con el
 * `flujoVentaEtapaId` que el usuario eligió en la barra de filtros; con
 * spread uno pisaría al otro en silencio.
 */
export function construirWhereVentas(
  instanciaId: string,
  filtros: PedidosFiltros | undefined,
  condicionVenta: Prisma.PedidoWhereInput,
  rangoForzado?: RangoUtc,
): Prisma.PedidoWhereInput {
  const where = construirWhereBase(instanciaId, filtros);

  if (filtros?.entregaDesde || filtros?.entregaHasta) {
    where.fechaEntrega = {
      ...(filtros.entregaDesde ? { gte: filtros.entregaDesde } : {}),
      ...(filtros.entregaHasta ? { lt: filtros.entregaHasta } : {}),
    };
  }

  if (rangoForzado) {
    where.fechaVenta = aFiltroPrisma(rangoForzado);
  } else if (filtros?.desde || filtros?.hasta) {
    // Semiabierto como todo rango del proyecto: `hasta` es el inicio del día
    // siguiente, nunca un `lte` sobre un límite de día.
    where.fechaVenta = {
      ...(filtros.desde ? { gte: filtros.desde } : {}),
      ...(filtros.hasta ? { lt: filtros.hasta } : {}),
    };
  }

  return { ...where, AND: [condicionVenta] };
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
  /** Suma de `total - costoEnvio` de los pedidos que CUENTAN COMO VENTA: los
   *  que están en una etapa marcada `cuentaComoVenta` (038). Su eje de fecha
   *  es `fechaVenta`, no `fechaPedido`. */
  totalVentas: number;
  /** Igual que `totalVentas`, con el rango forzado del 1° del mes actual al
   *  final del día de hoy — siempre ese rango exacto, sin importar los
   *  filtros de fecha/entrega aplicados en pantalla (ver rangoMesActual). */
  totalVentasMesActual: number;
  pendientes: number;
  expirados: number;
  /** Cantidad de pedidos que cuentan como venta — misma población que
   *  `totalVentas`, para que el conteo y los montos hablen de lo mismo
   *  (038 FR-012). Antes era "entregados". */
  ventas: number;
}

/**
 * KPIs del listado.
 *
 * 038 — conviven DOS poblaciones distintas acá, y confundirlas es el error
 * esperable:
 *
 *  - Las tarjetas de dinero ("Total ventas", "Total ventas · mes actual") y
 *    el conteo "Ventas" miran SOLO los pedidos que cuentan como venta: los
 *    que están en una etapa marcada `cuentaComoVenta`. Su eje de fecha es
 *    `fechaVenta` —cuándo se concretó la venta—, no `fechaPedido`.
 *  - "Total pedidos", "Pendientes" y "Expirados" miran la población completa
 *    del filtro, con `fechaPedido` como eje.
 *
 * Que la lista y las tarjetas de dinero muestren poblaciones distintas con un
 * rango activo es deliberado: un pedido creado en octubre y vendido en
 * noviembre suma en noviembre y no aparece en la lista de noviembre. Por eso
 * esas tarjetas dicen "Vendidos en este rango" (research.md Decisión 4).
 *
 * `cuentaComoVenta` se lee de la configuración VIGENTE en cada llamada y
 * nunca se persiste en el Pedido: por eso marcar o desmarcar una etapa cambia
 * los totales en el siguiente render, sin recálculo ni migración (FR-008).
 *
 * "Cerrado" se determina por Flujo de Venta dinámico si el tenant tiene uno
 * activo (etapas con esFinal/esCancelacion) en vez del enum `estado`, que
 * queda congelado al mover un pedido por el flujo y no sirve para esto (ver
 * motor.ts:_moverInterno, que solo actualiza flujoVentaEtapaId). Sin flujo
 * dinámico se usa el enum legacy, como siempre.
 *
 * "Pendientes"/"Expirados" se calculan contra `fechaEntrega` (la entrega
 * estimada): pendientes = abiertos con entrega de hoy en adelante; expirados
 * = abiertos cuya entrega ya pasó. El corte es el INICIO del día de negocio,
 * no `ahora`: con un corte por instante, un pedido con entrega HOY pasaría a
 * "expirado" a la medianoche UTC, que puede caer en mitad del día local.
 *
 * `rangoMesActual` e `inicioDiaHoy` llegan ya resueltos en la zona horaria de
 * negocio (ver rangoMesHastaHoy y rangoHoy) — esta función no calcula fechas,
 * solo agrega en BD (SUM/COUNT), nunca trae los pedidos a memoria.
 */
export async function obtenerPedidosKpis(
  instanciaId: string,
  filtros: PedidosFiltros | undefined,
  rangoMesActual: RangoUtc,
  inicioDiaHoy: Date,
): Promise<PedidosKpis> {
  const where = construirWhere(instanciaId, filtros);

  // Derivadas en vivo de la configuración vigente — nunca persistidas en el
  // Pedido. Ese es el motivo por el que marcar o desmarcar una etapa como
  // "Cuenta como Venta" se refleja acá sin recálculo ni migración (FR-008).
  const etapasFlujo = await obtenerEtapasFlujoActivo(instanciaId);
  const condicionAbiertos = construirCondicionAbiertos(etapasFlujo);
  const condicionVenta = construirCondicionVenta(etapasFlujo);

  const whereVentas = construirWhereVentas(instanciaId, filtros, condicionVenta);
  // "Total ventas · mes actual" fuerza SIEMPRE su propio rango e ignora el
  // filtro de fecha que haya en pantalla, para no dejar de representar las
  // ventas del mes en curso.
  const whereVentasMes = construirWhereVentas(instanciaId, filtros, condicionVenta, rangoMesActual);

  // `AND` y no spread: `condicionAbiertos` puede traer `flujoVentaEtapaId` y
  // `where` ya puede tenerlo por el filtro de etapa de la barra; y el corte
  // sobre `fechaEntrega` chocaría con el filtro de entrega estimada. Con
  // spread, uno pisaría al otro sin aviso.
  const whereAbiertos = (corteEntrega: Prisma.DateTimeFilter): Prisma.PedidoWhereInput => ({
    ...where,
    AND: [condicionAbiertos, { fechaEntrega: corteEntrega }],
  });

  const [totalPedidos, totales, totalesMes, pendientes, expirados, ventas] = await Promise.all([
    prisma.pedido.count({ where }),
    prisma.pedido.aggregate({ where: whereVentas, _sum: { total: true, costoEnvio: true } }),
    prisma.pedido.aggregate({ where: whereVentasMes, _sum: { total: true, costoEnvio: true } }),
    prisma.pedido.count({ where: whereAbiertos({ gte: inicioDiaHoy }) }),
    prisma.pedido.count({ where: whereAbiertos({ lt: inicioDiaHoy }) }),
    prisma.pedido.count({ where: whereVentas }),
  ]);

  // "Total ventas"/"Total ventas · mes actual" restan el costo de envío del
  // total — el envío se cobra al cliente (está incluido en `total`) pero no
  // es ganancia, así que no debe contar como venta en estos KPIs.
  return {
    totalPedidos,
    totalVentas: Number(totales._sum.total ?? 0) - Number(totales._sum.costoEnvio ?? 0),
    totalVentasMesActual: Number(totalesMes._sum.total ?? 0) - Number(totalesMes._sum.costoEnvio ?? 0),
    pendientes,
    expirados,
    ventas,
  };
}

// `codigo` se trae de Prisma pero nunca sale de esta función tal cual — ver
// ocultarCodigo, aplicado siempre antes del `return`.
const SELECT_ENTREGA_DIGITAL_LINEA = {
  metodo: true, email: true, url: true, archivo: true, codigo: true, usuarioAcceso: true,
  fechaEntrega: true, fechaExpiracion: true, instrucciones: true, observaciones: true,
} as const;

export async function obtenerPedidoPorId(id: string, instanciaId: string) {
  const pedido = await prisma.pedido.findFirst({
    where: { id, instanciaId },
    include: {
      ...incluirRelaciones,
      lineas: {
        include: {
          producto: { select: { id: true, nombre: true, tipo: true } },
          // Por línea, no por pedido completo — ver EntregaDigitalPedido.
          entregaDigital: { select: SELECT_ENTREGA_DIGITAL_LINEA },
        },
      },
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
      servicio: true,
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
  if (!pedido) return null;
  return {
    ...pedido,
    lineas: pedido.lineas.map((l) => ({ ...l, entregaDigital: ocultarCodigo(l.entregaDigital) })),
  };
}

/**
 * Basado en el último `numero` emitido (no en `count`) — mismo motivo que
 * generarNumeroCotizacion: con `count`, borrar un pedido (ver eliminarPedido)
 * reduce el conteo y el próximo número generado puede volver a caer en uno
 * que ya existe, disparando el unique constraint (instanciaId, numero).
 */
export async function generarNumeroPedido(instanciaId: string): Promise<string> {
  const ultimo = await prisma.pedido.findFirst({
    where: { instanciaId },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });
  const ultimoConsecutivo = ultimo ? parseInt(ultimo.numero.split("-").pop() ?? "0", 10) || 0 : 0;
  const año = new Date().getFullYear();
  return `PED-${año}-${String(ultimoConsecutivo + 1).padStart(4, "0")}`;
}
