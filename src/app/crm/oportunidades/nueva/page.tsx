import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormOportunidad } from "@/crm/oportunidades/components/form-oportunidad";
import { buscarEmpresas } from "@/crm/empresas/queries";
import { buscarContactos } from "@/crm/contactos/queries";

export default async function NuevaOportunidadPage() {
  let empresas: { valor: string; etiqueta: string }[] = [];
  let contactos: { valor: string; etiqueta: string }[] = [];
  try {
    const [e, c] = await Promise.all([buscarEmpresas(""), buscarContactos("")]);
    empresas = e.map(x => ({ valor: x.id, etiqueta: x.nombre }));
    contactos = c.map(x => ({ valor: x.id, etiqueta: `${x.nombre} ${x.apellido}` }));
  } catch {
    // DB no configurada
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Nueva oportunidad</h1>
        <p className="text-muted-foreground text-sm mt-1">Registra una nueva oportunidad de venta</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la oportunidad</CardTitle>
        </CardHeader>
        <CardContent>
          <FormOportunidad empresas={empresas} contactos={contactos} />
        </CardContent>
      </Card>
    </div>
  );
}
