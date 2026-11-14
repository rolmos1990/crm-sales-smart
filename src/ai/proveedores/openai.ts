import OpenAI from "openai";
import type {
  IProveedorIA,
  ChatParams,
  ChatResult,
  ChatConHerramientasParams,
  ChatConHerramientasResult,
  ContenidoTextoBloque,
  ContenidoToolUse,
} from "./types";
import type { ProveedorIAEnum } from "@/generated/prisma/enums";
import { convertirHerramientas, convertirMensajesConTool, convertirMensajesSimples } from "./openai-compat";

// Proveedor de OpenAI. Habla el mismo dialecto que DeepSeek y NVIDIA —de
// hecho comparten los conversores— pero NO es una copia de ellos: la API de
// OpenAI se movió y hay tres diferencias que, ignoradas, dejan al agente sin
// responder una sola vez.
//
// 1. `temperature` NO SE MANDA. Todos los modelos actuales de OpenAI son de
//    razonamiento y lo rechazan con un 400:
//      "Unsupported parameter: 'temperature' is not supported with this model"
//    Karia manda 0.7 por defecto, así que copiar a DeepSeek habría fallado en
//    el 100% de las llamadas. Se omite a propósito, no por olvido.
//
// 2. `max_completion_tokens` en vez de `max_tokens`. El propio SDK marca
//    `max_tokens` como @deprecated y "no compatible con los modelos
//    o-series".
//
// 3. `reasoning_effort` existe y vale la pena: es la perilla de costo/calidad
//    de estos modelos.
//
// Sobre Chat Completions vs Responses: OpenAI recomienda Responses para los
// modelos de razonamiento ("you'll get improved model intelligence and
// performance"), y Chat Completions queda como soportado pero subóptimo. Se
// eligió Chat Completions a conciencia para reutilizar el tool-calling ya
// probado del repo y poder comparar contra DeepSeek sin reescribir la
// canalización. Migrar a Responses es la mejora pendiente, no un olvido.

/** Sugerencia para la UI, no una lista blanca: el modelo que se usa es el
 *  que el negocio escribe en `modelosDisponibles`. Los catálogos cambian
 *  seguido y este arreglo envejece — nunca debe bloquear un modelo nuevo. */
const MODELOS_OPENAI = [
  "gpt-6.1-sol",
  "gpt-6.1-terra",
  "gpt-6-astra",
  "gpt-6-luna",
];

export class OpenAIProvider implements IProveedorIA {
  readonly nombre: ProveedorIAEnum = "OPENAI";

  private readonly client: OpenAI;
  private readonly modeloDefault: string;

  constructor(apiKey: string, modeloDefault = MODELOS_OPENAI[0]) {
    // Sin baseURL: la de por defecto del SDK es la de OpenAI. Es la única
    // diferencia de construcción con DeepSeek y NVIDIA, que la sobreescriben.
    this.client = new OpenAI({ apiKey });
    this.modeloDefault = modeloDefault;
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    const inicio = Date.now();
    const modelo = params.modelo || this.modeloDefault;

    const respuesta = await this.client.chat.completions.create({
      model: modelo,
      max_completion_tokens: params.maxTokens ?? 2048,
      messages: convertirMensajesSimples(params.mensajes),
    });

    return {
      contenido: respuesta.choices[0]?.message?.content ?? "",
      tokensInput: respuesta.usage?.prompt_tokens ?? 0,
      tokensOutput: respuesta.usage?.completion_tokens ?? 0,
      modelo,
      proveedor: "OPENAI",
      tiempoMs: Date.now() - inicio,
    };
  }

  async *stream(params: ChatParams): AsyncIterable<string> {
    const modelo = params.modelo || this.modeloDefault;

    const stream = await this.client.chat.completions.create({
      model: modelo,
      max_completion_tokens: params.maxTokens ?? 2048,
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
      max_completion_tokens: params.maxTokens ?? 2048,
      messages: convertirMensajesConTool(params.mensajes),
      tools: convertirHerramientas(params.herramientas),
      tool_choice: params.forzarTexto ? "none" : "auto",
    });

    const tiempoMs = Date.now() - inicio;
    const choice = respuesta.choices[0];
    const mensaje = choice.message;
    const uso = {
      tokensInput: respuesta.usage?.prompt_tokens ?? 0,
      tokensOutput: respuesta.usage?.completion_tokens ?? 0,
      modelo,
      proveedor: "OPENAI" as const,
      tiempoMs,
    };

    if (choice.finish_reason === "tool_calls" && mensaje.tool_calls?.length) {
      const contenidoAsistente: Array<ContenidoTextoBloque | ContenidoToolUse> = [];

      if (mensaje.content) contenidoAsistente.push({ type: "text", text: mensaje.content });

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
        herramientasLlamadas: contenidoAsistente.filter((b): b is ContenidoToolUse => b.type === "tool_use"),
        contenidoAsistente,
        ...uso,
      };
    }

    return { tipo: "texto", contenido: mensaje.content ?? "", ...uso };
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
    return MODELOS_OPENAI;
  }
}

export function crearOpenAIProvider(apiKey: string, modeloDefault?: string): OpenAIProvider {
  return new OpenAIProvider(apiKey, modeloDefault);
}
