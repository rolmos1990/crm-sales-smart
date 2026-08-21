import { ShoppingBag, DollarSign, Clock, AlertTriangle, CheckCircle2, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      colorIcono: "text-lime-600 dark:text-lime-400",
      bgIcono: "bg-lime-500/10 ring-1 ring-lime-500/20",
    },
    {
      etiqueta: "Total ventas",
      valor: formatearMoneda(kpis.totalVentas, moneda),
      subvalor: hayRangoFecha ? "Este rango de fechas" : "Total histórico",
      Icono: DollarSign,
      colorIcono: "text-sky-500 dark:text-sky-400",
      bgIcono: "bg-sky-500/10 ring-1 ring-sky-500/20",
    },
    {
      // Siempre 1° del mes actual → hoy, sin importar filtros de fecha
      // activos en pantalla (ver obtenerPedidosKpis / rangoMesActualEnZona).
      etiqueta: "Total ventas · mes actual",
      valor: formatearMoneda(kpis.totalVentasMesActual, moneda),
      subvalor: `${etiquetaMesActual} · hasta hoy`,
      Icono: CalendarDays,
      colorIcono: "text-violet-500 dark:text-violet-400",
      bgIcono: "bg-violet-500/10 ring-1 ring-violet-500/20",
    },
    {
      etiqueta: "Pendientes",
      valor: kpis.pendientes,
      subvalor: "Por vencer",
      Icono: Clock,
      colorIcono: "text-amber-500 dark:text-amber-400",
      bgIcono: "bg-amber-500/10 ring-1 ring-amber-500/20",
    },
    {
      etiqueta: "Expirados",
      valor: kpis.expirados,
      subvalor: "Fuera de fecha",
      Icono: AlertTriangle,
      colorIcono: "text-red-500 dark:text-red-400",
      bgIcono: "bg-red-500/10 ring-1 ring-red-500/20",
    },
    {
      etiqueta: "Entregados",
      valor: kpis.entregados,
      subvalor: "Completados",
      Icono: CheckCircle2,
      colorIcono: "text-emerald-500 dark:text-emerald-400",
      bgIcono: "bg-emerald-500/10 ring-1 ring-emerald-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {tarjetas.map((t) => (
        <Card
          key={t.etiqueta}
          className="bg-card border-card-border shadow-sm dark:shadow-[0_4px_32px_-12px_rgba(0,0,0,0.8)] rounded-xl overflow-hidden"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5">
            <CardTitle className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
              {t.etiqueta}
            </CardTitle>
            <div className={cn("rounded-full p-2 flex-shrink-0", t.bgIcono)}>
              <t.Icono className={cn("h-4 w-4", t.colorIcono)} />
            </div>
          </CardHeader>
          <CardContent className="pb-5">
            <p className="text-2xl font-bold text-stone-900 dark:text-stone-50 tabular-nums tracking-tight">
              {t.valor}
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 font-medium">
              {t.subvalor}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function PedidosKpiCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {[...Array(6)].map((_, i) => (
        <Card key={i} className="bg-card border-card-border rounded-xl">
          <CardHeader className="pb-2 pt-5">
            <div className="h-3 w-20 bg-stone-100 dark:bg-white/[0.06] animate-pulse rounded-full" />
          </CardHeader>
          <CardContent className="pb-5">
            <div className="h-7 w-14 bg-stone-100 dark:bg-white/[0.06] animate-pulse rounded-lg mb-2" />
            <div className="h-3 w-16 bg-stone-100 dark:bg-white/[0.06] animate-pulse rounded-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
