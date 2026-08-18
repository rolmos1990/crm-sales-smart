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

export const ETAPAS_PIPELINE: { valor: Etapa; etiqueta: string; color: string }[] = [
  { valor: "PROSPECTO",  etiqueta: "Prospecto",  color: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400 border border-sky-200 dark:border-sky-500/25" },
  { valor: "CALIFICADO", etiqueta: "Calificado", color: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400 border border-violet-200 dark:border-violet-500/25" },
  { valor: "PROPUESTA",  etiqueta: "Propuesta",  color: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border border-amber-200 dark:border-amber-500/25" },
  { valor: "NEGOCIACION",etiqueta: "Negociación",color: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400 border border-orange-200 dark:border-orange-500/25" },
  { valor: "GANADO",     etiqueta: "Ganado",     color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25" },
  { valor: "PERDIDO",    etiqueta: "Perdido",    color: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border border-red-200 dark:border-red-500/25" },
];

export type ResultadoAccion<T = void> =
  | { exito: true; datos: T }
  | { exito: false; error: string };
