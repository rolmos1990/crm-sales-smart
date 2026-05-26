import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Pencil, Building2, Calendar, TrendingUp, Plus, Target } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { TimelineActividades } from "@/crm/actividades/components/timeline-actividades";
import { obtenerOportunidadPorId } from "@/crm/oportunidades/queries";
import { obtenerActividadesPorOportunidad } from "@/crm/actividades/queries";
import { ETAPAS_PIPELINE } from "@/crm/oportunidades/types";
import type { Actividad } from "@/crm/actividades/types";
import { cn } from "@/lib/utils";

export default async function OportunidadDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let oportunidad = null;
  let actividades: Actividad[] = [];

  try {
    [oportunidad, actividades] = await Promise.all([
      obtenerOportunidadPorId(id),
      obtenerActividadesPorOportunidad(id),
    ]);
  } catch {
    // DB not configured
  }

  if (!oportunidad && process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("placeholder")) {
    notFound();
  }

  if (!oportunidad) {
    return (
      <div className="p-6">
        <ButtonLink variant="ghost" size="icon-sm" href="/crm/oportunidades"><ArrowLeft className="h-4 w-4" /></ButtonLink>
        <p className="text-muted-foreground mt-4">Oportunidad no disponible</p>
      </div>
    );
  }

  const etapaConf = ETAPAS_PIPELINE.find((e) => e.valor === oportunidad.etapa);
  const productos = (oportunidad as any).productos ?? [];
  const contactos = (oportunidad as any).contactos ?? [];
  const tags = (oportunidad as any).tags ?? [];
  const valor = Number(oportunidad.valor);

  const diasHastacierre = oportunidad.fechaCierre
    ? Math.ceil((new Date(oportunidad.fechaCierre).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <ButtonLink variant="ghost" size="icon-sm" href="/crm/oportunidades"><ArrowLeft className="h-4 w-4" /></ButtonLink>
        <span className="text-muted-foreground text-sm">Oportunidades</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{oportunidad.titulo}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {etapaConf && (
              <Badge className={cn("text-xs", etapaConf.color)}>{etapaConf.etiqueta}</Badge>
            )}
            {oportunidad.empresa && (
              <Link href={`/crm/empresas/${oportunidad.empresa.id}`} className="text-sm text-primary hover:underline flex items-center gap-1">
                <Building2 className="h-3 w-3" />{oportunidad.empresa.nombre}
              </Link>
            )}
          </div>
        </div>
        <ButtonLink href={`/crm/oportunidades/${id}/editar`}>
            <Pencil className="h-4 w-4" />Editar
          </ButtonLink>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Valor</p>
            <p className="text-xl font-bold mt-0.5">
              {oportunidad.moneda} {valor.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Probabilidad</p>
            <p className="text-xl font-bold mt-0.5">{oportunidad.probabilidad}%</p>
            <Progress value={oportunidad.probabilidad} className="h-1 mt-1" />
          </CardContent>
        </Card>
        {oportunidad.fechaCierre && (
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Cierre estimado</p>
              <p className="text-sm font-medium mt-0.5">
                {format(new Date(oportunidad.fechaCierre), "dd MMM yyyy", { locale: es })}
              </p>
              {diasHastacierre !== null && (
                <p className={cn("text-xs mt-0.5", diasHastacierre < 0 ? "text-destructive" : diasHastacierre < 7 ? "text-amber-600" : "text-muted-foreground")}>
                  {diasHastacierre < 0 ? `Venció hace ${Math.abs(diasHastacierre)} días` : `En ${diasHastacierre} días`}
                </p>
              )}
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Productos</p>
            <p className="text-xl font-bold mt-0.5">{productos.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="productos">Productos ({productos.length})</TabsTrigger>
          <TabsTrigger value="actividades">Actividades ({actividades.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4 space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              {tags.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Etiquetas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((rel: any) => (
                      <span
                        key={rel.tagId}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={
                          rel.tag?.color
                            ? { backgroundColor: `${rel.tag.color}22`, color: rel.tag.color, border: `1px solid ${rel.tag.color}44` }
                            : undefined
                        }
                      >
                        {rel.tag?.color && (
                          <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: rel.tag.color }} />
                        )}
                        {rel.tag?.nombre}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {contactos.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Contactos</p>
                  <div className="flex flex-wrap gap-2">
                    {contactos.map((rel: any) => (
                      <Link key={rel.contacto.id} href={`/crm/contactos/${rel.contacto.id}`}>
                        <Badge variant="outline" className="hover:bg-muted cursor-pointer">
                          {rel.contacto.nombre} {rel.contacto.apellido}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Creada {format(new Date(oportunidad.creadoEn), "dd MMM yyyy", { locale: es })}</span>
              </div>
              {oportunidad.notas && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Notas</p>
                  <p className="text-sm whitespace-pre-wrap">{oportunidad.notas}</p>
                </div>
              )}
              {oportunidad.motivoPerdida && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Motivo de pérdida</p>
                  <p className="text-sm text-destructive">{oportunidad.motivoPerdida}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="productos" className="mt-4">
          {productos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sin productos vinculados.</p>
          ) : (
            <Card>
              <CardContent className="pt-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Producto</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground">Cant.</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground">Precio</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground">Desc.</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productos.map((p: any) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2 px-2">{p.producto?.nombre ?? "—"}</td>
                        <td className="py-2 px-2 text-right">{Number(p.cantidad)}</td>
                        <td className="py-2 px-2 text-right">S/ {Number(p.precioUnitario).toLocaleString("es-PE", { minimumFractionDigits: 2 })}</td>
                        <td className="py-2 px-2 text-right">{Number(p.descuento)}%</td>
                        <td className="py-2 px-2 text-right font-medium">
                          S/ {(Number(p.cantidad) * Number(p.precioUnitario) * (1 - Number(p.descuento) / 100)).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="actividades" className="mt-4">
          <div className="flex justify-end mb-4">
            <ButtonLink size="sm" href={`/crm/actividades/nueva?oportunidadId=${id}`}>
                <Plus className="h-4 w-4" />Nueva actividad
              </ButtonLink>
          </div>
          <TimelineActividades actividades={actividades} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
