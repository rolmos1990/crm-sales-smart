import type { ProveedorIAEnum, TareaIA } from "@/generated/prisma/enums";

export interface MensajeIA {
  rol: "system" | "user" | "assistant";
  contenido: string;
}

export interface ChatParams {
  mensajes: MensajeIA[];
  modelo: string;
  temperatura?: number;
  maxTokens?: number;
  tarea: TareaIA;
}

export interface ChatResult {
  contenido: string;
  tokensInput: number;
  tokensOutput: number;
  modelo: string;
  proveedor: ProveedorIAEnum;
  tiempoMs: number;
}

export interface IProveedorIA {
  readonly nombre: ProveedorIAEnum;
  chat(params: ChatParams): Promise<ChatResult>;
  stream(params: ChatParams): AsyncIterable<string>;
  estaDisponible(): Promise<boolean>;
  obtenerModelos(): string[];
}
