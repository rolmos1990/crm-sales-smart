import { prisma } from "@/shared/db/prisma";
import { generarRespuesta } from "@/ai/gateway/gateway";
import type { DatosInterpretados } from "./tipos";

const INSTRUCCION_EXTRACCION = `Analiza el texto de esta conversación entre un cliente y un negocio. Devuelve ÚNICAMENTE un JSON (sin texto adicional, sin markdown) con este shape exacto, usando null en los campos que no puedas determinar con lo que ves:
{
  "intencionComercialActual": una de "EXPLORANDO"|"COMPARANDO"|"SOLICITANDO_RECOMENDACION"|"CONSULTANDO_PRECIO"|"CONSULTANDO_DISPONIBILIDAD"|"LISTO_PARA_COTIZAR"|"LISTO_PARA_COMPRAR"|"ESPERANDO_INFORMACION"|"REQUIERE_SEGUIMIENTO"|"REQUIERE_ATENCION_HUMANA" o null,
  "productosConsultados": string[],
  "preferenciasIdentificadas": string[],
  "presupuestoConocido": string o null,
  "ocasionActual": string o null,
  "fechaRequerida": string o null (fecha en formato ISO si se menciona una),
  "confianza": número entre 0 y 1
}`;

async function obtenerTextoRecienteConversaciones(contactoId: string, instanciaId: string): Promise<string[]> {
  const mensajes = await prisma.mensajeConversacion.findMany({
    where: { conversacion: { contactoId, instanciaId } },
    orderBy: { creadoEn: "desc" },
    take: 30,
    select: { contenido: true, remitente: true },
  });
  return mensajes
    .filter((m: { contenido: string | null }) => m.contenido && m.contenido.trim().length > 0)
    .reverse()
    .map((m: { contenido: string | null; remitente: string }) => `${m.remitente === "CONTACTO" ? "Cliente" : "Agente"}: ${m.contenido}`);
}

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
 * Extrae presupuesto/ocasión/intención/preferencias del texto reciente de
 * las conversaciones de un contacto — de mejor esfuerzo, tolerante a fallo
 * (FR-007 de la spec 012): nunca lanza, devuelve `null` si la IA no está
 * habilitada, falla, o el resultado no es parseable.
 */
export async function extraerDatosInterpretados(
  contactoId: string,
  instanciaId: string,
): Promise<DatosInterpretados | null> {
  try {
    const lineas = await obtenerTextoRecienteConversaciones(contactoId, instanciaId);
    if (lineas.length === 0) return null;

    const respuesta = await generarRespuesta({
      instanciaId,
      tarea: "EXTRACCION_ENTIDADES",
      mensajes: [
        { rol: "system", contenido: INSTRUCCION_EXTRACCION },
        { rol: "user", contenido: lineas.join("\n") },
      ],
      entidadTipo: "contacto",
      entidadId: contactoId,
    });

    const parseado = parsearJSONRespuesta(respuesta.contenido);
    if (!parseado) return null;

    return {
      intencionComercialActual: (parseado.intencionComercialActual as DatosInterpretados["intencionComercialActual"]) ?? null,
      productosConsultados: Array.isArray(parseado.productosConsultados)
        ? (parseado.productosConsultados as string[])
        : [],
      preferenciasIdentificadas: Array.isArray(parseado.preferenciasIdentificadas)
        ? (parseado.preferenciasIdentificadas as string[])
        : [],
      presupuestoConocido: (parseado.presupuestoConocido as string | null) ?? null,
      ocasionActual: (parseado.ocasionActual as string | null) ?? null,
      fechaRequerida: (parseado.fechaRequerida as string | null) ?? null,
      confianza: typeof parseado.confianza === "number" ? parseado.confianza : 0.5,
      extraidoEn: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[PerfilCliente] Error al extraer datos interpretados:", err);
    return null;
  }
}
