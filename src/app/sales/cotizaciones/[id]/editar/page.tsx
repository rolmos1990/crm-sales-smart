import { notFound, redirect } from "next/navigation";
import { FormCotizacion } from "@/sales/cotizaciones/components/form-cotizacion";
import { buscarEmpresas } from "@/crm/empresas/queries";
import { buscarContactos } from "@/crm/contactos/queries";
import { obtenerProductosCatalogo } from "@/shared/productos/queries";
import { obtenerTransportistas } from "@/sales/transportistas/queries";
import { obtenerCotizacionPorId } from "@/sales/cotizaciones/queries";
import { asegurarContactoIncluido } from "@/sales/cotizaciones/actions";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { obtenerConfiguracionEmpresa } from "@/configuracion/empresa/queries";
import { isoDesdePais } from "@/shared/lib/pais-iso";
import type { CrearCotizacionInput } from "@/sales/cotizaciones/schema";

export default async function EditarCotizacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "cotizaciones", "modificar").permitido) redirect("/acceso-denegado");

  let cotizacion = null;
  let empresas: { id: string; nombre: string }[] = [];
  let contactos: Awaited<ReturnType<typeof buscarContactos>> = [];
  let productos: Awaited<ReturnType<typeof obtenerProductosCatalogo>> = [];
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
  } catch {
    // DB not configured
  }

  if (!cotizacion) notFound();
  // Solo se puede editar mientras la cotización siga en borrador (no enviada)
  if (cotizacion.estado !== "BORRADOR") redirect(`/sales/cotizaciones/${id}`);

  const metadata = (cotizacion as any).metadata as Record<string, unknown> | null;
  const destinatarioGuardado = metadata?.destinatario as Record<string, string> | undefined;

  const lineasParaForm = ((cotizacion as any).lineas ?? []).map((l: any) => ({
    productoId: l.productoId ?? "",
    descripcion: l.descripcion ?? "",
    cantidad: Number(l.cantidad),
    precioUnitario: Number(l.precioUnitario),
    descuento: Number(l.descuento),
    // Por línea, no por documento — ver EntregaDigitalCotizacion. Sin
    // `codigo` real: solo si ya hay uno configurado (tieneCodigoConfigurado,
    // via ocultarCodigo en queries.ts), nunca el valor.
    entregaDigital: l.entregaDigital ? {
      metodo: l.entregaDigital.metodo ?? undefined,
      email: l.entregaDigital.email ?? "",
      url: l.entregaDigital.url ?? "",
      archivo: l.entregaDigital.archivo ?? "",
      usuarioAcceso: l.entregaDigital.usuarioAcceso ?? "",
      fechaEntrega: l.entregaDigital.fechaEntrega ? new Date(l.entregaDigital.fechaEntrega) : undefined,
      fechaExpiracion: l.entregaDigital.fechaExpiracion ? new Date(l.entregaDigital.fechaExpiracion) : undefined,
      instrucciones: l.entregaDigital.instrucciones ?? "",
      observaciones: l.entregaDigital.observaciones ?? "",
      codigoAccion: l.entregaDigital.tieneCodigoConfigurado ? "CONSERVAR" as const : undefined,
      codigoNuevo: "",
    } : undefined,
  }));

  // El % de IGV no se guarda como tal — solo el monto ya calculado — así que
  // se recalcula desde subtotal/impuesto para no perder el valor original al
  // editar (si no se hiciera esto, el form caería siempre al 0% por defecto
  // de una cotización nueva, cambiando de hecho el impuesto sin que el
  // usuario lo haya tocado).
  const subtotalNum = Number(cotizacion.subtotal);
  const impuestoPorcentaje = subtotalNum > 0
    ? Math.round((Number(cotizacion.impuesto) / subtotalNum) * 1000) / 10
    : 0;

  const entregaGuardada = (cotizacion as any).entrega as {
    metodoEntrega: string; estadoEntrega: string; transportistaId: string | null;
    fechaEstimada: Date | string | null; observaciones: string | null;
  } | null;

  const defaultValues: Partial<CrearCotizacionInput> = {
    moneda: cotizacion.moneda,
    impuesto: impuestoPorcentaje,
    notas: cotizacion.notas ?? "",
    contactoId: cotizacion.contactoId ?? "",
    empresaId: cotizacion.empresaId ?? "",
    // Sin esto, el form cae al valor por defecto ("" — sin oportunidad) y
    // cualquier guardado borra el enlace de una cotización que sí nació
    // desde el Workspace de una oportunidad (ver FormCotizacion, que no
    // expone esto como campo editable — solo lo preserva).
    oportunidadId: cotizacion.oportunidadId ?? "",
    fechaVencimiento: cotizacion.fechaVencimiento ? new Date(cotizacion.fechaVencimiento) : undefined,
    lineas: lineasParaForm.length > 0 ? lineasParaForm : [{ descripcion: "", productoId: "", cantidad: 1, precioUnitario: 0, descuento: 0 }],
    destinatario: {
      nombre: destinatarioGuardado?.nombre ?? "",
      apellido: destinatarioGuardado?.apellido ?? "",
      telefono: destinatarioGuardado?.telefono ?? "",
      email: destinatarioGuardado?.email ?? "",
    },
    entrega: {
      metodoEntrega: entregaGuardada?.metodoEntrega ?? "COURIER_EXTERNO",
      estadoEntrega: entregaGuardada?.estadoEntrega ?? "PENDIENTE",
      transportistaId: entregaGuardada?.transportistaId ?? null,
      fechaEstimada: entregaGuardada?.fechaEstimada ? new Date(entregaGuardada.fechaEstimada) : undefined,
      observaciones: entregaGuardada?.observaciones ?? "",
      // Vive en Cotizacion.costoEnvio (no en EntregaCotizacion) — ver schema.ts.
      costoEnvio: Number((cotizacion as any).costoEnvio ?? 0),
    } as CrearCotizacionInput["entrega"],
  };

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
        transportistas={transportistas}
        cotizacionId={id}
        numero={cotizacion.numero}
        defaultValues={defaultValues}
        defaultCountryCode={defaultCountryCode}
      />
    </div>
  );
}
