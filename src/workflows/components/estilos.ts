import type { EstadoWorkflow, TipoDisparadorWorkflow } from "@/generated/prisma/enums";
import type { CategoriaNodo } from "../definicion/catalogo-nodos";

// Los colores intensos comunican significado (categoría, estado), nunca
// rellenan superficies grandes — ver .agents/skills/design-systems.

export const ESTILO_CATEGORIA: Record<CategoriaNodo, { etiqueta: string; icono: string; acento: string; chip: string }> = {
  CONTROL: {
    etiqueta: "Control",
    icono: "text-stage-lavender-text",
    acento: "bg-stage-lavender",
    chip: "bg-stage-lavender-muted text-stage-lavender-text border-stage-lavender-border",
  },
  CONVERSACION: {
    etiqueta: "Conversación",
    icono: "text-stage-cyan-text",
    acento: "bg-stage-cyan",
    chip: "bg-stage-cyan-muted text-stage-cyan-text border-stage-cyan-border",
  },
  CRM: {
    etiqueta: "CRM",
    icono: "text-stage-amber-text",
    acento: "bg-stage-amber",
    chip: "bg-stage-amber-muted text-stage-amber-text border-stage-amber-border",
  },
  IA: {
    etiqueta: "Inteligencia artificial",
    icono: "text-stage-purple-text",
    acento: "bg-stage-purple",
    chip: "bg-stage-purple-muted text-stage-purple-text border-stage-purple-border",
  },
};

export const ESTILO_ESTADO: Record<EstadoWorkflow, { etiqueta: string; clase: string }> = {
  BORRADOR: { etiqueta: "Borrador", clase: "bg-badge-bg text-badge-text border-badge-border" },
  PUBLICADO: { etiqueta: "Publicado", clase: "bg-success-muted text-success-text border-success-border" },
  INACTIVO: { etiqueta: "Inactivo", clase: "bg-danger-muted text-danger-text border-danger-border" },
};

export const ETIQUETA_DISPARADOR: Record<TipoDisparadorWorkflow, string> = {
  ENTRADA_ETAPA: "Entrada a una etapa del pipeline",
  MENSAJE_RECIBIDO: "Mensaje recibido",
  CONVERSACION_CREADA: "Conversación creada",
  OPORTUNIDAD_CREADA: "Oportunidad creada",
  PEDIDO_CREADO: "Pedido creado",
  MANUAL: "Inicio manual (Inbox) u otro Workflow",
};
