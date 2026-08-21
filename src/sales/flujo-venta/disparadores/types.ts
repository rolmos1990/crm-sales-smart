export type {
  TipoAccionDisparador,
  EstadoDisparadorJob,
  ConfigCrearTarea,
  ConfigCrearNota,
  ConfigWebhook,
  ConfigModificarCampo,
  ConfigCerrarOportunidad,
  ConfigDisparador,
} from "@/crm/pipeline/disparadores/types";

export { ETIQUETAS_TIPO } from "@/crm/pipeline/disparadores/types";

// Tipos de acción soportados en el flujo de venta (sin ASIGNAR_ETIQUETA, sin ASIGNAR_USUARIO)
// CERRAR_OPORTUNIDAD es exclusivo de este lado: no tiene sentido en un
// disparador de etapa de oportunidad (no habría "otra" oportunidad que cerrar).
export const TIPOS_ACCION_FLUJO_VENTA = [
  "CREAR_TAREA",
  "CREAR_NOTA",
  "WEBHOOK",
  "MODIFICAR_CAMPO",
  "CAMBIAR_ETAPA",
  "CERRAR_OPORTUNIDAD",
] as const;

export type TipoAccionFlujoVenta = (typeof TIPOS_ACCION_FLUJO_VENTA)[number];

export interface DisparadorFlujo {
  id: string;
  nombre: string;
  activo: boolean;
  orden: number;
  delayMinutos: number | null;
  tipo: import("@/crm/pipeline/disparadores/types").TipoAccionDisparador;
  config: import("@/crm/pipeline/disparadores/types").ConfigDisparador;
  flujoVentaEtapaId: string;
  flujoVentaId: string;
  creadoEn: Date;
  jobs?: { id: string; estado: string; ejecutarEn: Date; creadoEn: Date }[];
}

// Tipo para cambio de etapa en el contexto del flujo de venta
export interface ConfigCambiarEtapaFlujo {
  flujoVentaEtapaId: string;
  etapaNombre?: string;
}
