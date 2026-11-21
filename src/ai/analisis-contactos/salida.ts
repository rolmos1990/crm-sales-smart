import { z } from "zod";
import { INTENCIONES_COMERCIALES } from "@/ai/estrategia/tipos";
import type { ResultadoIAContacto } from "@/crm/contactos/analisis/types";

/**
 * 042 — Validación de lo que devuelve la IA para un lote (contracts/ia-analisis-lote.md).
 *
 * El modelo nunca ve ids internos: responde con referencias del lote (c1…cN)
 * y acá se traducen. Una referencia ajena se descarta (no puede tocar otro
 * contacto, mucho menos de otra cuenta); una repetida invalida todas sus
 * entradas; una que falta deja al contacto OMITIDO (FR-017).
 *
 * Privacidad (FR-017a): se RECHAZA —no se enmascara— todo texto con datos de
 * forma reconocible o copiado de la conversación. Salud y pago no se pueden
 * detectar sin falsos positivos ("pregunta por formas de pago" es una señal
 * legítima): esos los prohíbe la instrucción fija y se revisan por muestreo.
 */

const MAX_ITEMS = 5;
const MAX_LARGO = 120;
/**
 * 052 — Largo mínimo de un tramo literal para considerarlo una cita.
 *
 * **El número sale de medir producción, no de estimar. Bajarlo exige repetir la
 * medición.** Estuvo en 25 y rechazaba uno de cada diecisiete análisis por
 * frases como "el precio de las esferas": 25 caracteres de español corriente
 * los alcanza cualquier resumen fiel de una conversación comercial.
 *
 * Solapamiento máximo medido sobre 1284 textos libres de 400 evaluaciones de IA
 * YA ACEPTADAS, contra los mensajes de cada contacto:
 *
 *   p50  9  ·  p90 15  ·  p95 19  ·  p99 22  ·  p99.9 24  ·  máximo 24
 *
 * Que el máximo aceptado fuera 24 **con el umbral en 25 no prueba holgura:
 * prueba truncamiento**. Todo texto que hubiera superado 24 fue rechazado y
 * nunca llegó a guardarse, así que no puede aparecer en la medición. Del otro
 * lado, los cinco rechazos reproducidos contra la API tienen solape 26, 26, 26,
 * 28 y 29. No hay hueco entre ambos grupos: es una sola distribución de
 * paráfrasis natural, partida al medio.
 *
 * 40 deja ~38 % de margen sobre el peor falso positivo medido y sigue atrapando
 * una cita de verdad: la del test de esta misma batería tiene 48 caracteres de
 * solape y se rechaza. El tope del campo es 120, así que 40 es un tercio del
 * texto máximo — no es un control simbólico.
 *
 * Detalle: specs/052-fix-filtro-citas-analisis/research.md Decisión 1.
 */
const LARGO_CITA = 40;

const texto = z.string().trim().min(1).max(MAX_LARGO);
const lista = z.array(texto).max(MAX_ITEMS);
const opcional = z.string().trim().max(MAX_LARGO).nullable().optional();

const ACCIONES_IA = [
  "CONTACTAR_HOY",
  "ENVIAR_COTIZACION",
  "DAR_SEGUIMIENTO",
  "RESOLVER_OBJECION",
  "REACTIVAR",
  "OFRECER_NOVEDADES",
  "ESPERAR",
  "SIN_ACCION",
] as const;

export const EvaluacionIASchema = z.object({
  ref: z.string().min(1).max(10),
  intencion: z.enum(["ALTA", "MEDIA", "BAJA", "DESCONOCIDA"]),
  intencionComercial: z.enum(INTENCIONES_COMERCIALES).nullable().optional(),
  urgencia: z.enum(["ALTA", "MEDIA", "BAJA"]),
  recuperacion: z.enum(["ALTA", "MEDIA", "BAJA", "NO_APLICA"]),
  ajustePuntaje: z.number().int().min(-40).max(40),
  senales: lista,
  objeciones: lista,
  motivos: lista,
  // RESPONDER y NO_CONTACTAR los deciden solo las reglas (FR-021).
  accionSugerida: z.enum(ACCIONES_IA),
  sugerirNoContactar: z.boolean(),
  motivoNoContactar: opcional,
  productosConsultados: lista.optional().default([]),
  presupuestoConocido: opcional,
  ocasionActual: opcional,
  fechaRequerida: opcional,
});

const RaizSchema = z.object({ evaluaciones: z.array(z.unknown()) });

// ── Privacidad ────────────────────────────────────────────────────────────────

export function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type MotivoPrivacidad = "EMAIL" | "URL" | "SECUENCIA_NUMERICA" | "DIRECCION" | "CITA";

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const URL = /(https?:\/\/|www\.)\S+/i;
const SECUENCIA_NUMERICA = /\+?\d[\d\s().-]{5,}\d/g;
// Palabra de vía seguida de un número cerca (research D8). "lote" solo
// pegado al número, para no confundir "un lote de 20 unidades".
const DIRECCION = /\b(calle|av\.?|avenida|jr\.?|jiron|pasaje|psje\.?|carrera|cra\.?|mz\.?|manzana)\s+[^\n]{0,15}?\d|\blote\s*[a-z]?-?\d/i;

function tieneSecuenciaLarga(t: string): boolean {
  for (const m of t.matchAll(SECUENCIA_NUMERICA)) {
    if (m[0].replace(/\D/g, "").length >= 7) return true;
  }
  return false;
}

function copiaDeFuente(t: string, fuentes: string[]): boolean {
  if (t.length < LARGO_CITA || fuentes.length === 0) return false;
  for (let i = 0; i + LARGO_CITA <= t.length; i++) {
    const trozo = t.slice(i, i + LARGO_CITA);
    if (fuentes.some((f) => f.includes(trozo))) return true;
  }
  return false;
}

/**
 * 052 — Devuelve el MOTIVO por el que el texto no puede guardarse, o `null` si
 * es aceptable (FR-017a).
 *
 * Antes devolvía un booleano, y los cinco controles eran indistinguibles entre
 * sí. Aguas abajo los tres motivos de rechazo compartían además el mismo
 * `RESPUESTA_INVALIDA`, así que averiguar por qué se caía una evaluación exigió
 * reconstruir el pipeline entero y volver a llamar a la IA contacto por
 * contacto. La distinción que hacía falta era `CITA` —que es calibración—
 * contra los otros cuatro, que son datos reales.
 *
 * **El orden es parte del contrato.** Un texto que dispara dos controles
 * reporta el primero; reordenar no cambia qué se rechaza, pero sí qué queda
 * registrado, que es lo único que evita repetir aquella investigación.
 *
 * `fuentesNormalizadas` ya pasadas por `normalizar`.
 */
export function contieneDatosPrivados(
  textoSalida: string,
  fuentesNormalizadas: string[],
): MotivoPrivacidad | null {
  if (EMAIL.test(textoSalida)) return "EMAIL";
  if (URL.test(textoSalida)) return "URL";
  if (tieneSecuenciaLarga(textoSalida)) return "SECUENCIA_NUMERICA";
  const n = normalizar(textoSalida);
  if (DIRECCION.test(n)) return "DIRECCION";
  return copiaDeFuente(n, fuentesNormalizadas) ? "CITA" : null;
}

// ── Validación del lote ───────────────────────────────────────────────────────

/**
 * 052 — Por qué se rechazó la evaluación de un contacto.
 *
 * Los tres grandes motivos compartían `RESPUESTA_INVALIDA` aguas abajo, y los
 * cinco controles de privacidad eran indistinguibles entre sí. Separarlos es lo
 * que permite saber, leyendo la auditoría, si una subida de rechazos es
 * calibración del filtro de citas o información personal entrando de verdad.
 */
export type MotivoRechazo =
  | "REF_DUPLICADA"
  | "FORMATO_INVALIDO"
  | `PRIVACIDAD_${MotivoPrivacidad}`;

export interface ResultadoValidacion {
  /** Por contactoId. */
  validos: Map<string, ResultadoIAContacto>;
  /** contactoId → motivo del rechazo. */
  invalidos: Map<string, MotivoRechazo>;
  omitidos: string[];
  loteInvalido: boolean;
}

function limpiarJson(t: string): string {
  return t.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}

/**
 * @param refs referencia del lote → contactoId
 * @param fuentes referencia → textos de conversación que vio la IA (para detectar citas)
 */
export function validarSalidaLote(
  textoRespuesta: string,
  refs: Map<string, string>,
  fuentes: Map<string, string[]>,
): ResultadoValidacion {
  const todos = [...refs.values()];
  let raiz: z.infer<typeof RaizSchema>;
  try {
    const parseado = RaizSchema.safeParse(JSON.parse(limpiarJson(textoRespuesta)));
    if (!parseado.success) return { validos: new Map(), invalidos: new Map(), omitidos: todos, loteInvalido: true };
    raiz = parseado.data;
  } catch {
    return { validos: new Map(), invalidos: new Map(), omitidos: todos, loteInvalido: true };
  }

  const vistas = new Map<string, number>();
  for (const e of raiz.evaluaciones) {
    const ref = (e as { ref?: unknown })?.ref;
    if (typeof ref === "string" && refs.has(ref)) vistas.set(ref, (vistas.get(ref) ?? 0) + 1);
  }

  const validos = new Map<string, ResultadoIAContacto>();
  const invalidos = new Map<string, MotivoRechazo>();

  for (const e of raiz.evaluaciones) {
    const ref = (e as { ref?: unknown })?.ref;
    if (typeof ref !== "string" || !refs.has(ref)) continue; // ajena o inventada: se descarta
    const contactoId = refs.get(ref)!;
    if ((vistas.get(ref) ?? 0) > 1) {
      invalidos.set(contactoId, "REF_DUPLICADA");
      continue;
    }
    const r = EvaluacionIASchema.safeParse(e);
    if (!r.success) {
      invalidos.set(contactoId, "FORMATO_INVALIDO");
      continue;
    }
    const d = r.data;
    const fuentesRef = (fuentes.get(ref) ?? []).map(normalizar);
    const textosLibres = [
      ...d.senales,
      ...d.objeciones,
      ...d.motivos,
      ...(d.motivoNoContactar ? [d.motivoNoContactar] : []),
    ];
    // El primer texto que dispare manda, en el orden en que se armó la lista.
    let motivoPrivacidad: MotivoPrivacidad | null = null;
    for (const t of textosLibres) {
      motivoPrivacidad = contieneDatosPrivados(t, fuentesRef);
      if (motivoPrivacidad) break;
    }
    if (motivoPrivacidad) {
      invalidos.set(contactoId, `PRIVACIDAD_${motivoPrivacidad}`);
      continue;
    }
    validos.set(contactoId, {
      intencion: d.intencion,
      intencionComercial: d.intencionComercial ?? null,
      urgencia: d.urgencia,
      recuperacion: d.recuperacion,
      ajustePuntaje: d.ajustePuntaje,
      senales: d.senales,
      objeciones: d.objeciones,
      motivos: d.motivos,
      accionSugerida: d.accionSugerida,
      sugerirNoContactar: d.sugerirNoContactar,
      motivoNoContactar: d.motivoNoContactar ?? null,
      productosConsultados: d.productosConsultados,
      presupuestoConocido: d.presupuestoConocido ?? null,
      ocasionActual: d.ocasionActual ?? null,
      fechaRequerida: d.fechaRequerida ?? null,
    });
  }

  const omitidos = todos.filter((id) => !validos.has(id) && !invalidos.has(id));
  return { validos, invalidos, omitidos, loteInvalido: false };
}
