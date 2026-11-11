"use client";

import { Lock, RotateCcw, Check, ArrowRightLeft, UserCog } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { MensajeConMeta } from "../types";

const CONFIG = {
  CERRADA: {
    Icon: Lock,
    label: "Conversación cerrada",
    color: "text-muted-foreground",
    prefijo: "Cerrada por",
  },
  REABIERTA: {
    Icon: RotateCcw,
    label: "Conversación reabierta",
    color: "text-muted-foreground",
    prefijo: "Nuevo mensaje del cliente",
  },
  RESPONDIDA: {
    Icon: Check,
    label: "Marcada como respondida",
    color: "text-muted-foreground",
    prefijo: "Respondida por",
  },
  ETAPA_AUTOMATICA: {
    Icon: ArrowRightLeft,
    label: "Oportunidad movida automáticamente",
    color: "text-lime-400",
    prefijo: "Movida a",
  },
  // D6 — cambio de quién atiende la conversación.
  ATENCION_CAMBIADA: {
    Icon: UserCog,
    label: "Cambió la atención",
    color: "text-muted-foreground",
    prefijo: "Por",
  },
} as const;

const ETIQUETA_MODO: Record<string, string> = {
  HUMANO: "Atención humana",
  WORKFLOW: "Atiende un Workflow",
  AUTOMATICO: "Atención automática",
};

interface EventoSistemaProps {
  mensaje: MensajeConMeta;
}

export function EventoSistema({ mensaje }: EventoSistemaProps) {
  let evento: { tipo?: string; usuarioNombre?: string | null; etapaNombre?: string | null; a?: string; motivo?: string | null } = {};
  try {
    evento = JSON.parse(mensaje.contenido ?? "{}");
  } catch {
    // ignorar
  }

  const tipo = (evento.tipo ?? "CERRADA") as keyof typeof CONFIG;
  const cfg = CONFIG[tipo] ?? CONFIG.CERRADA;
  const { Icon } = cfg;

  const fechaHora = format(new Date(mensaje.creadoEn), "d MMM yyyy, HH:mm", { locale: es });

  let subtitulo: string;
  let etiqueta: string = cfg.label;
  if (tipo === "ATENCION_CAMBIADA") {
    etiqueta = ETIQUETA_MODO[evento.a ?? ""] ?? cfg.label;
    subtitulo = [evento.motivo, evento.usuarioNombre && `${cfg.prefijo} ${evento.usuarioNombre}`, fechaHora].filter(Boolean).join(" · ");
  } else if (tipo === "ETAPA_AUTOMATICA" && evento.etapaNombre) {
    subtitulo = `${cfg.prefijo} "${evento.etapaNombre}" · ${fechaHora}`;
  } else if (tipo === "REABIERTA") {
    subtitulo = `${cfg.prefijo} · ${fechaHora}`;
  } else if (evento.usuarioNombre) {
    subtitulo = `${cfg.prefijo} ${evento.usuarioNombre} · ${fechaHora}`;
  } else {
    subtitulo = fechaHora;
  }

  return (
    <div className="flex items-center gap-3 my-5 px-1">
      <div className="flex-1 h-px bg-card-divider" />
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
          <span className={`text-[12px] font-medium ${cfg.color}`}>{etiqueta}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{subtitulo}</span>
      </div>
      <div className="flex-1 h-px bg-card-divider" />
    </div>
  );
}
