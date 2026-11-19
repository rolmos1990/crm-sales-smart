import { Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AccionComercial,
  IntencionCompra,
  NivelRecuperacion,
  NivelUrgencia,
  RelacionComercial,
} from "@/generated/prisma/enums";

// 042 — Insignias del análisis. Mismo criterio visual que las de la 041:
// el color comunica significado (qué tan caliente está el contacto), nunca
// superficie grande.

const BASE =
  "inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap tabular-nums [&>svg]:size-3";

function estiloPuntaje(puntaje: number): string {
  if (puntaje >= 70) return "bg-success-muted text-success-text";
  if (puntaje >= 40) return "bg-stage-amber-muted text-stage-amber-text";
  return "bg-muted text-muted-foreground";
}

export function InsigniaPuntaje({ puntaje, className }: { puntaje: number | null; className?: string }) {
  if (puntaje === null) {
    return (
      <span data-slot="insignia-puntaje" className={cn("text-xs text-muted-foreground", className)} title="Sin analizar">
        —
      </span>
    );
  }
  return (
    <span
      data-slot="insignia-puntaje"
      className={cn(BASE, estiloPuntaje(puntaje), className)}
      title={`Puntaje comercial ${puntaje} de 100`}
    >
      <Gauge aria-hidden />
      {puntaje}
    </span>
  );
}

export const ETIQUETA_RELACION: Record<RelacionComercial, string> = {
  PROSPECTO: "Prospecto",
  CLIENTE: "Cliente",
  CLIENTE_RECURRENTE: "Cliente recurrente",
  CLIENTE_INACTIVO: "Cliente inactivo",
};

export const ETIQUETA_INTENCION: Record<IntencionCompra, string> = {
  ALTA: "Alta",
  MEDIA: "Media",
  BAJA: "Baja",
  DESCONOCIDA: "Desconocida",
};

export const ETIQUETA_URGENCIA: Record<NivelUrgencia, string> = { ALTA: "Alta", MEDIA: "Media", BAJA: "Baja" };

export const ETIQUETA_RECUPERACION: Record<NivelRecuperacion, string> = {
  ALTA: "Alta",
  MEDIA: "Media",
  BAJA: "Baja",
  NO_APLICA: "No aplica",
};

export const ETIQUETA_ACCION: Record<AccionComercial, string> = {
  RESPONDER: "Responder",
  NO_CONTACTAR: "No contactar",
  CONTACTAR_HOY: "Contactar hoy",
  ENVIAR_COTIZACION: "Enviar cotización",
  DAR_SEGUIMIENTO: "Dar seguimiento",
  RESOLVER_OBJECION: "Resolver objeción",
  REACTIVAR: "Reactivar",
  OFRECER_NOVEDADES: "Ofrecer novedades",
  ESPERAR: "Esperar",
  SIN_ACCION: "Sin acción por ahora",
};
