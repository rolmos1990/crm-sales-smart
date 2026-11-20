import { AlertTriangle } from "lucide-react";
import { FormCotizacion } from "@/sales/cotizaciones/components/form-cotizacion";
import { buscarEmpresas } from "@/crm/empresas/queries";
import { buscarContactos } from "@/crm/contactos/queries";
import { obtenerProductosCatalogo } from "@/shared/productos/queries";
import type { FiltroCatalogo } from "@/shared/productos/types";
import { obtenerTransportistas } from "@/sales/transportistas/queries";
import { redirect } from "next/navigation";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { obtenerOportunidadPorId } from "@/crm/oportunidades/queries";
import { obtenerMonedaPrincipal, obtenerConfiguracionEmpresa } from "@/configuracion/empresa/queries";
import { isoDesdePais } from "@/shared/lib/pais-iso";
import type { CrearCotizacionInput } from "@/sales/cotizaciones/schema";

export default async function NuevaCotizacionPage({
  searchParams,
}: {
  searchParams: Promise<{ oportunidadId?: string; contactoId?: string; empresaId?: string }>;
}) {
  const params = await searchParams;
  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "cotizaciones", "modificar").permitido) redirect("/acceso-denegado");
  const [empresas, contactos, productos, monedaDefault, transportistas, config] = await Promise.all([
    buscarEmpresas("", sesion.instanciaId),
    buscarContactos("", sesion.instanciaId),
    obtenerProductosCatalogo(sesion.instanciaId),
    obtenerMonedaPrincipal(sesion.instanciaId),
    obtenerTransportistas(sesion.instanciaId),
    obtenerConfiguracionEmpresa(sesion.instanciaId),
  ]);
  const defaultCountryCode = isoDesdePais(config?.pais);
  const filtroCatalogoInicial: FiltroCatalogo = config?.filtroProductosPedido ?? "TODOS";

  const opcionesEmpresas = empresas.map((e) => ({ valor: e.id, etiqueta: e.nombre }));
  const opcionesContactos = contactos.map((c) => ({ valor: c.id, etiqueta: `${c.nombre} ${c.apellido}` }));

  const defaultValues: Partial<CrearCotizacionInput> = {};
  // 043 — el prefill es accesorio: su fallo no tumba el formulario, pero sí se
  // avisa. Antes se descartaba en silencio y el usuario que venía desde una
  // oportunidad recibía un formulario vacío sin saber por qué.
  let prefillNoDisponible = false;

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
    } catch (err) {
      console.error("[NuevaCotizacionPage] Error al cargar la oportunidad de origen:", err);
      prefillNoDisponible = true;
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)] flex flex-col max-w-5xl mx-auto w-full">
      {prefillNoDisponible && (
        <div className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No se pudieron cargar los datos de la oportunidad de origen. Los campos quedaron vacíos; completalos a mano o recargá la página.
          </p>
        </div>
      )}
      <FormCotizacion
        empresas={opcionesEmpresas}
        contactos={opcionesContactos}
        contactosDetalle={contactos}
        productos={productos}
        filtroCatalogoInicial={filtroCatalogoInicial}
        transportistas={transportistas}
        oportunidadId={params.oportunidadId}
        defaultValues={defaultValues}
        monedaDefault={monedaDefault}
        defaultCountryCode={defaultCountryCode}
      />
    </div>
  );
}
