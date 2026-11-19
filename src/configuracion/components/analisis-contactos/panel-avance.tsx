import type { ReactNode } from "react";
import { FechaHora } from "@/shared/fechas/fecha-hora";
import type { AvanceAnalisis } from "@/crm/contactos/analisis/queries";
import { BotonReintentarFallidos } from "./boton-reintentar-fallidos";

/**
 * 042 (Historia 6, FR-052) — Avance del análisis de la cuenta. La
 * clasificación inicial va separada de la actualización de contactos
 * activos, y su porcentaje se calcula solo sobre los contactos que necesitan
 * IA: los demás se resuelven por reglas y no deben hacer parecer que falta.
 */

const MOTIVO: Record<string, string> = {
  IA_DESHABILITADA: "el análisis con IA está apagado o la IA de la cuenta no está habilitada",
  SIN_PROVEEDOR: "no hay un proveedor de IA activo",
  PRESUPUESTO_CUENTA: "se alcanzó el presupuesto diario propio",
  LIMITE_CUENTA: "se alcanzó el límite diario de IA de la cuenta",
  LIMITE_CUENTA_HISTORICO: "la cuenta pasó el 80 % de su límite diario: la clasificación inicial se pausa para dejar margen a la atención de clientes",
  LIMITE_PROVEEDOR: "el proveedor llegó a su límite por minuto o por día",
  PRESUPUESTO_GLOBAL: "se alcanzó el presupuesto diario de la plataforma",
};

function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{titulo}</h4>
      {children}
    </div>
  );
}

function Fila({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className="text-foreground tabular-nums">{children}</span>
    </div>
  );
}

const n = (v: number) => v.toLocaleString("es");

export function PanelAvance({ avance }: { avance: AvanceAnalisis }) {
  const { clasificacionInicial: ci, actualizacion: act, hoy, limites } = avance;
  return (
    <div data-slot="panel-avance-analisis" className="grid gap-3 md:grid-cols-3">
      <Tarjeta titulo="Clasificación inicial">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-foreground tabular-nums">{ci.porcentaje === null ? "—" : `${ci.porcentaje}%`}</span>
          {ci.pausado && <span className="text-xs text-stage-amber-text">Pausada</span>}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full bg-primary" style={{ width: `${ci.porcentaje ?? 0}%` }} />
        </div>
        <Fila etiqueta="Analizados con IA">
          {n(ci.analizadosIA)} de {n(ci.elegiblesIA)}
        </Fila>
        <Fila etiqueta="Resueltos por reglas">{n(ci.resueltosPorReglas)}</Fila>
      </Tarjeta>

      <Tarjeta titulo="Contactos activos">
        <Fila etiqueta="Urgentes pendientes">{n(act.pendientes.P0)}</Fila>
        <Fila etiqueta="Con cambios recientes">{n(act.pendientes.P1)}</Fila>
        <Fila etiqueta="En clasificación inicial">{n(act.pendientes.P2)}</Fila>
        <Fila etiqueta="Espera media">{act.esperaMediaSeg === null ? "—" : `${n(act.esperaMediaSeg)} s`}</Fila>
        <Fila etiqueta="Última atención">
          <FechaHora valor={act.ultimaAtencionEn} modo="relativa" vacio="Nunca" />
        </Fila>
      </Tarjeta>

      <Tarjeta titulo="Hoy">
        <Fila etiqueta="Lotes procesados">{n(hoy.atenciones)}</Fila>
        <Fila etiqueta="Lotes con error">{n(hoy.lotesFallidos)}</Fila>
        <Fila etiqueta="Duración media">{hoy.duracionMediaMs === null ? "—" : `${(hoy.duracionMediaMs / 1000).toFixed(1)} s`}</Fila>
        <Fila etiqueta="Tokens">{n(hoy.tokens)}</Fila>
        <Fila etiqueta="Costo estimado">{hoy.costoEstimado === null ? "—" : `US$ ${hoy.costoEstimado.toFixed(4)}`}</Fila>
        {limites.consumoLimiteCuentaPct !== null && <Fila etiqueta="Del límite diario de IA">{limites.consumoLimiteCuentaPct}%</Fila>}
      </Tarjeta>

      {!limites.iaDisponible && limites.motivoNoDisponible && (
        <p className="text-xs text-muted-foreground md:col-span-3">
          Ahora los contactos se analizan solo con reglas: {MOTIVO[limites.motivoNoDisponible] ?? limites.motivoNoDisponible}.
        </p>
      )}

      {avance.fallidos > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-danger-border bg-danger-muted p-3 md:col-span-3">
          <span className="text-sm text-danger-text">{n(avance.fallidos)} contactos no se pudieron analizar después de varios intentos.</span>
          <BotonReintentarFallidos />
        </div>
      )}
    </div>
  );
}
