import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { FormCotizacion } from "@/sales/cotizaciones/components/form-cotizacion";
import { buscarEmpresas } from "@/crm/empresas/queries";
import { buscarContactos } from "@/crm/contactos/queries";
import { obtenerProductosCatalogo } from "@/shared/productos/queries";
import { obtenerCotizacionPorId } from "@/sales/cotizaciones/queries";
import { requireSesion } from "@/shared/auth/sesion";
import type { CrearCotizacionInput } from "@/sales/cotizaciones/schema";

export default async function EditarCotizacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requireSesion();

  let cotizacion = null;
  let empresas: { id: string; nombre: string }[] = [];
  let contactos: { id: string; nombre: string; apellido: string }[] = [];
  let productos: Awaited<ReturnType<typeof obtenerProductosCatalogo>> = [];

  try {
    [cotizacion, empresas, contactos, productos] = await Promise.all([
      obtenerCotizacionPorId(id, sesion.instanciaId),
      buscarEmpresas("", sesion.instanciaId),
      buscarContactos("", sesion.instanciaId),
      obtenerProductosCatalogo(sesion.instanciaId),
    ]);
  } catch {
    // DB not configured
  }

  if (!cotizacion) notFound();

  const metadata = (cotizacion as any).metadata as Record<string, unknown> | null;
  const destinatarioGuardado = metadata?.destinatario as Record<string, string> | undefined;

  const lineasParaForm = ((cotizacion as any).lineas ?? []).map((l: any) => ({
    productoId: l.productoId ?? "",
    descripcion: l.descripcion ?? "",
    cantidad: Number(l.cantidad),
    precioUnitario: Number(l.precioUnitario),
    descuento: Number(l.descuento),
  }));

  const defaultValues: Partial<CrearCotizacionInput> = {
    moneda: cotizacion.moneda,
    notas: cotizacion.notas ?? "",
    contactoId: cotizacion.contactoId ?? "",
    empresaId: cotizacion.empresaId ?? "",
    fechaVencimiento: cotizacion.fechaVencimiento ? new Date(cotizacion.fechaVencimiento) : undefined,
    lineas: lineasParaForm.length > 0 ? lineasParaForm : [{ descripcion: "", productoId: "", cantidad: 1, precioUnitario: 0, descuento: 0 }],
    destinatario: {
      nombre: destinatarioGuardado?.nombre ?? "",
      apellido: destinatarioGuardado?.apellido ?? "",
      telefono: destinatarioGuardado?.telefono ?? "",
      email: destinatarioGuardado?.email ?? "",
    },
  };

  const opcionesEmpresas = empresas.map((e) => ({ valor: e.id, etiqueta: e.nombre }));
  const opcionesContactos = contactos.map((c) => ({ valor: c.id, etiqueta: `${c.nombre} ${c.apellido}` }));

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <ButtonLink variant="ghost" size="icon-sm" href={`/sales/cotizaciones/${id}`}><ArrowLeft className="h-4 w-4" /></ButtonLink>
      </div>
      <PageHeader titulo={`Editar ${cotizacion.numero}`} descripcion="Modifica los datos de la cotización" />
      <FormCotizacion
        empresas={opcionesEmpresas}
        contactos={opcionesContactos}
        productos={productos}
        cotizacionId={id}
        defaultValues={defaultValues}
      />
    </div>
  );
}
