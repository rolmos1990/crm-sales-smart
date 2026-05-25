import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormContacto } from "@/crm/contactos/components/form-contacto";
import { buscarEmpresas } from "@/crm/empresas/queries";

export default async function NuevoContactoPage() {
  let empresas: { valor: string; etiqueta: string }[] = [];
  try {
    const datos = await buscarEmpresas("");
    empresas = datos.map(e => ({ valor: e.id, etiqueta: e.nombre }));
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
          <FormContacto empresas={empresas} />
        </CardContent>
      </Card>
    </div>
  );
}
