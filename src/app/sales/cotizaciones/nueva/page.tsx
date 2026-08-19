import { FormCotizacion } from "@/sales/cotizaciones/components/form-cotizacion";
import { buscarEmpresas } from "@/crm/empresas/queries";
import { buscarContactos } from "@/crm/contactos/queries";
import { obtenerProductosCatalogo } from "@/shared/productos/queries";
import { obtenerTransportistas } from "@/sales/transportistas/queries";
import { redirect } from "next/navigation";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
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
  if (!verificarAcceso(sesion, "cotizaciones", "modificar").permitido) redirect("/acceso-denegado");
  let empresas: { id: string; nombre: string }[] = [];
  let contactos: Awaited<ReturnType<typeof buscarContactos>> = [];
  let productos: Awaited<ReturnType<typeof obtenerProductosCatalogo>> = [];
  let transportistas: Awaited<ReturnType<typeof obtenerTransportistas>> = [];
  let monedaDefault = "PEN";

  try {
    [empresas, contactos, productos, monedaDefault, transportistas] = await Promise.all([
      buscarEmpresas("", sesion.instanciaId),
      buscarContactos("", sesion.instanciaId),
      obtenerProductosCatalogo(sesion.instanciaId),
      obtenerMonedaPrincipal(sesion.instanciaId),
      obtenerTransportistas(sesion.instanciaId),
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

  return (
    <div className="min-h-[calc(100vh-56px)] flex flex-col max-w-5xl mx-auto w-full">
      <FormCotizacion
        empresas={opcionesEmpresas}
        contactos={opcionesContactos}
        contactosDetalle={contactos}
        productos={productos}
        transportistas={transportistas}
        oportunidadId={params.oportunidadId}
        defaultValues={defaultValues}
        monedaDefault={monedaDefault}
      />
    </div>
  );
}
