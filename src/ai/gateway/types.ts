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
}

export interface RespuestaIA {
  contenido: string;
  proveedor: ProveedorIAEnum;
  modelo: string;
  tokensInput: number;
  tokensOutput: number;
  tiempoMs: number;
  usoIAId: string;
}
