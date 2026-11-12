import type { EstadoWorkflow, TipoDisparadorWorkflow } from "@/generated/prisma/enums";
import type { CategoriaNodo } from "../definicion/catalogo-nodos";

// Los colores intensos comunican significado (categoría, estado), nunca
// rellenan superficies grandes — ver .agents/skills/design-systems.

export interface EstiloCategoria {
  etiqueta: string;
  /** Qué agrupa la categoría, para la cabecera de la biblioteca. */
  descripcion: string;
  /** Nombre de ícono de lucide-react para la cabecera de la categoría. */
  iconoCategoria: string;
  /** Barra de acento superior de la tarjeta en el lienzo. */
  acento: string;
  /** Cuadro del ícono (fondo + texto + borde). */
  chip: string;
  /** Píldora con el tipo de nodo en mayúsculas. */
  badge: string;
  /** Halo del nodo seleccionado, en el color de su categoría. */
  anillo: string;
  /** Color crudo de la categoría, para APIs que no aceptan clases (MiniMap). */
  colorVar: string;
}

export const ESTILO_CATEGORIA: Record<CategoriaNodo, EstiloCategoria> = {
  CONVERSACION: {
    etiqueta: "Conversación",
    descripcion: "Interacción con el cliente",
    iconoCategoria: "MessageCircle",
    acento: "bg-stage-cyan",
    chip: "bg-stage-cyan-muted text-stage-cyan-text border-stage-cyan-border",
    badge: "bg-stage-cyan-muted text-stage-cyan-text",
    anillo: "border-stage-cyan ring-stage-cyan/30",
    colorVar: "var(--stage-cyan)",
  },
  CONTROL: {
    etiqueta: "Control",
    descripcion: "Lógica y control del flujo",
    iconoCategoria: "Settings2",
    acento: "bg-stage-lavender",
    chip: "bg-stage-lavender-muted text-stage-lavender-text border-stage-lavender-border",
    badge: "bg-stage-lavender-muted text-stage-lavender-text",
    anillo: "border-stage-lavender ring-stage-lavender/30",
    colorVar: "var(--stage-lavender)",
  },
  CRM: {
    etiqueta: "CRM",
    descripcion: "Gestión de datos en Karia",
    iconoCategoria: "Database",
    acento: "bg-stage-amber",
    chip: "bg-stage-amber-muted text-stage-amber-text border-stage-amber-border",
    badge: "bg-stage-amber-muted text-stage-amber-text",
    anillo: "border-stage-amber ring-stage-amber/30",
    colorVar: "var(--stage-amber)",
  },
  IA: {
    etiqueta: "Inteligencia artificial",
    descripcion: "Automatización con IA",
    iconoCategoria: "Sparkles",
    acento: "bg-stage-purple",
    chip: "bg-stage-purple-muted text-stage-purple-text border-stage-purple-border",
    badge: "bg-stage-purple-muted text-stage-purple-text",
    anillo: "border-stage-purple ring-stage-purple/30",
    colorVar: "var(--stage-purple)",
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
