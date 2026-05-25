import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Pencil, Globe, Phone, Mail, Building2, Calendar, Plus, Users, TrendingUp } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TimelineActividades } from "@/crm/actividades/components/timeline-actividades";
import { obtenerEmpresaPorId } from "@/crm/empresas/queries";
import { obtenerActividadesPorEmpresa } from "@/crm/actividades/queries";
import type { Actividad } from "@/crm/actividades/types";
import { cn } from "@/lib/utils";

const ETAPA_COLOR: Record<string, string> = {
  PROSPECTO: "bg-slate-100 text-slate-700",
  CALIFICADO: "bg-blue-100 text-blue-700",
  PROPUESTA: "bg-violet-100 text-violet-700",
  NEGOCIACION: "bg-amber-100 text-amber-700",
  GANADO: "bg-green-100 text-green-700",
  PERDIDO: "bg-red-100 text-red-700",
};

export default async function EmpresaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let empresa = null;
  let actividades: Actividad[] = [];

  try {
    [empresa, actividades] = await Promise.all([
      obtenerEmpresaPorId(id),
      obtenerActividadesPorEmpresa(id),
    ]);
  } catch {
    // DB not configured
  }

  if (!empresa && process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("placeholder")) {
    notFound();
  }

  if (!empresa) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <ButtonLink variant="ghost" size="icon-sm" href="/crm/empresas"><ArrowLeft className="h-4 w-4" /></ButtonLink>
        <p className="text-muted-foreground">Empresa no disponible</p>
      </div>
    );
  }

  const contactos = (empresa as any).contactos ?? [];
  const oportunidades = (empresa as any).oportunidades ?? [];
  const valorPipeline = oportunidades
    .filter((o: any) => !["GANADO", "PERDIDO"].includes(o.etapa))
    .reduce((acc: number, o: any) => acc + Number(o.valor), 0);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <ButtonLink variant="ghost" size="icon-sm" href="/crm/empresas"><ArrowLeft className="h-4 w-4" /></ButtonLink>
        <span className="text-muted-foreground text-sm">Empresas</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{empresa.nombre}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {empresa.industria && <Badge variant="secondary">{empresa.industria}</Badge>}
            {empresa.tamano && <Badge variant="outline">{empresa.tamano}</Badge>}
          </div>
        </div>
        <ButtonLink href={`/crm/empresas/${id}/editar`}>
            <Pencil className="h-4 w-4" />Editar
          </ButtonLink>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{contactos.length}</p>
                <p className="text-xs text-muted-foreground">Contactos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{oportunidades.length}</p>
                <p className="text-xs text-muted-foreground">Oportunidades</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2">
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold">S/ {valorPipeline.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground">Valor en pipeline</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="contactos">Contactos ({contactos.length})</TabsTrigger>
          <TabsTrigger value="oportunidades">Oportunidades ({oportunidades.length})</TabsTrigger>
          <TabsTrigger value="actividades">Actividades ({actividades.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              {empresa.sitioWeb && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <a href={empresa.sitioWeb} target="_blank" rel="noopener noreferrer" className="hover:underline text-primary">{empresa.sitioWeb}</a>
                </div>
              )}
              {empresa.telefono && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${empresa.telefono}`} className="hover:underline">{empresa.telefono}</a>
                </div>
              )}
              {empresa.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${empresa.email}`} className="hover:underline">{empresa.email}</a>
                </div>
              )}
              {empresa.ruc && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>RUC: {empresa.ruc}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Creada {format(new Date(empresa.creadoEn), "dd MMM yyyy", { locale: es })}</span>
              </div>
              {empresa.notas && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Notas</p>
                  <p className="text-sm whitespace-pre-wrap">{empresa.notas}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contactos" className="mt-4">
          <div className="flex justify-end mb-3">
            <ButtonLink size="sm" href={`/crm/contactos/nuevo?empresaId=${id}`}>
                <Plus className="h-4 w-4" />Nuevo contacto
              </ButtonLink>
          </div>
          <div className="space-y-2">
            {contactos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin contactos vinculados.</p>
            ) : (
              contactos.map((c: any) => (
                <Link key={c.id} href={`/crm/contactos/${c.id}`}>
                  <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardContent className="flex items-center justify-between py-3 px-4">
                      <div>
                        <p className="text-sm font-medium">{c.nombre} {c.apellido}</p>
                        {c.cargo && <p className="text-xs text-muted-foreground">{c.cargo}</p>}
                      </div>
                      {c.email && <span className="text-xs text-muted-foreground">{c.email}</span>}
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="oportunidades" className="mt-4">
          <div className="flex justify-end mb-3">
            <ButtonLink size="sm" href={`/crm/oportunidades/nueva?empresaId=${id}`}>
                <Plus className="h-4 w-4" />Nueva oportunidad
              </ButtonLink>
          </div>
          <div className="space-y-2">
            {oportunidades.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin oportunidades vinculadas.</p>
            ) : (
              oportunidades.map((o: any) => (
                <Link key={o.id} href={`/crm/oportunidades/${o.id}`}>
                  <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardContent className="flex items-center justify-between py-3 px-4">
                      <span className="text-sm font-medium">{o.titulo}</span>
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-xs", ETAPA_COLOR[o.etapa])}>
                          {o.etapa.charAt(0) + o.etapa.slice(1).toLowerCase()}
                        </Badge>
                        <span className="text-sm">S/ {Number(o.valor).toLocaleString("es-PE")}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="actividades" className="mt-4">
          <div className="flex justify-end mb-4">
            <ButtonLink size="sm" href={`/crm/actividades/nueva?empresaId=${id}`}>
                <Plus className="h-4 w-4" />Nueva actividad
              </ButtonLink>
          </div>
          <TimelineActividades actividades={actividades} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
