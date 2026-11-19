"use client";

import { useTransition, type ReactNode } from "react";
import { Check, Info, Loader2, Lock, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FechaHora } from "@/shared/fechas/fecha-hora";
import { ETIQUETA_INTERES } from "@/crm/contactos/components/insignias-contacto";
import type { AnalisisContacto } from "../queries";
import { analizarContactoAction, resolverSugerenciaInteresAction, resolverSugerenciaNoContactarAction } from "../actions";
import {
  ETIQUETA_ACCION,
  ETIQUETA_INTENCION,
  ETIQUETA_RECUPERACION,
  ETIQUETA_RELACION,
  ETIQUETA_URGENCIA,
  InsigniaPuntaje,
} from "./insignias-analisis";

/**
 * 042 — Sección "Análisis de IA" del panel lateral (FR-050, FR-051). Muestra
 * la evaluación vigente (por reglas o con IA), las sugerencias pendientes y
 * "Analizar con IA". El panel vuelve a consultar mientras `analizandoAhora`.
 */

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{etiqueta}</span>
      <span className="min-w-0 text-right text-foreground">{children}</span>
    </div>
  );
}

function Lista({ titulo, items }: { titulo: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{titulo}</span>
      <ul className="flex flex-col gap-1">
        {items.map((t, i) => (
          <li key={`${i}-${t}`} className="rounded-lg bg-muted/40 px-3 py-1.5 text-xs text-foreground">
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Aviso({ children, Icono = Info }: { children: ReactNode; Icono?: typeof Info }) {
  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <Icono className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function Sugerencia({
  texto,
  detalle,
  pendiente,
  onDecidir,
}: {
  texto: ReactNode;
  detalle?: string | null;
  pendiente: boolean;
  onDecidir: (d: "ACEPTAR" | "DESCARTAR") => void;
}) {
  return (
    <div data-slot="sugerencia-ia" className="flex flex-col gap-2 rounded-lg border border-primary-border bg-primary-subtle p-3">
      <p className="flex items-center gap-2 text-sm text-foreground">
        <Sparkles className="size-3.5 shrink-0 text-primary" aria-hidden />
        {texto}
      </p>
      {detalle && <p className="text-xs text-muted-foreground">{detalle}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={pendiente} onClick={() => onDecidir("ACEPTAR")}>
          <Check className="size-3.5" aria-hidden />
          Aceptar
        </Button>
        <Button size="sm" variant="ghost" disabled={pendiente} onClick={() => onDecidir("DESCARTAR")}>
          <X className="size-3.5" aria-hidden />
          Descartar
        </Button>
      </div>
    </div>
  );
}

export function SeccionAnalisisIA({
  contactoId,
  analisis,
  puedeModificar,
  onCambio,
}: {
  contactoId: string;
  analisis: AnalisisContacto;
  puedeModificar: boolean;
  onCambio: () => void;
}) {
  const [pendiente, iniciar] = useTransition();
  const ev = analisis.evaluacion;

  const ejecutar = (fn: () => Promise<{ exito: boolean; error?: string }>, ok?: string) =>
    iniciar(async () => {
      const r = await fn();
      if (!r.exito) toast.error("error" in r && r.error ? r.error : "No se pudo completar la acción");
      else if (ok) toast.success(ok);
      onCambio();
    });

  const analizar = () => ejecutar(() => analizarContactoAction({ contactoId }), "Análisis en curso");
  const resolverInteres = (decision: "ACEPTAR" | "DESCARTAR") =>
    ejecutar(() => resolverSugerenciaInteresAction({ contactoId, decision }));
  const resolverNoContactar = (decision: "ACEPTAR" | "DESCARTAR") =>
    ejecutar(() => resolverSugerenciaNoContactarAction({ contactoId, decision }));

  const analizando = analisis.analizandoAhora;

  return (
    <div data-slot="seccion-analisis-ia" className="flex flex-col gap-3">
      {!ev ? (
        <p className="text-sm text-muted-foreground">{analisis.estadoCola === "PENDIENTE" || analisis.estadoCola === "EN_PROCESO" ? "Análisis pendiente…" : "Sin analizar."}</p>
      ) : (
        <>
          <Dato etiqueta="Puntaje">
            <InsigniaPuntaje puntaje={ev.puntaje} />
          </Dato>
          <Dato etiqueta="Relación comercial">{ETIQUETA_RELACION[ev.relacionComercial]}</Dato>
          {ev.intencion && <Dato etiqueta="Intención de compra">{ETIQUETA_INTENCION[ev.intencion]}</Dato>}
          {ev.urgencia && <Dato etiqueta="Urgencia">{ETIQUETA_URGENCIA[ev.urgencia]}</Dato>}
          {ev.recuperacion && ev.recuperacion !== "NO_APLICA" && (
            <Dato etiqueta="Posibilidad de recuperación">{ETIQUETA_RECUPERACION[ev.recuperacion]}</Dato>
          )}
          {analisis.accionVisible && <Dato etiqueta="Acción sugerida">{ETIQUETA_ACCION[analisis.accionVisible]}</Dato>}
          <Lista titulo="Señales" items={ev.senales} />
          <Lista titulo="Objeciones" items={ev.objeciones} />
          <Lista titulo="Motivos" items={ev.motivos} />
          <Dato etiqueta="Origen">{ev.origen === "IA" ? "IA y reglas" : "Reglas"}</Dato>
          <Dato etiqueta="Analizado">
            <FechaHora valor={ev.evaluadoIAEn ?? ev.evaluadoEn} modo="relativa" />
          </Dato>
          {ev.criterioNumero !== null ? (
            <Aviso>Criterio de análisis versión {ev.criterioNumero}.</Aviso>
          ) : null}
        </>
      )}

      {analisis.interesFijado && ev?.intencion && (
        <Aviso Icono={Lock}>Interés fijado manualmente: la IA no lo cambia.</Aviso>
      )}

      {puedeModificar && ev?.interesSugeridoPendiente && ev.interesSugerido && (
        <Sugerencia
          texto={
            <>
              Interés sugerido: <strong>{ETIQUETA_INTERES[ev.interesSugerido]}</strong>
            </>
          }
          pendiente={pendiente}
          onDecidir={resolverInteres}
        />
      )}

      {puedeModificar && ev?.noContactarSugeridoPendiente && (
        <Sugerencia
          texto={
            <>
              Sugerencia de la IA: <strong>No contactar</strong>
            </>
          }
          detalle={ev.noContactarMotivo}
          pendiente={pendiente}
          onDecidir={resolverNoContactar}
        />
      )}

      {!analisis.iaDisponible ? (
        <Aviso>El análisis con IA no está habilitado para esta cuenta; se muestra el análisis por reglas.</Aviso>
      ) : (
        puedeModificar && (
          <div>
            <Button size="sm" variant="outline" disabled={pendiente || analizando} onClick={analizar}>
              {analizando ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />}
              {analizando ? "Analizando…" : "Analizar con IA"}
            </Button>
          </div>
        )
      )}
    </div>
  );
}
