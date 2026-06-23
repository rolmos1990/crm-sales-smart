import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormActividad } from "@/crm/actividades/components/form-actividad";
import { buscarContactos } from "@/crm/contactos/queries";
import { buscarEmpresas } from "@/crm/empresas/queries";
import { obtenerOportunidades } from "@/crm/oportunidades/queries";
import { obtenerPedidos } from "@/sales/pedidos/queries";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { redirect } from "next/navigation";
import { prisma } from "@/shared/db/prisma";

export default async function NuevaActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ contactoId?: string; empresaId?: string; oportunidadId?: string; pedidoId?: string; cotizacionId?: string }>;
}) {
  const params = await searchParams;

  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "actividades", "modificar").permitido) redirect("/acceso-denegado");

  let contactos: { valor: string; etiqueta: string }[] = [];
  let empresas: { valor: string; etiqueta: string }[] = [];
  let oportunidades: { valor: string; etiqueta: string }[] = [];
  let pedidos: { valor: string; etiqueta: string }[] = [];
  let cotizaciones: { valor: string; etiqueta: string }[] = [];

  try {
    const [c, e, o, p, cot] = await Promise.all([
      buscarContactos("", sesion.instanciaId),
      buscarEmpresas("", sesion.instanciaId),
      obtenerOportunidades(sesion.instanciaId),
      obtenerPedidos(sesion.instanciaId),
      prisma.cotizacion.findMany({ where: { instanciaId: sesion.instanciaId }, select: { id: true, numero: true }, orderBy: { creadoEn: "desc" }, take: 100 }),
    ]);
    contactos = c.map((x: { id: string; nombre: string; apellido: string }) => ({ valor: x.id, etiqueta: `${x.nombre} ${x.apellido}` }));
    empresas = e.map((x: { id: string; nombre: string }) => ({ valor: x.id, etiqueta: x.nombre }));
    oportunidades = o.map((x: { id: string; titulo: string }) => ({ valor: x.id, etiqueta: x.titulo }));
    pedidos = p.map((x: { id: string; numero: string }) => ({ valor: x.id, etiqueta: x.numero }));
    cotizaciones = cot.map(x => ({ valor: x.id, etiqueta: x.numero }));
  } catch {
    // DB no configurada
  }

  return (
    <div className="max-w-3xl mx-auto">
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
            pedidos={pedidos}
            cotizaciones={cotizaciones}
            preseleccion={{
              contactoId: params.contactoId,
              empresaId: params.empresaId,
              oportunidadId: params.oportunidadId,
              pedidoId: params.pedidoId,
              cotizacionId: params.cotizacionId,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
