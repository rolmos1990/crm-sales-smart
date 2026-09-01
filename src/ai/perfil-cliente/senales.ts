import type { DatosObjetivos } from "./tipos";

/**
 * Genera señales objetivas en lenguaje natural a partir de datos ya
 * calculados — por plantilla, nunca por IA (research.md Decisión 3, spec
 * 012). Garantiza por construcción que ninguna señal contiene un juicio de
 * valor: una plantilla fija no puede "decidir" usar un adjetivo subjetivo.
 */
export function generarSenalesObjetivas(datos: DatosObjetivos): string[] {
  const senales: string[] = [];

  if (datos.numeroPedidosCompletados > 0) {
    senales.push(
      `Ha completado ${datos.numeroPedidosCompletados} pedido${datos.numeroPedidosCompletados === 1 ? "" : "s"}` +
        (datos.fechaUltimaCompra
          ? `, el más reciente el ${formatearFecha(datos.fechaUltimaCompra)}.`
          : "."),
    );
  } else {
    senales.push("No posee pedidos completados.");
  }

  if (datos.oportunidadesAbiertas.length > 0) {
    senales.push(
      `Tiene ${datos.oportunidadesAbiertas.length} oportunidad${datos.oportunidadesAbiertas.length === 1 ? "" : "es"} abierta${datos.oportunidadesAbiertas.length === 1 ? "" : "s"}.`,
    );
  }

  if (datos.cotizacionesActivas.length > 0) {
    const n = datos.cotizacionesActivas.length;
    senales.push(
      `Tiene ${n} ${n === 1 ? "cotización activa" : "cotizaciones activas"} sin resolver.`,
    );
  }

  if (datos.incidenciasActivas > 0) {
    const n = datos.incidenciasActivas;
    senales.push(
      `Tiene ${n} ${n === 1 ? "conversación clasificada" : "conversaciones clasificadas"} como soporte.`,
    );
  }

  if (datos.metodoEntregaHabitual) {
    senales.push(`Su método de entrega más frecuente es ${datos.metodoEntregaHabitual}.`);
  }

  return senales;
}

// timeZone explícito: sin esto, el resultado depende de la zona horaria del
// proceso que ejecuta el código (no de la fecha en sí), lo que puede mover
// una fecha cercana a medianoche UTC al día anterior según el servidor.
function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-PE", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
