import {
  Ban,
  CalendarClock,
  CheckCircle2,
  Gift,
  MessageCircleReply,
  RotateCcw,
  Search,
  ShoppingBag,
  TrendingUp,
  User,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NivelInteresValor, Recomendacion, TipoComercial } from "../types";

// 041 — Insignias pequeñas y suaves. El color es significado (tipo, interés,
// recomendación), nunca superficie: fondo `*-muted` + texto `*-text`.

const BASE =
  "inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap [&>svg]:size-3";

export const ETIQUETA_TIPO: Record<TipoComercial, string> = {
  CLIENTE: "Cliente",
  INTERESADO: "Interesado",
  LEAD: "Lead",
};

const ESTILO_TIPO: Record<TipoComercial, { clase: string; Icono: LucideIcon }> = {
  CLIENTE: { clase: "bg-primary-muted text-primary", Icono: ShoppingBag },
  INTERESADO: { clase: "bg-stage-amber-muted text-stage-amber-text", Icono: TrendingUp },
  LEAD: { clase: "bg-muted text-muted-foreground", Icono: User },
};

export function InsigniaTipo({ tipo, className }: { tipo: TipoComercial; className?: string }) {
  const { clase, Icono } = ESTILO_TIPO[tipo];
  return (
    <span data-slot="insignia-tipo" className={cn(BASE, clase, className)}>
      <Icono aria-hidden />
      {ETIQUETA_TIPO[tipo]}
    </span>
  );
}

export const ETIQUETA_INTERES: Record<NivelInteresValor, string> = {
  ALTO: "Alto",
  MEDIO: "Medio",
  BAJO: "Bajo",
  SIN_EVALUAR: "Sin evaluar",
};

const PUNTO_INTERES: Record<NivelInteresValor, string> = {
  ALTO: "bg-success",
  MEDIO: "bg-stage-amber",
  BAJO: "bg-danger",
  SIN_EVALUAR: "bg-muted-foreground/50",
};

export function InsigniaInteres({
  interes,
  fijado = false,
  className,
}: {
  interes: NivelInteresValor;
  fijado?: boolean;
  className?: string;
}) {
  return (
    <span
      data-slot="insignia-interes"
      className={cn(BASE, "border border-border-subtle bg-card text-foreground", className)}
      title={fijado ? "Fijado manualmente" : undefined}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", PUNTO_INTERES[interes])} />
      {ETIQUETA_INTERES[interes]}
    </span>
  );
}

export function InsigniaNoContactar({ className }: { className?: string }) {
  return (
    <span data-slot="insignia-no-contactar" className={cn(BASE, "bg-danger-muted text-danger-text", className)}>
      <Ban aria-hidden />
      No contactar
    </span>
  );
}

export const ETIQUETA_RECOMENDACION: Record<Recomendacion, string> = {
  NO_CONTACTAR: "No contactar",
  RESPONDER: "Responder",
  RETOMAR_CONVERSACION: "Retomar conversación",
  CONTACTAR_HOY: "Contactar hoy",
  DAR_SEGUIMIENTO: "Dar seguimiento",
  OFRECER_NOVEDADES: "Ofrecer novedades",
  EVALUAR: "Evaluar",
  SIN_URGENCIA: "Sin urgencia",
};

const ESTILO_RECOMENDACION: Record<Recomendacion, { clase: string; Icono: LucideIcon }> = {
  NO_CONTACTAR: { clase: "text-danger-text", Icono: Ban },
  RESPONDER: { clase: "text-primary", Icono: MessageCircleReply },
  RETOMAR_CONVERSACION: { clase: "text-stage-orange-text", Icono: RotateCcw },
  CONTACTAR_HOY: { clase: "text-primary", Icono: Zap },
  DAR_SEGUIMIENTO: { clase: "text-stage-amber-text", Icono: CalendarClock },
  OFRECER_NOVEDADES: { clase: "text-stage-purple-text", Icono: Gift },
  EVALUAR: { clase: "text-stage-cyan-text", Icono: Search },
  SIN_URGENCIA: { clase: "text-muted-foreground", Icono: CheckCircle2 },
};

export function InsigniaRecomendacion({ recomendacion, className }: { recomendacion: Recomendacion; className?: string }) {
  const { clase, Icono } = ESTILO_RECOMENDACION[recomendacion];
  return (
    <span
      data-slot="insignia-recomendacion"
      className={cn("inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap", className)}
    >
      <Icono aria-hidden className={cn("size-3.5 shrink-0", clase)} />
      <span className="text-foreground">{ETIQUETA_RECOMENDACION[recomendacion]}</span>
    </span>
  );
}
