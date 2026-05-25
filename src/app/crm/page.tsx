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
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { prisma } from "@/shared/db/prisma";

// ---- KPI data ----

async function obtenerKpis() {
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
      prisma.contacto.count({ where: { estado: "ACTIVO" } }),
      prisma.oportunidad.findMany({
        where: { etapa: { notIn: ["GANADO", "PERDIDO"] } },
        select: { valor: true },
      }),
      prisma.oportunidad.findMany({
        where: { etapa: "GANADO", actualizadoEn: { gte: inicioMes } },
        select: { valor: true },
      }),
      prisma.actividad.count({
        where: { completada: false, fecha: { gte: inicioDia, lt: finDia } },
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

async function obtenerUltimasOportunidades() {
  try {
    return prisma.oportunidad.findMany({
      take: 5,
      orderBy: { creadoEn: "desc" },
      include: {
        empresa: { select: { nombre: true } },
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

async function obtenerActividadesHoy() {
  try {
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);
    const finDia = new Date(inicioDia.getTime() + 86400000);

    return prisma.actividad.findMany({
      where: { completada: false, fecha: { gte: inicioDia, lt: finDia } },
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

function formatCurrency(valor: number, moneda = "PEN") {
  return `${moneda} ${valor.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
}

const ETAPA_LABELS: Record<string, string> = {
  PROSPECTO: "Prospecto",
  CALIFICADO: "Calificado",
  PROPUESTA: "Propuesta",
  NEGOCIACION: "Negociación",
  GANADO: "Ganado",
  PERDIDO: "Perdido",
};

const TIPO_LABELS: Record<string, string> = {
  LLAMADA: "Llamada",
  EMAIL: "Email",
  REUNION: "Reunión",
  TAREA: "Tarea",
  NOTA: "Nota",
};

// ---- Components ----

async function KpiCards() {
  const kpis = await obtenerKpis();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-blue-500" />
            Contactos activos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{kpis.totalContactos}</p>
          <Link href="/crm/contactos" className="text-xs text-muted-foreground hover:underline flex items-center gap-1 mt-1">
            Ver todos <ArrowRight className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-violet-500" />
            Pipeline activo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{kpis.totalOportunidadesAbiertas}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(kpis.valorPipeline)}</p>
          <Link href="/crm/pipeline" className="text-xs text-muted-foreground hover:underline flex items-center gap-1 mt-1">
            Ver pipeline <ArrowRight className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            Ganadas este mes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{kpis.totalGanadasMes}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(kpis.valorGanadoMes)}</p>
          <Link href="/crm/oportunidades" className="text-xs text-muted-foreground hover:underline flex items-center gap-1 mt-1">
            Ver oportunidades <ArrowRight className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <CalendarCheck className="h-3.5 w-3.5 text-amber-500" />
            Actividades hoy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{kpis.actividadesPendientesHoy}</p>
          <p className="text-xs text-muted-foreground mt-0.5">pendientes</p>
          <Link href="/crm/actividades" className="text-xs text-muted-foreground hover:underline flex items-center gap-1 mt-1">
            Ver actividades <ArrowRight className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

async function UltimasOportunidades() {
  const oportunidades = await obtenerUltimasOportunidades();

  if (oportunidades.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No hay oportunidades todavía.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {oportunidades.map((op) => {
        const contacto = op.contactos[0]?.contacto;
        return (
          <Link
            key={op.id}
            href={`/crm/oportunidades/${op.id}`}
            className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors group"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate group-hover:text-primary">
                {op.titulo}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {op.empresa?.nombre ?? contacto ? `${contacto?.nombre} ${contacto?.apellido}` : "Sin vinculación"}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              <Badge variant="secondary" className="text-xs">
                {ETAPA_LABELS[op.etapa] ?? op.etapa}
              </Badge>
              <span className="text-xs font-medium tabular-nums">
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
  const actividades = await obtenerActividadesHoy();

  if (actividades.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Sin actividades pendientes para hoy.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {actividades.map((act) => {
        const vinculo =
          act.empresa?.nombre ??
          (act.contacto ? `${act.contacto.nombre} ${act.contacto.apellido}` : null) ??
          act.oportunidad?.titulo ??
          "Sin vinculación";

        return (
          <div key={act.id} className="flex items-start gap-2.5 py-2 px-3 rounded-md">
            <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{act.titulo}</p>
              <p className="text-xs text-muted-foreground truncate">
                {TIPO_LABELS[act.tipo] ?? act.tipo} · {vinculo}
              </p>
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0">
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
        <Card key={i}>
          <CardHeader className="pb-2">
            <div className="h-3 w-24 bg-muted animate-pulse rounded" />
          </CardHeader>
          <CardContent>
            <div className="h-8 w-16 bg-muted animate-pulse rounded mb-2" />
            <div className="h-3 w-20 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2 py-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center justify-between px-3 py-2">
          <div className="space-y-1.5">
            <div className="h-3.5 w-40 bg-muted animate-pulse rounded" />
            <div className="h-3 w-24 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-5 w-20 bg-muted animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}

// ---- Page ----

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Bienvenido a CRM Sales Smart</p>
      </div>

      <Suspense fallback={<KpiCardsSkeleton />}>
        <KpiCards />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Últimas oportunidades</CardTitle>
            <ButtonLink href="/crm/oportunidades" variant="ghost" size="sm">
              Ver todas <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </ButtonLink>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <Suspense fallback={<TableSkeleton />}>
              <UltimasOportunidades />
            </Suspense>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Actividades de hoy</CardTitle>
            <ButtonLink href="/crm/actividades" variant="ghost" size="sm">
              Ver todas <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </ButtonLink>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <Suspense fallback={<TableSkeleton />}>
              <ActividadesHoy />
            </Suspense>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { href: "/crm/contactos/nuevo", label: "Nuevo contacto", Icono: Users },
          { href: "/crm/empresas/nueva", label: "Nueva empresa", Icono: Building2 },
          { href: "/crm/oportunidades/nueva", label: "Nueva oportunidad", Icono: TrendingUp },
          { href: "/crm/actividades/nueva", label: "Nueva actividad", Icono: CalendarCheck },
          { href: "/sales/cotizaciones/nueva", label: "Nueva cotización", Icono: TrendingUp },
          { href: "/sales/pedidos/nuevo", label: "Nuevo pedido", Icono: Building2 },
        ].map(({ href, label, Icono }) => (
          <ButtonLink key={href} href={href} variant="outline" size="sm" className="flex-col h-auto py-3 gap-1.5">
            <Icono className="h-4 w-4" />
            <span className="text-xs text-center leading-tight">{label}</span>
          </ButtonLink>
        ))}
      </div>
    </div>
  );
}
