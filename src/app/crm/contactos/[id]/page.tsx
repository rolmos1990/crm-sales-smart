import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Pencil, Phone, Mail, Building2, Briefcase, Calendar, Plus } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/shared/ui/page-header";
import { TimelineActividades } from "@/crm/actividades/components/timeline-actividades";
import { obtenerContactoPorId } from "@/crm/contactos/queries";
import { obtenerActividadesPorContacto } from "@/crm/actividades/queries";
import type { Actividad } from "@/crm/actividades/types";
import { cn } from "@/lib/utils";

const ESTADO_CONFIG = {
  ACTIVO: { etiqueta: "Activo", clase: "bg-green-100 text-green-700" },
  INACTIVO: { etiqueta: "Inactivo", clase: "bg-slate-100 text-slate-600" },
  LEAD: { etiqueta: "Lead", clase: "bg-blue-100 text-blue-700" },
} as const;

const ETAPA_COLOR: Record<string, string> = {
  PROSPECTO: "bg-slate-100 text-slate-700",
  CALIFICADO: "bg-blue-100 text-blue-700",
  PROPUESTA: "bg-violet-100 text-violet-700",
  NEGOCIACION: "bg-amber-100 text-amber-700",
  GANADO: "bg-green-100 text-green-700",
  PERDIDO: "bg-red-100 text-red-700",
};

export default async function ContactoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let contacto = null;
  let actividades: Actividad[] = [];

  try {
    [contacto, actividades] = await Promise.all([
      obtenerContactoPorId(id),
      obtenerActividadesPorContacto(id),
    ]);
  } catch {
    // DB not configured — show empty state
  }

  if (!contacto && process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("placeholder")) {
    notFound();
  }

  if (!contacto) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-2">
          <ButtonLink variant="ghost" size="icon-sm" href="/crm/contactos"><ArrowLeft className="h-4 w-4" /></ButtonLink>
          <span className="text-muted-foreground text-sm">Contacto no disponible</span>
        </div>
      </div>
    );
  }

  const estadoConf = ESTADO_CONFIG[contacto.estado] ?? ESTADO_CONFIG.ACTIVO;
  const iniciales = `${contacto.nombre[0]}${contacto.apellido[0]}`.toUpperCase();

  const oportunidades = (contacto as any).oportunidades ?? [];

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <ButtonLink variant="ghost" size="icon-sm" href="/crm/contactos"><ArrowLeft className="h-4 w-4" /></ButtonLink>
        <span className="text-muted-foreground text-sm">Contactos</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg font-semibold">
            {iniciales}
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{contacto.nombre} {contacto.apellido}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={cn("text-xs", estadoConf.clase)}>{estadoConf.etiqueta}</Badge>
              {contacto.cargo && <span className="text-sm text-muted-foreground">{contacto.cargo}</span>}
              {contacto.empresa && (
                <Link href={`/crm/empresas/${contacto.empresa.id}`} className="text-sm text-primary hover:underline flex items-center gap-1">
                  <Building2 className="h-3 w-3" />{contacto.empresa.nombre}
                </Link>
              )}
            </div>
          </div>
        </div>
        <ButtonLink href={`/crm/contactos/${id}/editar`}>
            <Pencil className="h-4 w-4" />Editar
          </ButtonLink>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="oportunidades">Oportunidades ({oportunidades.length})</TabsTrigger>
          <TabsTrigger value="actividades">Actividades ({actividades.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Datos de contacto</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {contacto.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${contacto.email}`} className="hover:underline">{contacto.email}</a>
                  </div>
                )}
                {contacto.telefono && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${contacto.telefono}`} className="hover:underline">{contacto.telefono}</a>
                  </div>
                )}
                {contacto.cargo && (
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span>{contacto.cargo}</span>
                  </div>
                )}
                {contacto.empresa && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <Link href={`/crm/empresas/${contacto.empresa.id}`} className="hover:underline text-primary">
                      {contacto.empresa.nombre}
                    </Link>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Creado {format(new Date(contacto.creadoEn), "dd MMM yyyy", { locale: es })}</span>
                </div>
              </CardContent>
            </Card>

            {contacto.notas && (
              <Card>
                <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Notas</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{contacto.notas}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="oportunidades" className="mt-4">
          <div className="space-y-3">
            {oportunidades.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No hay oportunidades vinculadas.</p>
            ) : (
              oportunidades.map((rel: any) => (
                <Link key={rel.oportunidad.id} href={`/crm/oportunidades/${rel.oportunidad.id}`}>
                  <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardContent className="flex items-center justify-between py-3 px-4">
                      <span className="text-sm font-medium">{rel.oportunidad.titulo}</span>
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-xs", ETAPA_COLOR[rel.oportunidad.etapa])}>
                          {rel.oportunidad.etapa.charAt(0) + rel.oportunidad.etapa.slice(1).toLowerCase()}
                        </Badge>
                        <span className="text-sm font-medium">
                          S/ {Number(rel.oportunidad.valor).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                        </span>
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
            <ButtonLink size="sm" href={`/crm/actividades/nueva?contactoId=${id}`}>
                <Plus className="h-4 w-4" />Nueva actividad
              </ButtonLink>
          </div>
          <TimelineActividades actividades={actividades} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
