import { Plus, TrendingUp } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { EmptyState } from "@/shared/ui/empty-state";
import { VistaOportunidades } from "@/crm/oportunidades/components/vista-oportunidades";
import { cargarVistaOportunidades, type VistaOportunidades as DatosVistaOportunidades } from "@/crm/oportunidades/vista";
import { obtenerPipelines } from "@/crm/pipeline/queries";
import { buscarContactos } from "@/crm/contactos/queries";
import { buscarProductos } from "@/shared/productos/queries";
import { buscarEmpresas } from "@/crm/empresas/queries";
import { obtenerUsuariosInstancia } from "@/configuracion/usuarios/queries";
import { obtenerTags } from "@/crm/tags/queries";
import { obtenerMonedaPrincipal } from "@/configuracion/empresa/queries";
import { redirect } from "next/navigation";
import { requireSesion } from "@/shared/auth/sesion";
import { puedeModificar, verificarAcceso } from "@/shared/auth/permisos";

export const dynamic = "force-dynamic";

interface OportunidadesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OportunidadesPage({ searchParams }: OportunidadesPageProps) {
  // Los filtros viven en estado de cliente (ver VistaOportunidades), nunca en
  // la URL. Un link viejo con `?estado=…` & cía. se limpia en vez de aplicarse.
  if (Object.keys(await searchParams).length > 0) redirect("/crm/oportunidades");

  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "oportunidades", "ver").permitido) redirect("/acceso-denegado");
  const puedeMod = puedeModificar(sesion.rol, "oportunidades");

  // Zona de negocio: define qué día es "hoy" para los filtros y los KPIs.
  const zonaHoraria = sesion.zonaNegocio;

  const [
    inicial, moneda, productosRes, contactosRes, empresasRes, usuariosRes, tags, pipelines,
  ] = await Promise.all([
    cargarVistaOportunidades(sesion.instanciaId, zonaHoraria, {}),
    obtenerMonedaPrincipal(sesion.instanciaId),
    buscarProductos("", sesion.instanciaId),
    buscarContactos("", sesion.instanciaId),
    buscarEmpresas("", sesion.instanciaId),
    obtenerUsuariosInstancia(sesion.instanciaId),
    obtenerTags(sesion.instanciaId),
    obtenerPipelines(sesion.instanciaId),
  ]);
  const productosIniciales = productosRes.map((p) => ({ valor: p.id, etiqueta: p.nombre }));
  const contactosIniciales = contactosRes.map((c) => ({ valor: c.id, etiqueta: `${c.nombre} ${c.apellido}`, subtitulo: c.telefonoPrincipal ?? undefined }));
  const empresasIniciales = empresasRes.map((e) => ({ valor: e.id, etiqueta: e.nombre }));
  const usuariosOpciones = usuariosRes.map((u) => ({ valor: u.usuarioId, etiqueta: u.nombre }));

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

      {inicial.oportunidades.length === 0 ? (
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
        <VistaOportunidades
          inicial={inicial}
          moneda={moneda}
          barra={{
            productosIniciales,
            contactosIniciales,
            empresasIniciales,
            usuarios: usuariosOpciones,
            tags,
            pipelines: pipelines.map((p) => ({ id: p.id, nombre: p.nombre, stages: p.stages.map((s) => ({ id: s.id, nombre: s.nombre, color: s.color })) })),
          }}
        />
      )}
    </div>
  );
}
