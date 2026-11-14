// 031-memoria-y-ficha-conversacion — capa 7: lectura interpretada de la
// conversación. Calcada de src/ai/perfil-cliente/extraccion-interpretada.ts,
// que resolvió el mismo problema para el perfil del contacto.
//
// Corre SIEMPRE después de que el mensaje ya salió (research D10, FR-022),
// con timeout acotado. De mejor esfuerzo: devuelve `null` ante cualquier
// problema y el llamador conserva la lectura anterior — nunca la borra
// (FR-023).

import { prisma } from "@/shared/db/prisma";
import { generarRespuesta } from "@/ai/gateway/gateway";
import { INTENCIONES_COMERCIALES } from "@/ai/estrategia/tipos";
import type { IntencionComercial, LecturaConversacion } from "./tipos";

/** El worker no puede quedarse colgado esperando al proveedor por un dato
 *  que es una mejora, no un requisito del turno. */
export const TIMEOUT_DERIVACION_MS = 10_000;

const MAX_MENSAJES_A_LEER = 30;

const INSTRUCCION = `Analiza esta conversación entre un cliente y un negocio. Devuelve ÚNICAMENTE un JSON (sin texto adicional, sin markdown) con este shape exacto, usando null en los campos que no puedas determinar con lo que ves:
{
  "tema": string o null (de qué se está hablando, en pocas palabras),
  "intencion": una de ${INTENCIONES_COMERCIALES.join("|")} o null,
  "datosConocidos": objeto clave→valor con lo que el cliente YA dijo (ej. {"ciudad": "Lima"}),
  "datosFaltantes": string[] con lo que todavía hace falta para cerrar la venta,
  "resumen": string o null (dos frases como máximo),
  "confianza": número entre 0 y 1
}`;

async function textoDeLaConversacion(conversacionId: string, instanciaId: string): Promise<string[]> {
  const mensajes = await prisma.mensajeConversacion.findMany({
    where: { conversacion: { id: conversacionId, instanciaId }, esNotaInterna: false },
    orderBy: { creadoEn: "desc" },
    take: MAX_MENSAJES_A_LEER,
    select: { contenido: true, remitente: true },
  });

  return mensajes
    .filter((m) => m.contenido?.trim())
    .reverse()
    .map((m) => `${m.remitente === "CONTACTO" ? "Cliente" : "Agente"}: ${m.contenido}`);
}

function parsearJSON(texto: string): Record<string, unknown> | null {
  const limpio = texto.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  try {
    const parseado = JSON.parse(limpio);
    return typeof parseado === "object" && parseado !== null && !Array.isArray(parseado)
      ? (parseado as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Un valor fuera del enum se descarta a null en vez de propagarse: el
 *  vocabulario de intenciones lo define Karia, no el modelo (FR-021). */
function intencionValida(valor: unknown): IntencionComercial | null {
  return typeof valor === "string" && (INTENCIONES_COMERCIALES as readonly string[]).includes(valor)
    ? (valor as IntencionComercial)
    : null;
}

function registroDeTextos(valor: unknown): Record<string, string> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};
  return Object.fromEntries(
    Object.entries(valor as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string"),
  );
}

const textoONull = (valor: unknown): string | null => (typeof valor === "string" && valor.trim() ? valor.trim() : null);

async function conTimeout<T>(promesa: Promise<T>, ms: number): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout>;
  const limite = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error(`La derivación superó ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([promesa, limite]);
  } finally {
    clearTimeout(temporizador!);
  }
}

export async function derivarLectura(
  conversacionId: string,
  instanciaId: string,
): Promise<LecturaConversacion | null> {
  try {
    const lineas = await textoDeLaConversacion(conversacionId, instanciaId);
    if (lineas.length === 0) return null;

    const respuesta = await conTimeout(
      generarRespuesta({
        instanciaId,
        // Ruteable a un modelo económico por el enrutamiento por objetivo de
        // la spec 010: esto no necesita el modelo que atiende al cliente.
        tarea: "EXTRACCION_ENTIDADES",
        mensajes: [
          { rol: "system", contenido: INSTRUCCION },
          { rol: "user", contenido: lineas.join("\n") },
        ],
        entidadTipo: "conversacion",
        entidadId: conversacionId,
      }),
      TIMEOUT_DERIVACION_MS,
    );

    const parseado = parsearJSON(respuesta.contenido);
    if (!parseado) return null;

    return {
      tema: textoONull(parseado.tema),
      intencion: intencionValida(parseado.intencion),
      datosConocidos: registroDeTextos(parseado.datosConocidos),
      datosFaltantes: Array.isArray(parseado.datosFaltantes)
        ? parseado.datosFaltantes.filter((d): d is string => typeof d === "string" && d.trim().length > 0)
        : [],
      resumen: textoONull(parseado.resumen),
      confianza: typeof parseado.confianza === "number" ? parseado.confianza : 0.5,
      derivadoEn: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[FichaConversacion] Error al derivar la lectura de la conversación:", err);
    return null;
  }
}
