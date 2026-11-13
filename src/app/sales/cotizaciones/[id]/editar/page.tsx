import { notFound, redirect } from "next/navigation";
import { FormCotizacion } from "@/sales/cotizaciones/components/form-cotizacion";
import { buscarEmpresas } from "@/crm/empresas/queries";
import { buscarContactos } from "@/crm/contactos/queries";
import { obtenerProductosCatalogo } from "@/shared/productos/queries";
import type { FiltroCatalogo } from "@/shared/productos/types";
import { obtenerTransportistas } from "@/sales/transportistas/queries";
import { obtenerCotizacionPorId } from "@/sales/cotizaciones/queries";
import { asegurarContactoIncluido } from "@/sales/cotizaciones/actions";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { obtenerConfiguracionEmpresa } from "@/configuracion/empresa/queries";
import { isoDesdePais } from "@/shared/lib/pais-iso";
import { cotizacionADefaultValues } from "@/sales/cotizaciones/mapeo-entrega";

export default async function EditarCotizacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "cotizaciones", "modificar").permitido) redirect("/acceso-denegado");

  let cotizacion = null;
  let empresas: { id: string; nombre: string }[] = [];
  let contactos: Awaited<ReturnType<typeof buscarContactos>> = [];
  let productos: Awaited<ReturnType<typeof obtenerProductosCatalogo>> = [];
  let filtroCatalogoInicial: FiltroCatalogo = "TODOS";
  let transportistas: Awaited<ReturnType<typeof obtenerTransportistas>> = [];
  let defaultCountryCode = "PA";

  try {
    let config: Awaited<ReturnType<typeof obtenerConfiguracionEmpresa>> = null;
    [cotizacion, empresas, contactos, productos, transportistas, config] = await Promise.all([
      obtenerCotizacionPorId(id, sesion.instanciaId),
      buscarEmpresas("", sesion.instanciaId),
      buscarContactos("", sesion.instanciaId),
      obtenerProductosCatalogo(sesion.instanciaId),
      obtenerTransportistas(sesion.instanciaId),
      obtenerConfiguracionEmpresa(sesion.instanciaId),
    ]);
    defaultCountryCode = isoDesdePais(config?.pais);
    filtroCatalogoInicial = config?.filtroProductosPedido ?? "TODOS";
  } catch {
    // DB not configured
  }

  if (!cotizacion) notFound();
  // Solo se puede editar mientras la cotización siga en borrador (no enviada)
  if (cotizacion.estado !== "BORRADOR") redirect(`/sales/cotizaciones/${id}`);

  // Mismo mapeo que usa obtenerDatosEdicionCotizacionAction (el Sheet y el
  // panel del Workspace) — ver cotizacionADefaultValues: tenerlo duplicado ya
  // costó dos bugs en los que un campo faltaba de un lado y se borraba al
  // guardar.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const defaultValues = cotizacionADefaultValues(cotizacion as any);

  const opcionesEmpresas = empresas.map((e) => ({ valor: e.id, etiqueta: e.nombre }));

  // buscarContactos("", instanciaId) solo trae los primeros registros — si el
  // contacto ligado a esta cotización no cayó en ese lote, el combo lo
  // mostraría vacío aunque el dato exista. Se agrega si falta.
  const { contactosDetalle, contactos: opcionesContactos } = await asegurarContactoIncluido(
    cotizacion.contactoId ?? "",
    contactos,
    contactos.map((c) => ({ valor: c.id, etiqueta: `${c.nombre} ${c.apellido}` })),
    sesion.instanciaId,
  );

  return (
    <div className="min-h-[calc(100vh-56px)] flex flex-col max-w-5xl mx-auto w-full">
      <FormCotizacion
        empresas={opcionesEmpresas}
        contactos={opcionesContactos}
        contactosDetalle={contactosDetalle}
        productos={productos}
        filtroCatalogoInicial={filtroCatalogoInicial}
        transportistas={transportistas}
        cotizacionId={id}
        numero={cotizacion.numero}
        defaultValues={defaultValues}
        defaultCountryCode={defaultCountryCode}
      />
    </div>
  );
}
