'use server';

import Anthropic from "@anthropic-ai/sdk";
import type { IProveedorIA, ChatParams, ChatResult, MensajeIA } from "./types";
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
