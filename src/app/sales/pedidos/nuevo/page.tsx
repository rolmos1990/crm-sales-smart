import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { FormPedido } from "@/sales/pedidos/components/form-pedido";
import { buscarEmpresas } from "@/crm/empresas/queries";
import { buscarContactos } from "@/crm/contactos/queries";
import { obtenerProductosCatalogo } from "@/shared/productos/queries";
import { requireSesion } from "@/shared/auth/sesion";

export default async function NuevoPedidoPage() {
  const sesion = await requireSesion();
  let empresas: { id: string; nombre: string }[] = [];
  let contactos: any[] = [];
  let productos: Awaited<ReturnType<typeof obtenerProductosCatalogo>> = [];

  try {
    [empresas, contactos, productos] = await Promise.all([
      buscarEmpresas("", sesion.instanciaId),
      buscarContactos("", sesion.instanciaId),
      obtenerProductosCatalogo(sesion.instanciaId),
    ]);
  } catch {
    // DB not configured
  }

  const opcionesEmpresas = empresas.map((e) => ({ valor: e.id, etiqueta: e.nombre }));
  const opcionesContactos = contactos.map((c) => ({ valor: c.id, etiqueta: `${c.nombre} ${c.apellido}` }));

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <ButtonLink variant="ghost" size="icon-sm" href="/sales/pedidos"><ArrowLeft className="h-4 w-4" /></ButtonLink>
      </div>
      <PageHeader titulo="Nuevo pedido" descripcion="Crea un pedido con líneas de productos" />
      <FormPedido empresas={opcionesEmpresas} contactos={opcionesContactos} productos={productos} />
    </div>
  );
}
