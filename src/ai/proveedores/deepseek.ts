import OpenAI from "openai";
import type {
  IProveedorIA,
  ChatParams,
  ChatResult,
  ChatConHerramientasParams,
  ChatConHerramientasResult,
  MensajeIATool,
  DefinicionHerramienta,
  ContenidoTextoBloque,
  ContenidoToolUse,
} from "./types";
import type { ProveedorIAEnum } from "@/generated/prisma/enums";
import {
  convertirHerramientas,
  convertirMensajesConTool,
  convertirMensajesSimples,
} from "./openai-compat";

const MODELOS_DEEPSEEK = [
  // Aliases que siempre apuntan a la última versión de cada familia
  "deepseek-chat",       // → última versión general (V3+)
  "deepseek-reasoner",   // → último modelo de razonamiento (R1+)
  // V3 — familia general
  "deepseek-v3",
  "deepseek-v3-0324",
  // V4 — familia general (2025)
  "deepseek-v4",
  "deepseek-v4-0709",
  // R1 — familia de razonamiento
  "deepseek-r1",
  "deepseek-r1-0528",
  // Coder
  "deepseek-coder",
  "deepseek-coder-v2",
];

export class DeepSeekProvider implements IProveedorIA {
  readonly nombre: ProveedorIAEnum = "DEEPSEEK";

  private readonly client: OpenAI;
  private readonly modeloDefault: string;

  constructor(apiKey: string, modeloDefault = "deepseek-chat") {
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.deepseek.com/v1",
    });
    this.modeloDefault = modeloDefault;
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    const inicio = Date.now();
    const modelo = params.modelo || this.modeloDefault;

    const respuesta = await this.client.chat.completions.create({
      model: modelo,
      max_tokens: params.maxTokens ?? 2048,
      temperature: params.temperatura ?? 0.7,
      messages: convertirMensajesSimples(params.mensajes),
      // 042 — solo si se pide: sin el parámetro, el pedido es idéntico al de siempre.
      ...(params.formatoRespuesta === "json" ? { response_format: { type: "json_object" as const } } : {}),
    });

    const contenido = respuesta.choices[0]?.message?.content ?? "";
    // DeepSeek informa la caché de contexto con un campo propio, fuera del tipo del SDK de OpenAI.
    const usoDeepSeek = respuesta.usage as { prompt_cache_hit_tokens?: number } | undefined;

    return {
      contenido,
      tokensInput: respuesta.usage?.prompt_tokens ?? 0,
      tokensOutput: respuesta.usage?.completion_tokens ?? 0,
      tokensCacheados: usoDeepSeek?.prompt_cache_hit_tokens ?? 0,
      modelo,
      proveedor: "DEEPSEEK",
      tiempoMs: Date.now() - inicio,
    };
  }

  async *stream(params: ChatParams): AsyncIterable<string> {
    const modelo = params.modelo || this.modeloDefault;

    const stream = await this.client.chat.completions.create({
      model: modelo,
      max_tokens: params.maxTokens ?? 2048,
      temperature: params.temperatura ?? 0.7,
      messages: convertirMensajesSimples(params.mensajes),
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }

  async chatConHerramientas(params: ChatConHerramientasParams): Promise<ChatConHerramientasResult> {
    const inicio = Date.now();
    const modelo = params.modelo || this.modeloDefault;

    const respuesta = await this.client.chat.completions.create({
      model: modelo,
      max_tokens: params.maxTokens ?? 2048,
      temperature: params.temperatura ?? 0.7,
      messages: convertirMensajesConTool(params.mensajes),
      tools: convertirHerramientas(params.herramientas),
      tool_choice: params.forzarTexto ? "none" : "auto",
    });

    const tiempoMs = Date.now() - inicio;
    const choice = respuesta.choices[0];
    const mensaje = choice.message;

    if (choice.finish_reason === "tool_calls" && mensaje.tool_calls?.length) {
      const contenidoAsistente: Array<ContenidoTextoBloque | ContenidoToolUse> = [];

      if (mensaje.content) {
        contenidoAsistente.push({ type: "text", text: mensaje.content });
      }

      for (const tc of mensaje.tool_calls) {
        if (tc.type !== "function") continue;
        contenidoAsistente.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>,
        });
      }

      return {
        tipo: "herramienta",
        herramientasLlamadas: contenidoAsistente.filter(
          (b): b is ContenidoToolUse => b.type === "tool_use",
        ),
        contenidoAsistente,
        tokensInput: respuesta.usage?.prompt_tokens ?? 0,
        tokensOutput: respuesta.usage?.completion_tokens ?? 0,
        modelo,
        proveedor: "DEEPSEEK",
        tiempoMs,
      };
    }

    return {
      tipo: "texto",
      contenido: mensaje.content ?? "",
      tokensInput: respuesta.usage?.prompt_tokens ?? 0,
      tokensOutput: respuesta.usage?.completion_tokens ?? 0,
      modelo,
      proveedor: "DEEPSEEK",
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
    return MODELOS_DEEPSEEK;
  }
}

export function crearDeepSeekProvider(
  apiKey: string,
  modeloDefault?: string,
): DeepSeekProvider {
  return new DeepSeekProvider(apiKey, modeloDefault);
}
