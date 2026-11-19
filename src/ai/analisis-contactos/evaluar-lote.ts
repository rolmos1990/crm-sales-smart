import { generarRespuesta } from "@/ai/gateway/gateway";
import type { EjecutorIA, RespuestaLoteIA } from "@/crm/contactos/analisis/types";
import { cargarConversacionesParaIA, construirContextoContacto, textosFuente } from "./contexto";
import { construirMensajesLote, PROMPT_SISTEMA_VERSION } from "./prompt";
import { validarSalidaLote } from "./salida";

/**
 * 042 — Ejecutor de IA de producción: UNA llamada por lote de UNA cuenta
 * (FR-015), por el gateway y los proveedores de la cuenta (FR-023), con la
 * tarea ANALISIS_CONTACTOS para que cada cuenta le asigne proveedor y modelo.
 *
 * Si el proveedor falla, el error viaja con el consumo que se haya podido
 * medir (`consumo`) para que la atención lo registre (FR-040).
 */

const TEMPERATURA = 0.2;

/**
 * Tope de la respuesta: una base fija (el envoltorio JSON y lo que el modelo
 * escribe aunque sea un solo contacto) más un margen por contacto. Con una
 * base chica, un lote de 1 contacto (P0/P1) quedaba en 750 tokens y la
 * respuesta llegaba cortada → RESPUESTA_INVALIDA. Medido en producción: ~620
 * tokens para un contacto solo y ~300 por contacto en lotes grandes.
 */
const TOKENS_SALIDA_BASE = 1000;
const TOKENS_SALIDA_POR_CONTACTO = 400;
const TOKENS_SALIDA_MAXIMO = 8000;

export function calcularMaxTokensSalida(contactos: number): number {
  return Math.min(TOKENS_SALIDA_MAXIMO, TOKENS_SALIDA_BASE + TOKENS_SALIDA_POR_CONTACTO * contactos);
}

export const evaluarLoteConIA: EjecutorIA = async (entrada) => {
  const ahora = new Date();
  const conversaciones = await cargarConversacionesParaIA(
    entrada.instanciaId,
    entrada.contactos.map((c) => ({ contactoId: c.contactoId, iaHasta: c.datos.evaluacionPrevia?.iaHasta ?? null })),
  );

  const refs = new Map<string, string>();
  const fuentes = new Map<string, string[]>();
  const contextos = entrada.contactos.map((c, i) => {
    const ref = `c${i + 1}`;
    refs.set(ref, c.contactoId);
    const ctx = construirContextoContacto(c, conversaciones.get(c.contactoId) ?? { resumenes: [], mensajesRecientes: [] }, ref, ahora);
    fuentes.set(ref, textosFuente(ctx));
    return ctx;
  });

  const mensajes = construirMensajesLote({ idioma: entrada.idioma, criterio: entrada.criterio, contactos: contextos });

  let respuesta;
  try {
    respuesta = await generarRespuesta({
      instanciaId: entrada.instanciaId,
      tarea: "ANALISIS_CONTACTOS",
      mensajes,
      temperatura: TEMPERATURA,
      maxTokens: calcularMaxTokensSalida(entrada.contactos.length),
      formatoRespuesta: "json",
      entidadTipo: "AnalisisContactosLote",
    });
  } catch (err) {
    throw Object.assign(err instanceof Error ? err : new Error(String(err)), {
      consumo: { promptVersion: PROMPT_SISTEMA_VERSION } satisfies Partial<RespuestaLoteIA>,
    });
  }

  const validacion = validarSalidaLote(respuesta.contenido, refs, fuentes);
  return {
    resultados: validacion.validos,
    invalidos: validacion.invalidos,
    omitidos: validacion.omitidos,
    loteInvalido: validacion.loteInvalido,
    tokensEntrada: respuesta.tokensInput,
    tokensSalida: respuesta.tokensOutput,
    tokensCacheados: respuesta.tokensCacheados,
    costoEstimado: respuesta.costoEstimado,
    usoIAId: respuesta.usoIAId,
    proveedorIAId: respuesta.proveedorIAId,
    proveedor: respuesta.proveedor,
    modelo: respuesta.modelo,
    promptVersion: PROMPT_SISTEMA_VERSION,
  };
};
