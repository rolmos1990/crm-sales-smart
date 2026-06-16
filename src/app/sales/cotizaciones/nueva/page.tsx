import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { FormCotizacion } from "@/sales/cotizaciones/components/form-cotizacion";
import { buscarEmpresas } from "@/crm/empresas/queries";
import { buscarContactos } from "@/crm/contactos/queries";
import { obtenerProductosCatalogo } from "@/shared/productos/queries";
import { requireSesion } from "@/shared/auth/sesion";
import { obtenerOportunidadPorId } from "@/crm/oportunidades/queries";
import { obtenerMonedaPrincipal } from "@/configuracion/empresa/queries";
import type { CrearCotizacionInput } from "@/sales/cotizaciones/schema";

export default async function NuevaCotizacionPage({
  searchParams,
}: {
  searchParams: Promise<{ oportunidadId?: string; contactoId?: string; empresaId?: string }>;
}) {
  const params = await searchParams;
  const sesion = await requireSesion();
  let empresas: { id: string; nombre: string }[] = [];
  let contactos: { id: string; nombre: string; apellido: string }[] = [];
  let productos: Awaited<ReturnType<typeof obtenerProductosCatalogo>> = [];
  let monedaDefault = "PEN";

  try {
    [empresas, contactos, productos, monedaDefault] = await Promise.all([
      buscarEmpresas("", sesion.instanciaId),
      buscarContactos("", sesion.instanciaId),
      obtenerProductosCatalogo(sesion.instanciaId),
      obtenerMonedaPrincipal(sesion.instanciaId),
    ]);
  } catch {
    // DB not configured
  }

  const opcionesEmpresas = empresas.map((e) => ({ valor: e.id, etiqueta: e.nombre }));
  const opcionesContactos = contactos.map((c) => ({ valor: c.id, etiqueta: `${c.nombre} ${c.apellido}` }));

  const defaultValues: Partial<CrearCotizacionInput> = {};

  if (params.oportunidadId) {
    try {
      const oportunidad = await obtenerOportunidadPorId(params.oportunidadId, sesion.instanciaId);
      if (oportunidad) {
        const oportunidadData = oportunidad as any;
        const contactoPrincipal =
          oportunidadData.contactos?.find((r: any) => r.principal)?.contacto ??
          oportunidadData.contactos?.[0]?.contacto ??
          null;

        if (params.contactoId || contactoPrincipal?.id) {
          defaultValues.contactoId = params.contactoId || contactoPrincipal?.id || "";
        }
        if (params.empresaId || oportunidadData.empresaId) {
          defaultValues.empresaId = params.empresaId || oportunidadData.empresaId || "";
        }
        if (contactoPrincipal) {
          defaultValues.destinatario = {
            nombre: contactoPrincipal.nombre ?? "",
            apellido: contactoPrincipal.apellido ?? "",
            telefono: contactoPrincipal.telefonoPrincipal ?? "",
            email: contactoPrincipal.email ?? "",
          };
        }
      }
    } catch {
      // oportunidad no disponible
    }
  }

  const volverHref = params.oportunidadId
    ? `/crm/oportunidades/${params.oportunidadId}`
    : "/sales/cotizaciones";

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <ButtonLink variant="ghost" size="icon-sm" href={volverHref}><ArrowLeft className="h-4 w-4" /></ButtonLink>
      </div>
      <PageHeader titulo="Nueva cotización" descripcion="Crea una cotización con líneas de productos" />
      <FormCotizacion
        empresas={opcionesEmpresas}
        contactos={opcionesContactos}
        productos={productos}
        oportunidadId={params.oportunidadId}
        defaultValues={defaultValues}
        monedaDefault={monedaDefault}
      />
    </div>
  );
}
