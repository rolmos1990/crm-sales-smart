"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TrendingUp, DollarSign, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OportunidadesKpis } from "../queries";

interface OportunidadesKpiCardsProps {
  kpis: OportunidadesKpis;
  moneda: string;
}

function formatearMoneda(valor: number, moneda: string) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: moneda, maximumFractionDigits: 0 }).format(valor);
}

/**
 * Indicadores compactos y accionables — cada uno funciona como atajo de
 * filtro (click aplica el filtro equivalente en la URL, click de nuevo lo
 * quita) y se resalta cuando ese filtro está activo. Deliberadamente más
 * bajos/horizontales que <PedidosKpiCards> — acá se pidió explícitamente
 * evitar tarjetas grandes o llamativas.
 */
export function OportunidadesKpiCards({ kpis, moneda }: OportunidadesKpiCardsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const estadoActivo = searchParams.get("estado");
  const vencimientoActivo = searchParams.get("vencimiento");

  const toggleParam = (clave: string, valor: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const yaActivo = params.get(clave) === valor;
    // Cambiar un filtro rápido siempre vuelve a la primera página.
    params.delete("pagina");
    if (yaActivo) params.delete(clave);
    else params.set(clave, valor);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const tarjetas = [
    {
      clave: "activas",
      etiqueta: "Oportunidades activas",
      valor: kpis.activas,
      Icono: TrendingUp,
      colorIcono: "text-success",
      bgIcono: "bg-success-muted",
      activo: estadoActivo === "activas",
      onClick: () => toggleParam("estado", "activas"),
    },
    {
      clave: "valorPipeline",
      etiqueta: "Valor del pipeline",
      valor: formatearMoneda(kpis.valorPipeline, moneda),
      Icono: DollarSign,
      colorIcono: "text-success",
      bgIcono: "bg-success-muted",
      activo: estadoActivo === "activas",
      onClick: () => toggleParam("estado", "activas"),
    },
    {
      clave: "porVencer",
      etiqueta: "Por vencer",
      valor: kpis.porVencer,
      Icono: Clock,
      colorIcono: "text-stage-amber",
      bgIcono: "bg-stage-amber-muted",
      activo: vencimientoActivo === "7dias",
      onClick: () => toggleParam("vencimiento", "7dias"),
    },
    {
      clave: "vencidas",
      etiqueta: "Vencidas",
      valor: kpis.vencidas,
      Icono: AlertTriangle,
      colorIcono: "text-danger",
      bgIcono: "bg-danger-muted",
      activo: vencimientoActivo === "vencidas",
      onClick: () => toggleParam("vencimiento", "vencidas"),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {tarjetas.map((t) => (
        <button
          key={t.clave}
          type="button"
          onClick={t.onClick}
          title={t.activo ? "Quitar este filtro" : "Filtrar por este indicador"}
          className={cn(
            "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
            t.activo
              ? "bg-card-selected border-primary-border"
              : "bg-card border-card-border hover:bg-card-hover"
          )}
        >
          <div className={cn("rounded-lg p-2 shrink-0", t.bgIcono)}>
            <t.Icono className={cn("h-4 w-4", t.colorIcono)} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-foreground tabular-nums tracking-tight leading-tight truncate">
              {t.valor}
            </p>
            <p className="text-xs text-muted-foreground truncate">{t.etiqueta}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

export function OportunidadesKpiCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-card-border bg-card px-4 py-3">
          <div className="h-8 w-8 rounded-lg bg-muted animate-pulse shrink-0" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-4 w-16 rounded bg-muted animate-pulse" />
            <div className="h-3 w-24 rounded bg-muted animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
