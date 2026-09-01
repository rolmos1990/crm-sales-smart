import { prisma } from "@/shared/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { generarRespuesta } from "@/ai/gateway/gateway";
import { listarRecomendacionesRechazadas } from "./queries";
import type { ContenidoAnonimizado } from "./tipos";

const INSTRUCCION_ANALISIS = `Analiza estos ejemplos de conversaciones piloto (marcadas como buena o mala atención por un humano) y produce recomendaciones concretas para mejorar el comportamiento del agente de IA. No repitas una recomendación equivalente a una ya rechazada (se te lista abajo, si aplica).

Devuelve ÚNICAMENTE un JSON (sin texto adicional, sin markdown) con este shape exacto:
{
  "recomendaciones": [
    { "titulo": string, "descripcion": string, "reglaSugerida": string, "confianza": número entre 0 y 1 }
  ]
}
Si no encontrás ningún patrón claro y accionable, devolvé { "recomendaciones": [] }.`;

function parsearJSONRespuesta(texto: string): Record<string, unknown> | null {
  const limpio = texto.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  try {
    const parseado = JSON.parse(limpio);
    return typeof parseado === "object" && parseado !== null ? (parseado as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function normalizarTexto(texto: string): string {
  return texto.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}

/**
 * FR-007/FR-008 — genera RecomendacionComportamiento en PENDIENTE a partir
 * de las ConversacionPiloto incluidas en el perfil; nunca auto-aplica nada.
 * Tolerante al caso sin datos (Edge Case): sin conversaciones incluidas o
 * sin patrones detectados → recomendacionesGeneradas: 0, sin error.
 */
export async function ejecutarAnalisisPiloto(
  instanciaId: string,
  agenteIAConfigId?: string,
  // 017-aprendizaje-supervisado-auditoria (Historia 3) — research.md
  // Decisión 5: reutiliza este mismo mecanismo para correcciones, sin
  // ninguna ruta nueva de escritura hacia AgenteIAConfig.
  opciones?: { incluirCorreccionesRecientes?: boolean },
): Promise<{ exito: true; recomendacionesGeneradas: number } | { exito: false; error: string }> {
  try {
    const conversacionesPiloto = await prisma.conversacionPiloto.findMany({
      where: { instanciaId, incluidaEnPerfil: true },
      select: { id: true, clasificacion: true, explicacion: true, contenidoAnonimizado: true },
    });

    const correcciones = opciones?.incluirCorreccionesRecientes
      ? await (await import("@/ai/autonomia/queries")).listarCorreccionesRecientes(instanciaId, agenteIAConfigId)
      : [];

    if (conversacionesPiloto.length === 0 && correcciones.length === 0) {
      return { exito: true, recomendacionesGeneradas: 0 };
    }

    const rechazadas = await listarRecomendacionesRechazadas(instanciaId, agenteIAConfigId);
    const reglasRechazadasNormalizadas = new Set(rechazadas.map((r) => normalizarTexto(r.reglaSugerida)));

    const bloqueEjemplos = conversacionesPiloto
      .map((c, i) => {
        const contenido = c.contenidoAnonimizado as unknown as ContenidoAnonimizado | null;
        const texto = contenido?.mensajes?.map((m) => `${m.rol}: ${m.texto}`).join("\n") ?? "(sin contenido anonimizado)";
        return `Ejemplo ${i + 1} (${c.clasificacion}) — ${c.explicacion}:\n${texto}`;
      })
      .join("\n\n");

    const bloqueRechazadas = rechazadas.length > 0
      ? `\n\nRecomendaciones ya rechazadas (no las repitas de forma equivalente):\n${rechazadas.map((r) => `- ${r.reglaSugerida}`).join("\n")}`
      : "";

    // 017-aprendizaje-supervisado-auditoria (Historia 3) — correcciones
    // humanas recientes (respuestas propuestas por la IA que un humano
    // editó antes de enviar) como contexto adicional del análisis.
    const bloqueCorrecciones = correcciones.length > 0
      ? "\n\nCorrecciones humanas recientes (la IA propuso, un humano editó antes de enviar):\n" +
        correcciones
          .map((c, i) => `Corrección ${i + 1}:\nCliente: ${c.mensajeCliente}\nPropuesta por la IA: ${c.respuestaPropuesta}\nEnviada finalmente: ${c.respuestaEditada}`)
          .join("\n\n")
      : "";

    const respuesta = await generarRespuesta({
      instanciaId,
      agenteIAConfigId,
      tarea: "REPORTE",
      mensajes: [
        { rol: "system", contenido: INSTRUCCION_ANALISIS },
        { rol: "user", contenido: bloqueEjemplos + bloqueRechazadas + bloqueCorrecciones },
      ],
      entidadTipo: "instancia",
      entidadId: instanciaId,
    });

    const parseado = parsearJSONRespuesta(respuesta.contenido);
    const recomendacionesCrudas = Array.isArray(parseado?.recomendaciones) ? (parseado!.recomendaciones as unknown[]) : [];

    const idsConversacionesPiloto = conversacionesPiloto.map((c) => c.id);
    let generadas = 0;

    for (const cruda of recomendacionesCrudas) {
      if (typeof cruda !== "object" || cruda === null) continue;
      const r = cruda as Record<string, unknown>;
      if (typeof r.titulo !== "string" || typeof r.descripcion !== "string" || typeof r.reglaSugerida !== "string") continue;

      // research.md Decisión 3 — red de seguridad adicional por normalización de texto.
      if (reglasRechazadasNormalizadas.has(normalizarTexto(r.reglaSugerida))) continue;

      await prisma.recomendacionComportamiento.create({
        data: {
          instanciaId,
          agenteIAConfigId,
          titulo: r.titulo,
          descripcion: r.descripcion,
          reglaSugerida: r.reglaSugerida,
          confianza: typeof r.confianza === "number" ? Math.max(0, Math.min(1, r.confianza)) : 0.5,
          estado: "PENDIENTE",
          basadaEnConversacionesPilotoIds: idsConversacionesPiloto as unknown as Prisma.InputJsonValue,
        },
      });
      generadas++;
    }

    return { exito: true, recomendacionesGeneradas: generadas };
  } catch (err) {
    console.error("[Piloto] Error al ejecutar el análisis:", err);
    return { exito: false, error: "No se pudo ejecutar el análisis en este momento" };
  }
}
