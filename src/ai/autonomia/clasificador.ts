import { generarRespuesta } from "@/ai/gateway/gateway";
import { CategoriaIntencionAutonomia } from "@/generated/prisma/enums";
import type { ClasificacionIntencion } from "./tipos";

const CATEGORIAS_VALIDAS = new Set<string>(Object.values(CategoriaIntencionAutonomia));

const INSTRUCCION_CLASIFICACION = `Clasifica el siguiente mensaje de un cliente en una o más de estas categorías (usa las más probables, normalmente 1, hasta 2 si el mensaje mezcla intenciones claramente distintas):
SALUDO, CONSULTA_HORARIO, PREGUNTA_FRECUENTE, INFORMACION_GENERAL, RECOMENDACION, CONSULTA_PRECIO, CONSULTA_DISPONIBILIDAD, COSTO_ENVIO, SOLICITUD_COTIZACION, RECLAMO, SOLICITUD_REEMBOLSO, DESCUENTO_ESPECIAL, PROBLEMA_PAGO, EXCEPCION_ENTREGA, CLIENTE_MOLESTO, COMPROMISO_NO_DEFINIDO.

Devuelve ÚNICAMENTE un JSON (sin texto adicional, sin markdown) con este shape exacto:
{
  "categorias": [{ "categoria": "UNA_DE_LAS_CATEGORIAS", "confianza": número entre 0 y 1 }]
}`;

function parsearJSONRespuesta(texto: string): Record<string, unknown> | null {
  const limpio = texto.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  try {
    const parseado = JSON.parse(limpio);
    return typeof parseado === "object" && parseado !== null ? (parseado as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Clasifica un mensaje en una o más categorías de intención, tolerante a
 * fallo (FR-010): nunca lanza, devuelve `null` si la IA no está habilitada,
 * el proveedor falla, o el resultado no es parseable — en cuyo caso el
 * llamador (decidirAutonomia) debe tratarlo igual que "sin configuración".
 */
export async function clasificarCategoriaIntencion(
  mensaje: string,
  instanciaId: string,
): Promise<ClasificacionIntencion | null> {
  if (!mensaje.trim()) return null;

  try {
    const respuesta = await generarRespuesta({
      instanciaId,
      tarea: "CLASIFICACION",
      mensajes: [
        { rol: "system", contenido: INSTRUCCION_CLASIFICACION },
        { rol: "user", contenido: mensaje },
      ],
      entidadTipo: "mensaje",
    });

    const parseado = parsearJSONRespuesta(respuesta.contenido);
    if (!parseado || !Array.isArray(parseado.categorias)) return null;

    const categorias = parseado.categorias
      .filter(
        (c): c is { categoria: string; confianza: number } =>
          typeof c === "object" &&
          c !== null &&
          typeof (c as Record<string, unknown>).categoria === "string" &&
          CATEGORIAS_VALIDAS.has((c as Record<string, unknown>).categoria as string),
      )
      .map((c) => ({
        categoria: c.categoria as ClasificacionIntencion["categorias"][number]["categoria"],
        confianza: typeof c.confianza === "number" ? c.confianza : 0.5,
      }));

    if (categorias.length === 0) return null;
    return { categorias };
  } catch (err) {
    console.error("[Autonomia] Error al clasificar intención:", err);
    return null;
  }
}
