export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import {
  Users,
  Building2,
  TrendingUp,
  CalendarCheck,
  ArrowRight,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { obtenerMonedaPrincipal } from "@/configuracion/empresa/queries";
import { MONEDA_DEFAULT } from "@/shared/moneda/constants";
import { EtapaBadge } from "@/crm/oportunidades/components/etapa-badge";
import { cn } from "@/lib/utils";

// ---- KPI data ----

async function obtenerKpis(instanciaId: string) {
  try {
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const inicioDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const finDia = new Date(inicioDia.getTime() + 86400000);

    const [
      totalContactos,
      oportunidadesAbiertas,
      oportunidadesGanadasMes,
      actividadesPendientesHoy,
    ] = await Promise.all([
      prisma.contacto.count({ where: { instanciaId, estado: "ACTIVO" } }),
      prisma.oportunidad.findMany({
        where: { instanciaId, etapa: { notIn: ["GANADO", "PERDIDO"] } },
        select: { valor: true },
      }),
      prisma.oportunidad.findMany({
        where: { instanciaId, etapa: "GANADO", actualizadoEn: { gte: inicioMes } },
        select: { valor: true },
      }),
      prisma.actividad.count({
        where: { instanciaId, completada: false, fecha: { gte: inicioDia, lt: finDia } },
      }),
    ]);

    const valorPipeline = oportunidadesAbiertas.reduce(
      (sum, o) => sum + Number(o.valor),
      0
    );
    const valorGanadoMes = oportunidadesGanadasMes.reduce(
      (sum, o) => sum + Number(o.valor),
      0
    );

    return {
      totalContactos,
      totalOportunidadesAbiertas: oportunidadesAbiertas.length,
      valorPipeline,
      totalGanadasMes: oportunidadesGanadasMes.length,
      valorGanadoMes,
      actividadesPendientesHoy,
    };
  } catch {
    return {
      totalContactos: 0,
      totalOportunidadesAbiertas: 0,
      valorPipeline: 0,
      totalGanadasMes: 0,
      valorGanadoMes: 0,
      actividadesPendientesHoy: 0,
    };
  }
}

async function obtenerUltimasOportunidades(instanciaId: string) {
  try {
    return prisma.oportunidad.findMany({
      where: { instanciaId },
      take: 5,
      orderBy: { creadoEn: "desc" },
      include: {
        empresa: { select: { nombre: true } },
        stage: { select: { nombre: true, color: true } },
        contactos: {
          take: 1,
          include: { contacto: { select: { nombre: true, apellido: true } } },
        },
      },
    });
  } catch {
    return [];
  }
}

async function obtenerActividadesHoy(instanciaId: string) {
  try {
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);
    const finDia = new Date(inicioDia.getTime() + 86400000);

    return prisma.actividad.findMany({
      where: { instanciaId, completada: false, fecha: { gte: inicioDia, lt: finDia } },
      orderBy: { fecha: "asc" },
      take: 8,
      include: {
        contacto: { select: { nombre: true, apellido: true } },
        empresa: { select: { nombre: true } },
        oportunidad: { select: { titulo: true } },
      },
    });
  } catch {
    return [];
  }
}

// ---- Formatting helpers ----

function formatCurrency(valor: number, moneda: string = MONEDA_DEFAULT) {
  return `${moneda} ${valor.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
}

const TIPO_LABELS: Record<string, string> = {
  LLAMADA: "Llamada",
  EMAIL: "Email",
  REUNION: "Reunión",
  TAREA: "Tarea",
  NOTA: "Nota",
};

// ---- Components ----

async function KpiCards() {
  const sesion = await requireSesion();
  const [kpis, moneda] = await Promise.all([
    obtenerKpis(sesion.instanciaId),
    obtenerMonedaPrincipal(sesion.instanciaId),
  ]);

  const tarjetas = [
    {
      etiqueta: "Contactos activos",
      valor: kpis.totalContactos,
      subvalor: null,
      href: "/crm/contactos",
      enlace: "Ver todos",
      Icono: Users,
      colorIcono: "text-sky-400",
      bgIcono: "bg-sky-500/10 dark:bg-sky-500/10 ring-1 ring-sky-500/20",
    },
    {
      etiqueta: "Pipeline activo",
      valor: kpis.totalOportunidadesAbiertas,
      subvalor: formatCurrency(kpis.valorPipeline, moneda),
      href: "/crm/pipeline",
      enlace: "Ver pipeline",
      Icono: TrendingUp,
      colorIcono: "text-violet-400",
      bgIcono: "bg-violet-500/10 dark:bg-violet-500/10 ring-1 ring-violet-500/20",
    },
    {
      etiqueta: "Ganadas este mes",
      valor: kpis.totalGanadasMes,
      subvalor: formatCurrency(kpis.valorGanadoMes, moneda),
      href: "/crm/oportunidades",
      enlace: "Ver oportunidades",
      Icono: CheckCircle2,
      colorIcono: "text-emerald-400",
      bgIcono: "bg-emerald-500/10 dark:bg-emerald-500/10 ring-1 ring-emerald-500/20",
    },
    {
      etiqueta: "Actividades hoy",
      valor: kpis.actividadesPendientesHoy,
      subvalor: "pendientes",
      href: "/crm/actividades",
      enlace: "Ver actividades",
      Icono: CalendarCheck,
      colorIcono: "text-amber-400",
      bgIcono: "bg-amber-500/10 dark:bg-amber-500/10 ring-1 ring-amber-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {tarjetas.map((t) => (
        <Card
          key={t.etiqueta}
          className="bg-card border-card-border shadow-sm dark:shadow-[0_4px_32px_-12px_rgba(0,0,0,0.8)] rounded-xl overflow-hidden"
        >
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-xs font-semibold text-stone-500 dark:text-stone-400 flex items-center gap-2 uppercase tracking-wide">
              <div className={cn("rounded-lg p-1.5 flex-shrink-0", t.bgIcono)}>
                <t.Icono className={cn("h-3.5 w-3.5", t.colorIcono)} />
              </div>
              {t.etiqueta}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            <p className="text-3xl font-bold text-stone-900 dark:text-stone-50 tabular-nums tracking-tight">
              {t.valor}
            </p>
            {t.subvalor && (
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 font-medium">
                {t.subvalor}
              </p>
            )}
            <Link
              href={t.href}
              className="text-xs text-stone-400 dark:text-stone-500 hover:text-lime-600 dark:hover:text-lime-400 flex items-center gap-1 mt-2.5 transition-colors"
            >
              {t.enlace} <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function UltimasOportunidades() {
  const sesion = await requireSesion();
  const oportunidades = await obtenerUltimasOportunidades(sesion.instanciaId);

  if (oportunidades.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No hay oportunidades todavía.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {oportunidades.map((op) => {
        const contacto = op.contactos[0]?.contacto;
        return (
          <Link
            key={op.id}
            href={`/crm/oportunidades/${op.id}`}
            className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-stone-50 dark:hover:bg-white/[0.04] transition-all duration-150 group"
          >
            <div className="min-w-0 flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-stone-100 dark:bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                <Building2 className="h-3.5 w-3.5 text-stone-400 dark:text-stone-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate text-stone-900 dark:text-stone-100 group-hover:text-lime-600 dark:group-hover:text-lime-400 transition-colors">
                  {op.titulo}
                </p>
                <p className="text-xs text-stone-400 dark:text-stone-500 truncate">
                  {op.empresa?.nombre ?? (contacto ? `${contacto.nombre} ${contacto.apellido}` : "Sin vinculación")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 flex-shrink-0 ml-3">
              <EtapaBadge etapa={op.etapa} stage={op.stage} />
              <span className="text-xs font-semibold tabular-nums text-stone-700 dark:text-stone-300">
                {formatCurrency(Number(op.valor), op.moneda)}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

async function ActividadesHoy() {
  const sesion = await requireSesion();
  const actividades = await obtenerActividadesHoy(sesion.instanciaId);

  if (actividades.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Sin actividades pendientes para hoy.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {actividades.map((act) => {
        const vinculo =
          act.empresa?.nombre ??
          (act.contacto ? `${act.contacto.nombre} ${act.contacto.apellido}` : null) ??
          act.oportunidad?.titulo ??
          "Sin vinculación";

        return (
          <div
            key={act.id}
            className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-stone-50 dark:hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-lime-500 dark:bg-lime-400 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate text-stone-900 dark:text-stone-100">
                {act.titulo}
              </p>
              <p className="text-xs text-stone-400 dark:text-stone-500 truncate">
                {TIPO_LABELS[act.tipo] ?? act.tipo} · {vinculo}
              </p>
            </div>
            <span className="text-xs font-medium text-stone-500 dark:text-stone-400 flex-shrink-0 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(act.fecha).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function KpiCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Card
          key={i}
          className="bg-card border-card-border rounded-xl"
        >
          <CardHeader className="pb-2 pt-5">
            <div className="h-3 w-24 bg-stone-100 dark:bg-white/[0.06] animate-pulse rounded-full" />
          </CardHeader>
          <CardContent className="pb-5">
            <div className="h-9 w-16 bg-stone-100 dark:bg-white/[0.06] animate-pulse rounded-lg mb-2" />
            <div className="h-3 w-20 bg-stone-100 dark:bg-white/[0.06] animate-pulse rounded-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-1 py-1">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center justify-between px-3 py-2.5">
          <div className="space-y-1.5">
            <div className="h-3.5 w-40 bg-stone-100 dark:bg-white/[0.06] animate-pulse rounded" />
            <div className="h-3 w-24 bg-stone-100 dark:bg-white/[0.06] animate-pulse rounded" />
          </div>
          <div className="h-5 w-20 bg-stone-100 dark:bg-white/[0.06] animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}

// ---- Page ----

const ACCIONES_RAPIDAS = [
  { href: "/crm/contactos/nuevo", label: "Nuevo contacto", Icono: Users },
  { href: "/crm/empresas/nueva", label: "Nueva empresa", Icono: Building2 },
  { href: "/crm/oportunidades/nueva", label: "Nueva oportunidad", Icono: TrendingUp },
  { href: "/crm/actividades/nueva", label: "Nueva actividad", Icono: CalendarCheck },
  { href: "/sales/cotizaciones/nueva", label: "Nueva cotización", Icono: TrendingUp },
  { href: "/sales/pedidos/nuevo", label: "Nuevo pedido", Icono: Building2 },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-screen-xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          Dashboard
        </h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
          Bienvenido a{" "}
          <span className="text-lime-600 dark:text-lime-400 font-medium">KariaApp</span>
        </p>
      </div>

      <Suspense fallback={<KpiCardsSkeleton />}>
        <KpiCards />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-card-border shadow-sm dark:shadow-[0_4px_32px_-12px_rgba(0,0,0,0.8)] rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-stone-100 dark:border-white/[0.06]">
            <CardTitle className="text-sm font-semibold text-stone-900 dark:text-stone-50 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-lime-500 dark:text-lime-400" />
              Últimas oportunidades
            </CardTitle>
            <ButtonLink
              href="/crm/oportunidades"
              variant="ghost"
              size="sm"
              className="text-stone-400 dark:text-stone-500 hover:text-lime-600 dark:hover:text-lime-400 hover:bg-lime-500/5 dark:hover:bg-lime-400/10 h-7 px-2 text-xs rounded-lg"
            >
              Ver todas <ArrowRight className="ml-1 h-3 w-3" />
            </ButtonLink>
          </CardHeader>
          <CardContent className="px-2 pb-2 pt-2">
            <Suspense fallback={<TableSkeleton />}>
              <UltimasOportunidades />
            </Suspense>
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border shadow-sm dark:shadow-[0_4px_32px_-12px_rgba(0,0,0,0.8)] rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-stone-100 dark:border-white/[0.06]">
            <CardTitle className="text-sm font-semibold text-stone-900 dark:text-stone-50 flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-lime-500 dark:text-lime-400" />
              Actividades de hoy
            </CardTitle>
            <ButtonLink
              href="/crm/actividades"
              variant="ghost"
              size="sm"
              className="text-stone-400 dark:text-stone-500 hover:text-lime-600 dark:hover:text-lime-400 hover:bg-lime-500/5 dark:hover:bg-lime-400/10 h-7 px-2 text-xs rounded-lg"
            >
              Ver todas <ArrowRight className="ml-1 h-3 w-3" />
            </ButtonLink>
          </CardHeader>
          <CardContent className="px-2 pb-2 pt-2">
            <Suspense fallback={<TableSkeleton />}>
              <ActividadesHoy />
            </Suspense>
          </CardContent>
        </Card>
      </div>

      <div>
        <p className="text-[10px] font-semibold text-stone-400 dark:text-white/25 uppercase tracking-[0.08em] mb-3">
          Acciones rápidas
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {ACCIONES_RAPIDAS.map(({ href, label, Icono }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center h-auto py-4 gap-2 rounded-xl border text-center transition-all duration-150",
                "border-card-border bg-card",
                "hover:border-lime-500/40 dark:hover:border-lime-400/25",
                "hover:bg-lime-50 dark:hover:bg-lime-400/[0.06]",
                "hover:shadow-sm dark:hover:shadow-[0_2px_12px_-4px_rgba(163,230,53,0.15)]",
                "group"
              )}
            >
              <div className="rounded-lg bg-stone-100 dark:bg-white/[0.06] p-1.5 group-hover:bg-lime-500/10 dark:group-hover:bg-lime-400/[0.1] transition-colors">
                <Icono className="h-3.5 w-3.5 text-stone-500 dark:text-stone-400 group-hover:text-lime-600 dark:group-hover:text-lime-400 transition-colors" />
              </div>
              <span className="text-xs text-center leading-tight text-stone-600 dark:text-stone-300 group-hover:text-stone-900 dark:group-hover:text-stone-100 transition-colors px-1">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
