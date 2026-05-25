import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormActividad } from "@/crm/actividades/components/form-actividad";
import { buscarContactos } from "@/crm/contactos/queries";
import { buscarEmpresas } from "@/crm/empresas/queries";
import { obtenerOportunidades } from "@/crm/oportunidades/queries";

export default async function NuevaActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ contactoId?: string; empresaId?: string; oportunidadId?: string }>;
}) {
  const params = await searchParams;
  let contactos: { valor: string; etiqueta: string }[] = [];
  let empresas: { valor: string; etiqueta: string }[] = [];
  let oportunidades: { valor: string; etiqueta: string }[] = [];

  try {
    const [c, e, o] = await Promise.all([
      buscarContactos(""),
      buscarEmpresas(""),
      obtenerOportunidades(),
    ]);
    contactos = c.map(x => ({ valor: x.id, etiqueta: `${x.nombre} ${x.apellido}` }));
    empresas = e.map(x => ({ valor: x.id, etiqueta: x.nombre }));
    oportunidades = o.map(x => ({ valor: x.id, etiqueta: x.titulo }));
  } catch {
    // DB no configurada
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Nueva actividad</h1>
        <p className="text-muted-foreground text-sm mt-1">Registra una nueva actividad o tarea</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la actividad</CardTitle>
        </CardHeader>
        <CardContent>
          <FormActividad
            contactos={contactos}
            empresas={empresas}
            oportunidades={oportunidades}
            preseleccion={{
              contactoId: params.contactoId,
              empresaId: params.empresaId,
              oportunidadId: params.oportunidadId,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
