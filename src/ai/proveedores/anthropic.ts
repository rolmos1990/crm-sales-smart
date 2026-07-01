import Anthropic from "@anthropic-ai/sdk";
import type {
  IProveedorIA,
  ChatParams,
  ChatResult,
  MensajeIA,
  ChatConHerramientasParams,
  ChatConHerramientasResult,
  MensajeIATool,
  ContenidoTextoBloque,
  ContenidoToolUse,
} from "./types";
import type { ProveedorIAEnum } from "@/generated/prisma/enums";

const MODELOS_ANTHROPIC = [
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
  "claude-opus-4-8",
];

export class AnthropicProvider implements IProveedorIA {
  readonly nombre: ProveedorIAEnum = "ANTHROPIC";

  private readonly client: Anthropic;
  private readonly modeloDefault: string;

  constructor(apiKey: string, modeloDefault = "claude-sonnet-4-6") {
    this.client = new Anthropic({ apiKey });
    this.modeloDefault = modeloDefault;
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    const inicio = Date.now();
    const modelo = params.modelo || this.modeloDefault;

    const systemMensaje = params.mensajes.find((m) => m.rol === "system");
    const userMensajes = params.mensajes.filter((m) => m.rol !== "system");

    const respuesta = await this.client.messages.create({
      model: modelo,
      max_tokens: params.maxTokens ?? 2048,
      temperature: params.temperatura ?? 0.7,
      ...(systemMensaje ? { system: systemMensaje.contenido } : {}),
      messages: userMensajes.map((m) => ({
        role: m.rol as "user" | "assistant",
        content: m.contenido,
      })),
    });

    const bloque = respuesta.content[0];
    const contenido = bloque.type === "text" ? bloque.text : "";

    return {
      contenido,
      tokensInput: respuesta.usage.input_tokens,
      tokensOutput: respuesta.usage.output_tokens,
      modelo,
      proveedor: "ANTHROPIC",
      tiempoMs: Date.now() - inicio,
    };
  }

  async *stream(params: ChatParams): AsyncIterable<string> {
    const modelo = params.modelo || this.modeloDefault;
    const systemMensaje = params.mensajes.find((m) => m.rol === "system");
    const userMensajes = params.mensajes.filter((m) => m.rol !== "system");

    const stream = await this.client.messages.stream({
      model: modelo,
      max_tokens: params.maxTokens ?? 2048,
      temperature: params.temperatura ?? 0.7,
      ...(systemMensaje ? { system: systemMensaje.contenido } : {}),
      messages: userMensajes.map((m) => ({
        role: m.rol as "user" | "assistant",
        content: m.contenido,
      })),
    });

    for await (const evento of stream) {
      if (
        evento.type === "content_block_delta" &&
        evento.delta.type === "text_delta"
      ) {
        yield evento.delta.text;
      }
    }
  }

  async chatConHerramientas(params: ChatConHerramientasParams): Promise<ChatConHerramientasResult> {
    const inicio = Date.now();
    const modelo = params.modelo || this.modeloDefault;

    const systemMsg = params.mensajes.find((m) => m.rol === "system");
    const conversacion = params.mensajes.filter(
      (m): m is Extract<MensajeIATool, { rol: "user" | "assistant" }> => m.rol !== "system",
    );

    const respuesta = await this.client.messages.create({
      model: modelo,
      max_tokens: params.maxTokens ?? 2048,
      temperature: params.temperatura ?? 0.7,
      ...(systemMsg ? { system: systemMsg.contenido as string } : {}),
      tools: params.herramientas,
      messages: convertirMensajesConTool(conversacion),
    });

    const tiempoMs = Date.now() - inicio;

    if (respuesta.stop_reason === "tool_use") {
      const contenidoAsistente = respuesta.content
        .map((b): ContenidoTextoBloque | ContenidoToolUse | null => {
          if (b.type === "text") return { type: "text", text: b.text };
          if (b.type === "tool_use")
            return { type: "tool_use", id: b.id, name: b.name, input: b.input as Record<string, unknown> };
          return null;
        })
        .filter((b): b is ContenidoTextoBloque | ContenidoToolUse => b !== null);

      return {
        tipo: "herramienta",
        herramientasLlamadas: contenidoAsistente.filter(
          (b): b is ContenidoToolUse => b.type === "tool_use",
        ),
        contenidoAsistente,
        tokensInput: respuesta.usage.input_tokens,
        tokensOutput: respuesta.usage.output_tokens,
        modelo,
        proveedor: "ANTHROPIC",
        tiempoMs,
      };
    }

    const textoBloque = respuesta.content.find((b) => b.type === "text");
    return {
      tipo: "texto",
      contenido: textoBloque?.type === "text" ? textoBloque.text : "",
      tokensInput: respuesta.usage.input_tokens,
      tokensOutput: respuesta.usage.output_tokens,
      modelo,
      proveedor: "ANTHROPIC",
      tiempoMs,
    };
  }

  async estaDisponible(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  obtenerModelos(): string[] {
    return MODELOS_ANTHROPIC;
  }
}

export function crearAnthropicProvider(
  apiKey: string,
  modeloDefault?: string,
): AnthropicProvider {
  return new AnthropicProvider(apiKey, modeloDefault);
}

function convertirMensajesConTool(
  mensajes: Array<Extract<MensajeIATool, { rol: "user" | "assistant" }>>,
): Anthropic.MessageParam[] {
  return mensajes.map((m) => {
    if (m.rol === "user") {
      if (typeof m.contenido === "string") {
        return { role: "user" as const, content: m.contenido };
      }
      return {
        role: "user" as const,
        content: m.contenido.map((r) => ({
          type: "tool_result" as const,
          tool_use_id: r.tool_use_id,
          content: r.content,
        })),
      };
    }
    // assistant
    if (typeof m.contenido === "string") {
      return { role: "assistant" as const, content: m.contenido };
    }
    return {
      role: "assistant" as const,
      content: m.contenido.map((b) => {
        if (b.type === "text") return { type: "text" as const, text: b.text };
        return { type: "tool_use" as const, id: b.id, name: b.name, input: b.input };
      }),
    };
  });
}
