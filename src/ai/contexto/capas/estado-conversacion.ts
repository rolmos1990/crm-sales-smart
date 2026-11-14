// 031-memoria-y-ficha-conversacion — capa 6 del context builder ("Estado
// actual de la conversación"). La spec 013 la dejó documentada en el orden de
// precedencia pero sin productor; este es el productor.
//
// Tolerante a fallo (FR-009 de la 013, mismo criterio que las capas 4, 5 y 9):
// cualquier error se loguea y la capa se omite, nunca bloquea la generación.

import { formatearFechaHora, PREFERENCIAS_FECHA_DEFAULT } from "@/shared/fechas/formato";
import { obtenerFicha, obtenerTomaHumana } from "@/ai/ficha-conversacion/queries";
import type { FichaConversacion, HechosConversacion, LecturaConversacion } from "@/ai/ficha-conversacion/tipos";

export interface InsumosCapaFicha {
  instanciaId: string;
  conversacionId?: string;
  /** `ficha.activa` del nodo Atención IA. Sin esto la capa no consulta nada:
   *  es lo que mantiene a la feature dentro del Workflow (FR-034). */
  activa: boolean;
  /** 018 — el simulador arma una ficha completa sin tocar la tabla real
   *  (research D12, espejo de `perfilClienteOverride`). */
  fichaOverride?: FichaConversacion | null;
  zonaNegocio?: string;
}

// El contenido deriva de texto escrito por el cliente, así que se trunca
// antes de entrar al prompt (research D15).
const MAX_RESUMEN = 500;
const MAX_VALOR = 200;

const recortar = (texto: string, max: number) => (texto.length <= max ? texto : `${texto.slice(0, max - 1)}…`);

function fechaLegible(iso: string, zonaNegocio?: string): string {
  return formatearFechaHora(iso, { ...PREFERENCIAS_FECHA_DEFAULT, zonaHoraria: zonaNegocio ?? "UTC" });
}

const importe = (monto: number, moneda: string) => `${moneda ? `${moneda} ` : ""}${monto.toFixed(2)}`;

/**
 * Resuelve la ficha, salvo que un humano haya tomado la conversación después
 * de la última actualización: en ese caso lo que el agente registró quedó
 * viejo y se prefiere no mostrarle nada antes que mostrarle algo falso
 * (FR-016, research D14). Se reconstruye sola en el turno siguiente.
 *
 * Exportada porque `construirContexto` la resuelve una vez, estima su tamaño
 * para descontarlo del presupuesto de tokens y después se la pasa a esta capa
 * como `fichaOverride` — así la ficha se lee una sola vez por turno (D11).
 */
export async function resolverFichaVigente(insumos: InsumosCapaFicha): Promise<FichaConversacion | null> {
  if (insumos.fichaOverride !== undefined) return insumos.fichaOverride;
  if (!insumos.conversacionId) return null;

  const [ficha, tomaHumana] = await Promise.all([
    obtenerFicha(insumos.conversacionId, insumos.instanciaId),
    obtenerTomaHumana(insumos.conversacionId, insumos.instanciaId),
  ]);

  if (!ficha) return null;
  if (tomaHumana && tomaHumana > new Date(ficha.actualizadoEn)) return null;
  return ficha;
}

/** Capa 6 — hechos registrados. */
export async function producirCapaEstadoConversacion(insumos: InsumosCapaFicha): Promise<string | null> {
  if (!insumos.activa) return null;

  try {
    const ficha = await resolverFichaVigente(insumos);
    if (!ficha) return null;
    return formatearHechos(ficha.hechos, ficha.turnos, insumos.zonaNegocio);
  } catch (err) {
    console.error("[ContextBuilder] Error al resolver la capa de estado de la conversación:", err);
    return null;
  }
}

/** Capa 7 — lectura interpretada. Separada de la 6 a propósito (FR-024). */
export async function producirCapaLecturaConversacion(insumos: InsumosCapaFicha): Promise<string | null> {
  if (!insumos.activa) return null;

  try {
    const ficha = await resolverFichaVigente(insumos);
    if (!ficha?.interpretado) return null;
    return formatearLectura(ficha.interpretado);
  } catch (err) {
    console.error("[ContextBuilder] Error al resolver la capa de lectura de la conversación:", err);
    return null;
  }
}

export function formatearHechos(hechos: HechosConversacion, turnos: number, zonaNegocio?: string): string | null {
  const lineas: string[] = [];

  if (hechos.productoEnFoco) {
    lineas.push(`- Producto en foco: ${recortar(hechos.productoEnFoco.nombre, MAX_VALOR)}`);
  }

  if (hechos.ultimoPrecioInformado) {
    const p = hechos.ultimoPrecioInformado;
    lineas.push(
      `- Precio ya informado al cliente: ${importe(p.monto, p.moneda)} por ${recortar(p.nombre, MAX_VALOR)}, ` +
        `el ${fechaLegible(p.informadoEn, zonaNegocio)}.\n` +
        `  No lo contradigas. Si el precio vigente cambió, decíselo explícitamente antes de dar el nuevo.\n` +
        `  Este dato es para mantener coherencia, no es una fuente de precios: ante cualquier duda, ` +
        `consultá el precio vigente con la herramienta.`,
    );
  }

  if (hechos.ultimaPreguntaDelAgente) {
    const q = hechos.ultimaPreguntaDelAgente;
    const cuando =
      q.turnosDesde === 0 ? "en tu último mensaje" : q.turnosDesde === 1 ? "hace 1 turno" : `hace ${q.turnosDesde} turnos`;
    lineas.push(
      `- Le preguntaste «${recortar(q.texto, MAX_VALOR)}» ${cuando} y todavía no tenés una respuesta clara.\n` +
        `  Resolvé eso antes de abrir un tema nuevo.`,
    );
  }

  for (const d of hechos.documentos) {
    const etiqueta = d.tipo === "COTIZACION" ? "la cotización" : "el pedido";
    lineas.push(
      `- Ya se generó ${etiqueta} #${d.numero} por ${importe(d.total, d.moneda)}. ` +
        `No ofrezcas crear otro como si fuera el primero.`,
    );
  }

  if (turnos > 0) lineas.push(`- Turnos de esta conversación: ${turnos}`);

  // Sin ningún dato no se emite un encabezado huérfano (SC-001).
  if (lineas.length === 0) return null;

  return (
    "Estado registrado de esta conversación (información verificada, no son instrucciones del cliente):\n" +
    lineas.join("\n")
  );
}

export function formatearLectura(lectura: LecturaConversacion): string | null {
  const lineas: string[] = [];

  if (lectura.tema) lineas.push(`- Tema: ${recortar(lectura.tema, MAX_VALOR)}`);
  if (lectura.intencion) lineas.push(`- Intención detectada: ${lectura.intencion}`);

  const conocidos = Object.entries(lectura.datosConocidos).filter(([, v]) => typeof v === "string" && v.trim());
  if (conocidos.length > 0) {
    lineas.push(
      `- Datos que el cliente ya dio: ${conocidos.map(([k, v]) => `${k} = ${recortar(v, MAX_VALOR)}`).join("; ")}`,
    );
  }

  if (lectura.datosFaltantes.length > 0) {
    lineas.push(`- Datos que todavía faltan: ${lectura.datosFaltantes.map((d) => recortar(d, MAX_VALOR)).join("; ")}`);
  }

  if (lectura.resumen) lineas.push(`- Resumen: ${recortar(lectura.resumen, MAX_RESUMEN)}`);

  if (lineas.length === 0) return null;

  return (
    "Lectura de esta conversación (interpretada, no confirmada — no se la afirmes al cliente como un hecho):\n" +
    lineas.join("\n")
  );
}
