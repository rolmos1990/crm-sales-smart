import type { ProveedorIAEnum, TareaIA } from "@/generated/prisma/enums";

// 010-enrutamiento-modelos-ia-por-objetivo — shape de ProveedorIA.casosDeUso
// (Json en Prisma). "CHAT_RAZONAMIENTO_SUPERIOR" es un pseudo-objetivo, no
// forma parte del enum TareaIA — representa "conversación que requiere
// mayor razonamiento", distinto de CHAT estándar (research.md Decisión 1).
export type ObjetivoEnrutamientoIA = TareaIA | "CHAT_RAZONAMIENTO_SUPERIOR";

export interface CasosDeUsoProveedor {
  objetivos: ObjetivoEnrutamientoIA[];
}

export interface MensajeIA {
  rol: "system" | "user" | "assistant";
  contenido: string;
}

// Bloques de contenido para tool calling
export interface ContenidoTextoBloque {
  type: "text";
  text: string;
}

export interface ContenidoToolUse {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ContenidoToolResult {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}

// Mensaje extendido que soporta tool calling (union discriminada por rol)
export type MensajeIATool =
  | { rol: "system"; contenido: string }
  | { rol: "user"; contenido: string | ContenidoToolResult[] }
  | { rol: "assistant"; contenido: string | Array<ContenidoTextoBloque | ContenidoToolUse> };

export interface DefinicionHerramienta {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ChatConHerramientasParams {
  mensajes: MensajeIATool[];
  herramientas: DefinicionHerramienta[];
  modelo: string;
  temperatura?: number;
  maxTokens?: number;
}

export interface ChatConHerramientasResult {
  tipo: "texto" | "herramienta";
  contenido?: string;
  herramientasLlamadas?: ContenidoToolUse[];
  contenidoAsistente?: Array<ContenidoTextoBloque | ContenidoToolUse>;
  tokensInput: number;
  tokensOutput: number;
  modelo: string;
  proveedor: ProveedorIAEnum;
  tiempoMs: number;
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
  chatConHerramientas?(params: ChatConHerramientasParams): Promise<ChatConHerramientasResult>;
}
