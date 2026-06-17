import type { TipoActividad, PrioridadActividad } from "@/generated/prisma/enums";

export type { TipoActividad, PrioridadActividad };

export interface Actividad {
  id: string;
  tipo: TipoActividad;
  prioridad: PrioridadActividad;
  titulo: string;
  descripcion: string | null;
  fecha: Date;
  completada: boolean;
  completadaEn: Date | null;
  creadoEn: Date;
  contactoId: string | null;
  contacto: { id: string; nombre: string; apellido: string } | null;
  empresaId: string | null;
  empresa: { id: string; nombre: string } | null;
  oportunidadId: string | null;
  oportunidad: { id: string; titulo: string } | null;
  pedidoId: string | null;
  pedido: { id: string; numero: string } | null;
  cotizacionId: string | null;
  cotizacion: { id: string; numero: string } | null;
  usuarioId: string | null;
  usuario: { id: string; nombre: string } | null;
}

export const TIPOS_ACTIVIDAD: { valor: TipoActividad; etiqueta: string; icono: string }[] = [
  { valor: "LLAMADA", etiqueta: "Llamada", icono: "📞" },
  { valor: "EMAIL", etiqueta: "Email", icono: "✉️" },
  { valor: "REUNION", etiqueta: "Reunión", icono: "🤝" },
  { valor: "TAREA", etiqueta: "Tarea", icono: "✅" },
  { valor: "NOTA", etiqueta: "Nota", icono: "📝" },
  { valor: "WHATSAPP", etiqueta: "WhatsApp", icono: "💬" },
];

export type ResultadoAccion<T = void> =
  | { exito: true; datos: T }
  | { exito: false; error: string };
