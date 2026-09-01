import { prisma } from "@/shared/db/prisma";
import type { DatosObjetivos } from "./tipos";
import type { TipoRelacionCliente } from "@/ai/estrategia/tipos";

const ESTADOS_COTIZACION_ACTIVA = ["BORRADOR", "REVISADA", "APROBADA", "ENVIADA"] as const;

// Ventana usada para decidir si la última compra sigue "reciente" al
// clasificar el tipo de relación (research.md Decisión 2).
const DIAS_VENTANA_CLIENTE_REGULAR = 90;

/**
 * Calcula los datos objetivos del perfil de un contacto a partir de
 * registros ya existentes del CRM — sin interpretación, sin IA (FR-001).
 * Restringido a `instanciaId` en cada query (FR-008, aislamiento multi-tenant).
 */
export async function calcularDatosObjetivos(
  contactoId: string,
  instanciaId: string,
): Promise<DatosObjetivos> {
  const [contacto, pedidosEntregados, oportunidadesActivas, cotizacionesActivas, incidenciasActivas, entregasPedido] =
    await Promise.all([
      prisma.contacto.findFirst({
        where: { id: contactoId, instanciaId },
        select: { creadoEn: true },
      }),
      prisma.pedido.findMany({
        where: { contactoId, instanciaId, estado: "ENTREGADO" },
        select: {
          fechaEntrega: true,
          creadoEn: true,
          lineas: { select: { productoId: true, producto: { select: { nombre: true } } } },
        },
      }),
      prisma.oportunidadContacto.findMany({
        where: { contactoId, oportunidad: { instanciaId, fechaGanada: null, fechaPerdida: null } },
        select: { oportunidad: { select: { id: true, titulo: true, etapa: true } } },
        take: 5,
      }),
      prisma.cotizacion.findMany({
        where: { contactoId, instanciaId, estado: { in: [...ESTADOS_COTIZACION_ACTIVA] } },
        select: { id: true, numero: true, estado: true },
        take: 5,
      }),
      prisma.conversacion.count({
        where: { contactoId, instanciaId, clasificacion: "SOPORTE" },
      }),
      prisma.entregaPedido.findMany({
        where: { pedido: { contactoId, instanciaId } },
        select: { metodoEntrega: true },
      }),
    ]);

  const fechaPrimeraInteraccion = (contacto?.creadoEn ?? new Date()).toISOString();

  const fechasEntrega = pedidosEntregados
    .map((p) => p.fechaEntrega ?? p.creadoEn)
    .sort((a, b) => b.getTime() - a.getTime());
  const fechaUltimaCompra = fechasEntrega[0]?.toISOString() ?? null;

  const productosComprados = Array.from(
    new Map(
      pedidosEntregados
        .flatMap((p) => p.lineas)
        .filter((l) => l.productoId && l.producto)
        .map((l) => [l.productoId as string, { productoId: l.productoId as string, nombre: l.producto!.nombre }]),
    ).values(),
  );

  const metodoEntregaHabitual = calcularMasFrecuente(entregasPedido.map((e) => e.metodoEntrega));

  return {
    numeroPedidosCompletados: pedidosEntregados.length,
    fechaPrimeraInteraccion,
    fechaUltimaCompra,
    productosComprados,
    oportunidadesAbiertas: oportunidadesActivas.map((oc) => ({
      id: oc.oportunidad.id,
      titulo: oc.oportunidad.titulo,
      etapa: oc.oportunidad.etapa,
    })),
    cotizacionesActivas: cotizacionesActivas.map((c) => ({ id: c.id, numero: c.numero, estado: c.estado })),
    incidenciasActivas,
    metodoEntregaHabitual,
  };
}

function calcularMasFrecuente<T extends string>(valores: T[]): T | null {
  if (valores.length === 0) return null;
  const conteo = new Map<T, number>();
  for (const v of valores) conteo.set(v, (conteo.get(v) ?? 0) + 1);
  return [...conteo.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Clasificación determinística del tipo de relación — sin IA (research.md
 * Decisión 2). Una incidencia activa pesa más que el historial de compra.
 */
export function clasificarTipoRelacion(datos: {
  pedidosCompletados: number;
  tieneInteraccionPrevia: boolean;
  fechaUltimaCompra: string | null;
  tieneIncidenciaActiva: boolean;
}): TipoRelacionCliente {
  if (datos.tieneIncidenciaActiva) return "CLIENTE_CON_INCIDENCIA";

  if (datos.pedidosCompletados === 0) {
    return datos.tieneInteraccionPrevia ? "PROSPECTO_RECURRENTE" : "NUEVO_CONTACTO";
  }

  const diasDesdeUltimaCompra = datos.fechaUltimaCompra
    ? (Date.now() - new Date(datos.fechaUltimaCompra).getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;

  if (diasDesdeUltimaCompra > DIAS_VENTANA_CLIENTE_REGULAR) return "CLIENTE_INACTIVO";

  return datos.pedidosCompletados >= 2 ? "CLIENTE_REGULAR" : "CLIENTE_NUEVO";
}
