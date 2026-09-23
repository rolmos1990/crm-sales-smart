import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/shared/ui/page-header";
import { FormProducto } from "@/shared/productos/components/form-producto";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { obtenerMonedaPrincipal } from "@/configuracion/empresa/queries";
import { obtenerProductosParaComponentes } from "@/shared/productos/queries";

export default async function NuevoProductoPage() {
  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "productos", "modificar").permitido) redirect("/acceso-denegado");
  const [monedaDefault, productosComponentes] = await Promise.all([
    obtenerMonedaPrincipal(sesion.instanciaId),
    obtenerProductosParaComponentes(sesion.instanciaId).catch(() => []),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <ButtonLink variant="ghost" size="icon-sm" href="/productos"><ArrowLeft className="h-4 w-4" /></ButtonLink>
      </div>
      <PageHeader titulo="Nuevo producto" descripcion="Agrega un producto o servicio al catálogo" />
      <FormProducto instanciaId={sesion.instanciaId} monedaDefault={monedaDefault} productosComponentes={productosComponentes} />
    </div>
  );
}
