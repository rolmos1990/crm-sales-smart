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
  contactos?: Array<{ contacto: { id: string; nombre: string; apellido: string } }>;
}

export const ETAPAS_PIPELINE: { valor: Etapa; etiqueta: string; color: string }[] = [
  { valor: "PROSPECTO", etiqueta: "Prospecto", color: "bg-slate-100 text-slate-700" },
  { valor: "CALIFICADO", etiqueta: "Calificado", color: "bg-blue-100 text-blue-700" },
  { valor: "PROPUESTA", etiqueta: "Propuesta", color: "bg-violet-100 text-violet-700" },
  { valor: "NEGOCIACION", etiqueta: "Negociación", color: "bg-amber-100 text-amber-700" },
  { valor: "GANADO", etiqueta: "Ganado", color: "bg-green-100 text-green-700" },
  { valor: "PERDIDO", etiqueta: "Perdido", color: "bg-red-100 text-red-700" },
];

export type ResultadoAccion<T = void> =
  | { exito: true; datos: T }
  | { exito: false; error: string };
