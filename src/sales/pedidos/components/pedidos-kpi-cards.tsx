import { ShoppingBag, DollarSign, Clock, AlertTriangle, CheckCircle2, CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PedidosKpis } from "../queries";

interface PedidosKpiCardsProps {
  kpis: PedidosKpis;
  moneda: string;
  hayRangoFecha: boolean;
  /** "Agosto 2026" — ya resuelto en la zona horaria de negocio. */
  etiquetaMesActual: string;
}

function formatearMoneda(valor: number, moneda: string) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: moneda }).format(valor);
}

export function PedidosKpiCards({ kpis, moneda, hayRangoFecha, etiquetaMesActual }: PedidosKpiCardsProps) {
  const tarjetas = [
    {
      etiqueta: "Total pedidos",
      valor: kpis.totalPedidos,
      subvalor: hayRangoFecha ? "Este rango de fechas" : "Total histórico",
      Icono: ShoppingBag,
      acento: "text-primary bg-primary-muted",
    },
    {
      etiqueta: "Total ventas",
      valor: formatearMoneda(kpis.totalVentas, moneda),
      subvalor: hayRangoFecha ? "Este rango de fechas" : "Total histórico",
      Icono: DollarSign,
      acento: "text-stage-cyan-text bg-stage-cyan-muted",
    },
    {
      // Siempre 1° del mes actual → fin del día de hoy, sin importar filtros
      // de fecha activos en pantalla (ver obtenerPedidosKpis / rangoMesHastaHoy).
      etiqueta: "Total ventas · mes actual",
      valor: formatearMoneda(kpis.totalVentasMesActual, moneda),
      subvalor: `${etiquetaMesActual} · hasta hoy`,
      Icono: CalendarDays,
      acento: "text-stage-purple-text bg-stage-purple-muted",
    },
    {
      etiqueta: "Pendientes",
      valor: kpis.pendientes,
      subvalor: "Por vencer",
      Icono: Clock,
      acento: "text-stage-amber-text bg-stage-amber-muted",
    },
    {
      etiqueta: "Expirados",
      valor: kpis.expirados,
      subvalor: "Fuera de fecha",
      Icono: AlertTriangle,
      acento: "text-danger-text bg-danger-muted",
    },
    {
      etiqueta: "Entregados",
      valor: kpis.entregados,
      subvalor: "Completados",
      Icono: CheckCircle2,
      acento: "text-success-text bg-success-muted",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tarjetas.map((t) => (
        <Card
          key={t.etiqueta}
          className="h-full gap-0 py-0 shadow-sm"
        >
          {/* `h-full` + la cifra empujada abajo con `mt-auto`: la etiqueta de
              "Total ventas · mes actual" ocupa dos líneas y sin esto las seis
              tarjetas quedaban desalineadas entre sí. */}
          <CardContent className="flex h-full flex-col gap-2 px-4 py-4">
            <div className="flex items-start gap-2">
              <span className={cn("mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-md", t.acento)}>
                <t.Icono className="h-3.5 w-3.5" />
              </span>
              <span className="text-[11px] leading-tight font-semibold tracking-wide text-muted-foreground uppercase">
                {t.etiqueta}
              </span>
            </div>
            <div className="mt-auto">
              <p className="truncate text-xl font-semibold tracking-tight text-foreground tabular-nums">
                {t.valor}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.subvalor}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function PedidosKpiCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {[...Array(6)].map((_, i) => (
        <Card key={i} className="gap-0 py-0">
          <CardContent className="flex flex-col gap-2 px-4 py-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 shrink-0 animate-pulse rounded-md bg-muted" />
              <div className="h-3 w-20 animate-pulse rounded-full bg-muted" />
            </div>
            <div className="mt-2">
              <div className="mb-2 h-6 w-16 animate-pulse rounded-lg bg-muted" />
              <div className="h-3 w-20 animate-pulse rounded-full bg-muted" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
