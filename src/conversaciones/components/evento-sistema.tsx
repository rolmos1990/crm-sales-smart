"use client";

import { Lock, RotateCcw, Check } from "lucide-react";
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
} as const;

interface EventoSistemaProps {
  mensaje: MensajeConMeta;
}

export function EventoSistema({ mensaje }: EventoSistemaProps) {
  let evento: { tipo?: string; usuarioNombre?: string | null } = {};
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
  if (tipo === "REABIERTA") {
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
          <span className={`text-[12px] font-medium ${cfg.color}`}>{cfg.label}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{subtitulo}</span>
      </div>
      <div className="flex-1 h-px bg-card-divider" />
    </div>
  );
}
