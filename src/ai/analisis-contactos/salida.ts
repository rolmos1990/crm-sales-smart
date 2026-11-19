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
const LARGO_CITA = 25;

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

/** true si el texto no puede guardarse (FR-017a). `fuentesNormalizadas` ya pasadas por `normalizar`. */
export function contieneDatosPrivados(textoSalida: string, fuentesNormalizadas: string[]): boolean {
  if (EMAIL.test(textoSalida) || URL.test(textoSalida) || tieneSecuenciaLarga(textoSalida)) return true;
  const n = normalizar(textoSalida);
  if (DIRECCION.test(n)) return true;
  return copiaDeFuente(n, fuentesNormalizadas);
}

// ── Validación del lote ───────────────────────────────────────────────────────

export interface ResultadoValidacion {
  /** Por contactoId. */
  validos: Map<string, ResultadoIAContacto>;
  invalidos: string[];
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
    if (!parseado.success) return { validos: new Map(), invalidos: [], omitidos: todos, loteInvalido: true };
    raiz = parseado.data;
  } catch {
    return { validos: new Map(), invalidos: [], omitidos: todos, loteInvalido: true };
  }

  const vistas = new Map<string, number>();
  for (const e of raiz.evaluaciones) {
    const ref = (e as { ref?: unknown })?.ref;
    if (typeof ref === "string" && refs.has(ref)) vistas.set(ref, (vistas.get(ref) ?? 0) + 1);
  }

  const validos = new Map<string, ResultadoIAContacto>();
  const invalidos = new Set<string>();

  for (const e of raiz.evaluaciones) {
    const ref = (e as { ref?: unknown })?.ref;
    if (typeof ref !== "string" || !refs.has(ref)) continue; // ajena o inventada: se descarta
    const contactoId = refs.get(ref)!;
    if ((vistas.get(ref) ?? 0) > 1) {
      invalidos.add(contactoId);
      continue;
    }
    const r = EvaluacionIASchema.safeParse(e);
    if (!r.success) {
      invalidos.add(contactoId);
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
    if (textosLibres.some((t) => contieneDatosPrivados(t, fuentesRef))) {
      invalidos.add(contactoId);
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
  return { validos, invalidos: [...invalidos], omitidos, loteInvalido: false };
}
