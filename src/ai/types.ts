// Tipos públicos del bounded context AI
// Los módulos clientes solo importan desde este archivo o desde src/ai/actions.ts

export type { SolicitudIA, RespuestaIA } from "@/ai/gateway/types";
export type { MensajeIA, ChatResult, IProveedorIA } from "@/ai/proveedores/types";
export type { ContextoIA, ContextoConversacion, ContextoContacto, ContextoOportunidad } from "@/ai/contexto/tipos";
