import type { Etapa } from "@/generated/prisma/enums";

export type { Etapa };

export interface Oportunidad {
  id: string;
  titulo: string;
  valor: number;
  moneda: string;
  etapa: Etapa;
  probabilidad: number;
  fechaCierre: Date | null;
  notas: string | null;
  motivoPerdida: string | null;
  creadoEn: Date;
  actualizadoEn: Date;
  empresaId: string | null;
  empresa: { id: string; nombre: string } | null;
  usuarioId: string | null;
  stageId?: string | null;
  pipelineId?: string | null;
  /** Etapa real cuando la oportunidad vive en un pipeline dinámico — tiene
   *  precedencia sobre el enum legacy `etapa`, que no se mantiene sincronizado. */
  stage?: { id: string; nombre: string; color: string | null } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: any;
  contactos?: Array<{ contacto: { id: string; nombre: string; apellido: string } }>;
  tags?: Array<{ tagId: string; tag: { id: string; nombre: string; color: string | null } }>;
}

export const PROBABILIDADES_ETAPA: Record<Etapa, number> = {
  PROSPECTO:   20,
  CALIFICADO:  40,
  PROPUESTA:   60,
  NEGOCIACION: 80,
  GANADO:      100,
  PERDIDO:     0,
};

// Colores desde los tokens de etapa del Design System (ver
// claude-scheme-color-{light,dark}.md) — mismo lenguaje visual que las
// etapas dinámicas del Pipeline, no HEX/paleta Tailwind sueltos.
export const ETAPAS_PIPELINE: { valor: Etapa; etiqueta: string; color: string }[] = [
  { valor: "PROSPECTO",  etiqueta: "Prospecto",  color: "bg-stage-cyan-muted text-stage-cyan-text border border-stage-cyan-border" },
  { valor: "CALIFICADO", etiqueta: "Calificado", color: "bg-stage-purple-muted text-stage-purple-text border border-stage-purple-border" },
  { valor: "PROPUESTA",  etiqueta: "Propuesta",  color: "bg-stage-amber-muted text-stage-amber-text border border-stage-amber-border" },
  { valor: "NEGOCIACION",etiqueta: "Negociación",color: "bg-stage-orange-muted text-stage-orange-text border border-stage-orange-border" },
  { valor: "GANADO",     etiqueta: "Ganado",     color: "bg-success-muted text-success-text border border-success-border" },
  { valor: "PERDIDO",    etiqueta: "Perdido",    color: "bg-danger-muted text-danger-text border border-danger-border" },
];

export type ResultadoAccion<T = void> =
  | { exito: true; datos: T }
  | { exito: false; error: string };
