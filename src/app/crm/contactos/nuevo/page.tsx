import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormContacto } from "@/crm/contactos/components/form-contacto";
import { buscarEmpresas } from "@/crm/empresas/queries";
import { obtenerTags } from "@/crm/tags/queries";
import { obtenerOCrearInstancia } from "@/shared/db/instancia";
import { obtenerConfiguracionEmpresa } from "@/configuracion/empresa/queries";

const PAIS_A_ISO: Record<string, string> = {
  "Panamá": "PA", "Perú": "PE", "Colombia": "CO", "México": "MX",
  "Argentina": "AR", "Chile": "CL", "Ecuador": "EC", "Bolivia": "BO",
  "Venezuela": "VE", "Paraguay": "PY", "Uruguay": "UY",
  "Costa Rica": "CR", "Guatemala": "GT",
};

export default async function NuevoContactoPage() {
  let empresas: { valor: string; etiqueta: string }[] = [];
  let tags: Awaited<ReturnType<typeof obtenerTags>> = [];
  let defaultCountryCode = "PA";

  try {
    const instancia = await obtenerOCrearInstancia();
    const [datos, t, config] = await Promise.all([
      buscarEmpresas(""),
      obtenerTags(),
      obtenerConfiguracionEmpresa(instancia.id),
    ]);
    empresas = datos.map(e => ({ valor: e.id, etiqueta: e.nombre }));
    tags = t;
    if (config?.pais) defaultCountryCode = PAIS_A_ISO[config.pais] ?? "PA";
  } catch {
    // DB no configurada
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo contacto</h1>
        <p className="text-muted-foreground text-sm mt-1">Completa los datos del nuevo contacto</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información del contacto</CardTitle>
        </CardHeader>
        <CardContent>
          <FormContacto empresas={empresas} tags={tags} defaultCountryCode={defaultCountryCode} />
        </CardContent>
      </Card>
    </div>
  );
}
