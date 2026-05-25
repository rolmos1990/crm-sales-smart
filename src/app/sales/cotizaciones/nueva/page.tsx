import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { FormCotizacion } from "@/sales/cotizaciones/components/form-cotizacion";
import { buscarEmpresas } from "@/crm/empresas/queries";
import { buscarContactos } from "@/crm/contactos/queries";
import { obtenerProductosCatalogo } from "@/shared/productos/queries";

export default async function NuevaCotizacionPage() {
  let empresas: { id: string; nombre: string }[] = [];
  let contactos: any[] = [];

  try {
    [empresas, contactos] = await Promise.all([buscarEmpresas(""), buscarContactos("")]);
  } catch {
    // DB not configured
  }

  const opcionesEmpresas = empresas.map((e) => ({ valor: e.id, etiqueta: e.nombre }));
  const opcionesContactos = contactos.map((c) => ({ valor: c.id, etiqueta: `${c.nombre} ${c.apellido}` }));
  const productos = await obtenerProductosCatalogo();

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <ButtonLink variant="ghost" size="icon-sm" href="/sales/cotizaciones"><ArrowLeft className="h-4 w-4" /></ButtonLink>
      </div>
      <PageHeader titulo="Nueva cotización" descripcion="Crea una cotización con líneas de productos" />
      <FormCotizacion empresas={opcionesEmpresas} contactos={opcionesContactos} productos={productos} />
    </div>
  );
}
