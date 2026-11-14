// Conversores del formato interno de Karia al de la API de chat de OpenAI.
//
// Los comparten los proveedores que hablan ese dialecto: OpenAI, y los que lo
// imitan (DeepSeek, NVIDIA). Vivían duplicados byte a byte en cada uno; al
// sumar el tercero eso pasaba a ser una copia más que mantener sincronizada,
// y un arreglo en uno que no llega a los otros es un bug silencioso en el
// tool-calling del agente.
//
// El formato interno es el de Anthropic (bloques `tool_use` / `tool_result`)
// porque es el que mejor expresa un turno con herramientas; acá se traduce.

import type OpenAI from "openai";
import type {
  ContenidoTextoBloque,
  ContenidoToolUse,
  DefinicionHerramienta,
  MensajeIATool,
} from "./types";

export function convertirMensajesSimples(
  mensajes: Array<{ rol: "system" | "user" | "assistant"; contenido: string }>,
): OpenAI.ChatCompletionMessageParam[] {
  return mensajes.map((m) => ({
    role: m.rol as "system" | "user" | "assistant",
    content: m.contenido,
  }));
}

export function convertirMensajesConTool(mensajes: MensajeIATool[]): OpenAI.ChatCompletionMessageParam[] {
  const resultado: OpenAI.ChatCompletionMessageParam[] = [];

  for (const m of mensajes) {
    if (m.rol === "system") {
      resultado.push({ role: "system", content: m.contenido });
    } else if (m.rol === "user") {
      if (typeof m.contenido === "string") {
        resultado.push({ role: "user", content: m.contenido });
      } else {
        // ContenidoToolResult[] → un mensaje role "tool" por resultado.
        for (const tr of m.contenido) {
          resultado.push({ role: "tool", tool_call_id: tr.tool_use_id, content: tr.content });
        }
      }
    } else {
      if (typeof m.contenido === "string") {
        resultado.push({ role: "assistant", content: m.contenido });
      } else {
        // Array<ContenidoTextoBloque | ContenidoToolUse> → assistant con tool_calls.
        const textoParts = m.contenido
          .filter((b): b is ContenidoTextoBloque => b.type === "text")
          .map((b) => b.text)
          .join("");

        const toolCalls = m.contenido
          .filter((b): b is ContenidoToolUse => b.type === "tool_use")
          .map((b) => ({
            id: b.id,
            type: "function" as const,
            function: { name: b.name, arguments: JSON.stringify(b.input) },
          }));

        resultado.push({
          role: "assistant",
          content: textoParts || null,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        });
      }
    }
  }

  return resultado;
}

export function convertirHerramientas(herramientas: DefinicionHerramienta[]): OpenAI.ChatCompletionTool[] {
  return herramientas.map((h) => ({
    type: "function" as const,
    function: {
      name: h.name,
      description: h.description,
      parameters: h.input_schema as Record<string, unknown>,
    },
  }));
}
