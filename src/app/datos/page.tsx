import { requireSesion } from "@/shared/auth/sesion";
import { PageHeader } from "@/shared/ui/page-header";
import { WizardImportacion } from "@/crm/datos/components/wizard-importacion";
import { obtenerCamposPersonalizadosPorEntidad } from "@/crm/datos/queries";

export const dynamic = "force-dynamic";

export default async function DatosPage() {
  const sesion = await requireSesion();

  let camposPersonalizados: Awaited<
    ReturnType<typeof obtenerCamposPersonalizadosPorEntidad>
  > = [];

  try {
    camposPersonalizados = await obtenerCamposPersonalizadosPorEntidad(
      sesion.instanciaId,
      "CONTACTO",
    );
  } catch {
    // Continuar sin campos personalizados si hay error de DB
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        titulo="Importar datos"
        descripcion="Importa información a tu CRM de manera rápida y segura."
      />
      <WizardImportacion camposPersonalizados={camposPersonalizados} />
    </div>
  );
}
