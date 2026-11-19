import type { ProveedorIAEnum, TareaIA } from "@/generated/prisma/enums";
import type { MensajeIA } from "@/ai/proveedores/types";

export interface SolicitudIA {
  instanciaId: string;
  agenteIAConfigId?: string;
  tarea: TareaIA;
  mensajes: MensajeIA[];
  temperatura?: number;
  maxTokens?: number;
  entidadTipo?: string;
  entidadId?: string;
  // 010-enrutamiento-modelos-ia-por-objetivo — solo tiene efecto cuando
  // tarea === "CHAT"; ausente/false preserva el criterio de selección actual.
  requiereRazonamientoSuperior?: boolean;
  /** 042 — pide salida JSON al proveedor; sin el campo, el pedido no cambia. */
  formatoRespuesta?: "json";
}

export interface RespuestaIA {
  contenido: string;
  proveedor: ProveedorIAEnum;
  modelo: string;
  tokensInput: number;
  tokensOutput: number;
  tiempoMs: number;
  usoIAId: string;
  // 042 — para el registro de cada atención del análisis de contactos.
  proveedorIAId: string;
  costoEstimado: number | null;
  tokensCacheados: number;
}
