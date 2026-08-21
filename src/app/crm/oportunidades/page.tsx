import { Plus, TrendingUp, SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { EmptyState } from "@/shared/ui/empty-state";
import { ListaOportunidades } from "@/crm/oportunidades/components/lista-oportunidades";
import { OportunidadesKpiCards } from "@/crm/oportunidades/components/oportunidades-kpi-cards";
import { OportunidadesFiltrosBar } from "@/crm/oportunidades/components/oportunidades-filtros";
import {
  obtenerOportunidades, obtenerOportunidadesKpis, type OportunidadesFiltros,
} from "@/crm/oportunidades/queries";
import { obtenerPipelines } from "@/crm/pipeline/queries";
import { buscarContactos } from "@/crm/contactos/queries";
import { buscarProductos } from "@/shared/productos/queries";
import { buscarEmpresas } from "@/crm/empresas/queries";
import { obtenerUsuariosInstancia } from "@/configuracion/usuarios/queries";
import { obtenerTags } from "@/crm/tags/queries";
import { obtenerMonedaPrincipal, obtenerConfiguracionEmpresa } from "@/configuracion/empresa/queries";
import { redirect } from "next/navigation";
import { requireSesion } from "@/shared/auth/sesion";
import { puedeModificar, verificarAcceso } from "@/shared/auth/permisos";
import type { Oportunidad, Etapa } from "@/crm/oportunidades/types";
import type { OportunidadesKpis } from "@/crm/oportunidades/queries";

export const dynamic = "force-dynamic";

interface OportunidadesPageProps {
  searchParams: Promise<{
    q?: string;
    productoIds?: string;
    contactoIds?: string;
    vencimiento?: string;
    vencDesde?: string;
    vencHasta?: string;
    etapaId?: string;
    etapa?: string;
    estado?: string;
    responsable?: string;
    tagIds?: string;
    empresaId?: string;
    valorMin?: string;
    valorMax?: string;
    probMin?: string;
    probMax?: string;
    creadoDesde?: string;
    creadoHasta?: string;
    cotizacion?: string;
    actividadPendiente?: string;
    sinActividadReciente?: string;
  }>;
}

export default async function OportunidadesPage({ searchParams }: OportunidadesPageProps) {
  const sp = await searchParams;
  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "oportunidades", "ver").permitido) redirect("/acceso-denegado");
  const puedeMod = puedeModificar(sesion.rol, "oportunidades");

  let zonaHoraria = "America/Lima";
  try {
    const config = await obtenerConfiguracionEmpresa(sesion.instanciaId);
    if (config?.zonaHoraria) zonaHoraria = config.zonaHoraria;
  } catch {
    // usa el default
  }

  const csvAArray = (v?: string) => (v ? v.split(",").filter(Boolean) : undefined);
  const parseFecha = (v?: string) => (v ? new Date(`${v}T00:00:00`) : undefined);
  const parseFechaExclusiva = (v?: string) => {
    if (!v) return undefined;
    const d = new Date(`${v}T00:00:00`);
    d.setDate(d.getDate() + 1);
    return d;
  };

  const filtros: OportunidadesFiltros = {
    busqueda: sp.q || undefined,
    productoIds: csvAArray(sp.productoIds),
    contactoIds: csvAArray(sp.contactoIds),
    empresaId: sp.empresaId || undefined,
    usuarioId: sp.responsable || undefined,
    tagIds: csvAArray(sp.tagIds),
    etapaId: sp.etapaId || undefined,
    etapaLegacy: (sp.etapa as Etapa) || undefined,
    estado: (sp.estado as OportunidadesFiltros["estado"]) || undefined,
    valorMin: sp.valorMin ? Number(sp.valorMin) : undefined,
    valorMax: sp.valorMax ? Number(sp.valorMax) : undefined,
    probabilidadMin: sp.probMin ? Number(sp.probMin) : undefined,
    probabilidadMax: sp.probMax ? Number(sp.probMax) : undefined,
    creadoDesde: parseFecha(sp.creadoDesde),
    creadoHasta: parseFechaExclusiva(sp.creadoHasta),
    conCotizacion: sp.cotizacion === "con" ? true : sp.cotizacion === "sin" ? false : undefined,
    conActividadesPendientes: sp.actividadPendiente === "1" || undefined,
    sinActividadReciente: sp.sinActividadReciente === "1" || undefined,
    vencimiento: (sp.vencimiento as OportunidadesFiltros["vencimiento"]) || undefined,
    vencDesde: parseFecha(sp.vencDesde),
    vencHasta: parseFechaExclusiva(sp.vencHasta),
  };

  let oportunidades: Oportunidad[] = [];
  let kpis: OportunidadesKpis = { activas: 0, valorPipeline: 0, porVencer: 0, vencidas: 0 };
  let moneda = "PEN";
  let productosIniciales: { valor: string; etiqueta: string }[] = [];
  let contactosIniciales: { valor: string; etiqueta: string; subtitulo?: string }[] = [];
  let empresasIniciales: { valor: string; etiqueta: string }[] = [];
  let usuariosOpciones: { valor: string; etiqueta: string }[] = [];
  let tags: Awaited<ReturnType<typeof obtenerTags>> = [];
  let pipelines: Awaited<ReturnType<typeof obtenerPipelines>> = [];

  try {
    const [
      datos, kpisDatos, monedaRes, productosRes, contactosRes, empresasRes,
      usuariosRes, tagsRes, pipelinesRes,
    ] = await Promise.all([
      obtenerOportunidades(sesion.instanciaId, filtros, zonaHoraria),
      obtenerOportunidadesKpis(sesion.instanciaId, filtros, zonaHoraria),
      obtenerMonedaPrincipal(sesion.instanciaId),
      buscarProductos("", sesion.instanciaId),
      buscarContactos("", sesion.instanciaId),
      buscarEmpresas("", sesion.instanciaId),
      obtenerUsuariosInstancia(sesion.instanciaId),
      obtenerTags(sesion.instanciaId),
      obtenerPipelines(sesion.instanciaId),
    ]);
    oportunidades = datos.map((o) => ({ ...o, valor: Number(o.valor) })) as unknown as Oportunidad[];
    kpis = kpisDatos;
    moneda = monedaRes;
    productosIniciales = productosRes.map((p) => ({ valor: p.id, etiqueta: p.nombre }));
    contactosIniciales = contactosRes.map((c) => ({ valor: c.id, etiqueta: `${c.nombre} ${c.apellido}`, subtitulo: c.telefonoPrincipal ?? undefined }));
    empresasIniciales = empresasRes.map((e) => ({ valor: e.id, etiqueta: e.nombre }));
    usuariosOpciones = usuariosRes.map((u) => ({ valor: u.usuarioId, etiqueta: u.nombre }));
    tags = tagsRes;
    pipelines = pipelinesRes;
  } catch (err) {
    console.error("[OportunidadesPage] Error al cargar oportunidades:", err);
  }

  const hayFiltrosActivos = Boolean(
    sp.q || sp.productoIds || sp.contactoIds || sp.vencimiento || sp.etapaId || sp.etapa ||
    sp.estado || sp.responsable || sp.tagIds || sp.empresaId || sp.valorMin || sp.valorMax ||
    sp.probMin || sp.probMax || sp.creadoDesde || sp.creadoHasta || sp.cotizacion ||
    sp.actividadPendiente || sp.sinActividadReciente
  );
  const hayOportunidadesSinFiltrar = oportunidades.length > 0 || hayFiltrosActivos;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        titulo="Oportunidades"
        descripcion="Gestiona todas tus oportunidades de venta"
        accion={puedeMod ? (
          <ButtonLink href="/crm/oportunidades/nueva">
            <Plus className="mr-2 h-4 w-4" />
            Nueva oportunidad
          </ButtonLink>
        ) : undefined}
      />

      {!hayOportunidadesSinFiltrar ? (
        <EmptyState
          Icono={TrendingUp}
          titulo="Sin oportunidades todavía"
          descripcion="Crea tu primera oportunidad para empezar a gestionar tu pipeline de ventas."
          accion={puedeMod ? (
            <ButtonLink href="/crm/oportunidades/nueva">
              <Plus className="mr-2 h-4 w-4" />
              Crear primera oportunidad
            </ButtonLink>
          ) : undefined}
        />
      ) : (
        <>
          <OportunidadesKpiCards kpis={kpis} moneda={moneda} />
          <OportunidadesFiltrosBar
            productosIniciales={productosIniciales}
            contactosIniciales={contactosIniciales}
            empresasIniciales={empresasIniciales}
            usuarios={usuariosOpciones}
            tags={tags}
            pipelines={pipelines.map((p) => ({ id: p.id, nombre: p.nombre, stages: p.stages.map((s) => ({ id: s.id, nombre: s.nombre, color: s.color })) }))}
          />
          {oportunidades.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16">
              <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                <SearchX className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No encontramos oportunidades con estos filtros.</p>
              <ButtonLink href="/crm/oportunidades" variant="outline" size="sm">
                Limpiar filtros
              </ButtonLink>
            </div>
          ) : (
            <ListaOportunidades oportunidades={oportunidades} />
          )}
        </>
      )}
    </div>
  );
}
