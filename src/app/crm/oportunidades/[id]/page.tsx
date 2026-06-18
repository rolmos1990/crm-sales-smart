"use server";

import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft, Pencil, Building2, Calendar, Plus,
  Phone, Mail, User, Globe, FileText, Hash,
  Briefcase, ExternalLink, FileCheck,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { TimelineActividades } from "@/crm/actividades/components/timeline-actividades";
import { obtenerOportunidadPorId } from "@/crm/oportunidades/queries";
import { obtenerActividadesPorOportunidad } from "@/crm/actividades/queries";
import { obtenerTags } from "@/crm/tags/queries";
import { GestorTagsInline } from "@/crm/tags/components/gestor-tags-inline";
import { ETAPAS_PIPELINE } from "@/crm/oportunidades/types";
import { obtenerConversacionesPorOportunidad, obtenerCuentasCanal } from "@/conversaciones/queries";
import { obtenerCotizacionesPorOportunidad } from "@/sales/cotizaciones/queries";
import { ESTADO_COTIZACION_CONFIG } from "@/sales/cotizaciones/types";
import { requireSesion } from "@/shared/auth/sesion";
import { puedeModificar } from "@/shared/auth/permisos";
import { PanelConversacion } from "@/conversaciones/components/panel-conversacion";
import type { Actividad } from "@/crm/actividades/types";
import type { Tag } from "@/crm/tags/types";
import { cn } from "@/lib/utils";

export default async function OportunidadDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let oportunidad = null;
  let actividades: Actividad[] = [];
  let todosLosTags: Tag[] = [];
  const sesion = await requireSesion();
  const puedeMod = puedeModificar(sesion.rol, "oportunidades");
  let conversaciones: Awaited<ReturnType<typeof obtenerConversacionesPorOportunidad>> = [];
  let cuentasCanal: Awaited<ReturnType<typeof obtenerCuentasCanal>> = [];
  let cotizaciones: Awaited<ReturnType<typeof obtenerCotizacionesPorOportunidad>> = [];

  try {
    [oportunidad, actividades, todosLosTags, cotizaciones] = await Promise.all([
      obtenerOportunidadPorId(id, sesion.instanciaId),
      obtenerActividadesPorOportunidad(id, sesion.instanciaId),
      obtenerTags(sesion.instanciaId),
      obtenerCotizacionesPorOportunidad(id, sesion.instanciaId),
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

  // Cargar datos de conversaciones (no bloquea si falla)
  try {
    [conversaciones, cuentasCanal] = await Promise.all([
      obtenerConversacionesPorOportunidad(id, sesion.instanciaId),
      obtenerCuentasCanal(sesion.instanciaId),
    ]);
  } catch {
    // Conversaciones aún no disponibles
  }

  const etapaConf = ETAPAS_PIPELINE.find((e) => e.valor === oportunidad.etapa);
  const productos = (oportunidad as any).productos ?? [];
  const contactos = (oportunidad as any).contactos ?? [];
  const campos = (oportunidad as any).campos ?? [];
  const tagIdsActuales: string[] = ((oportunidad as any).tags ?? []).map((r: any) => r.tagId);
  const valor = Number(oportunidad.valor);
  const empresa = (oportunidad as any).empresa ?? null;

  const contactoPrincipal = contactos.find((r: any) => r.principal)?.contacto ?? contactos[0]?.contacto ?? null;

  const diasHastaCierre = oportunidad.fechaCierre
    ? Math.ceil((new Date(oportunidad.fechaCierre).getTime() - Date.now()) / 86400000)
    : null;

  const formatearValorCampo = (campo: any) => {
    if (campo.valor === null || campo.valor === undefined) return "—";
    const tipo = campo.campo?.tipo;
    if (tipo === "BOOLEANO") return campo.valor ? "Sí" : "No";
    if (tipo === "FECHA") {
      try { return format(new Date(campo.valor as string), "dd MMM yyyy", { locale: es }); } catch { return String(campo.valor); }
    }
    if (tipo === "MULTISELECT" && Array.isArray(campo.valor)) return campo.valor.join(", ");
    return String(campo.valor);
  };

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* ── Panel Chat (izquierda, ancho fijo) ─────────────────── */}
      <div className="w-[360px] shrink-0 flex flex-col">
        <PanelConversacion
          oportunidadId={id}
          contactoId={contactoPrincipal?.id ?? ""}
          nombreContacto={contactoPrincipal ? `${contactoPrincipal.nombre} ${contactoPrincipal.apellido}`.trim() : "Sin contacto"}
          cuentas={cuentasCanal}
          conversacionesIniciales={conversaciones}
          puedeMod={puedeMod}
        />
      </div>

      {/* ── Detalle Oportunidad (derecha, scrollable) ─────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2">
            <ButtonLink variant="ghost" size="icon-sm" href="/crm/oportunidades"><ArrowLeft className="h-4 w-4" /></ButtonLink>
            <span className="text-muted-foreground text-sm">Oportunidades</span>
          </div>

          {/* Header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold">{oportunidad.titulo}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {etapaConf && (
                  <Badge className={cn("text-xs", etapaConf.color)}>{etapaConf.etiqueta}</Badge>
                )}
                {empresa && (
                  <Link href={`/crm/empresas/${empresa.id}`} className="text-sm text-primary hover:underline flex items-center gap-1">
                    <Building2 className="h-3 w-3" />{empresa.nombre}
                  </Link>
                )}
              </div>
            </div>
            {puedeMod && (
              <ButtonLink href={`/crm/oportunidades/${id}/editar`}>
                <Pencil className="h-4 w-4" />Editar
              </ButtonLink>
            )}
          </div>

          {/* KPI cards */}
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
                  {diasHastaCierre !== null && (
                    <p className={cn("text-xs mt-0.5", diasHastaCierre < 0 ? "text-destructive" : diasHastaCierre < 7 ? "text-amber-600" : "text-muted-foreground")}>
                      {diasHastaCierre < 0 ? `Venció hace ${Math.abs(diasHastaCierre)} días` : `En ${diasHastaCierre} días`}
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
              <TabsTrigger value="cotizaciones">Cotizaciones ({cotizaciones.length})</TabsTrigger>
            </TabsList>

            {/* ── Tab Información ───────────────────────────────── */}
            <TabsContent value="info" className="mt-4 space-y-4">

              {/* Etiquetas + fecha creación */}
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Etiquetas</p>
                    <GestorTagsInline
                      entidadId={id}
                      tipo="oportunidad"
                      tagIdsActuales={tagIdsActuales}
                      todosLosTags={todosLosTags}
                      puedeMod={puedeMod}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Creada {format(new Date(oportunidad.creadoEn), "dd MMM yyyy", { locale: es })}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Notas */}
              {oportunidad.notas && (
                <Card>
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      Notas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <p className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">{oportunidad.notas}</p>
                  </CardContent>
                </Card>
              )}

              {/* Motivo de pérdida */}
              {oportunidad.motivoPerdida && (
                <Card className="border-destructive/30 bg-destructive/5">
                  <CardContent className="pt-4 pb-4">
                    <p className="text-xs font-medium text-destructive mb-1">Motivo de pérdida</p>
                    <p className="text-sm text-destructive/80">{oportunidad.motivoPerdida}</p>
                  </CardContent>
                </Card>
              )}

              {/* Empresa */}
              {empresa && (
                <Card>
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      Empresa
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4 space-y-2">
                    <Link
                      href={`/crm/empresas/${empresa.id}`}
                      className="text-base font-semibold hover:underline text-primary flex items-center gap-1.5"
                    >
                      {empresa.nombre}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-2">
                      {empresa.industria && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Briefcase className="h-3.5 w-3.5 shrink-0" />
                          <span>{empresa.industria}</span>
                        </div>
                      )}
                      {empresa.ruc && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Hash className="h-3.5 w-3.5 shrink-0" />
                          <span>RUC: {empresa.ruc}</span>
                        </div>
                      )}
                      {empresa.telefono && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <a href={`tel:${empresa.telefono}`} className="hover:underline text-primary">{empresa.telefono}</a>
                        </div>
                      )}
                      {empresa.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <a href={`mailto:${empresa.email}`} className="hover:underline text-primary truncate">{empresa.email}</a>
                        </div>
                      )}
                      {empresa.sitioWeb && (
                        <div className="flex items-center gap-2 text-sm">
                          <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <a href={empresa.sitioWeb} target="_blank" rel="noopener noreferrer" className="hover:underline text-primary truncate">
                            {empresa.sitioWeb.replace(/^https?:\/\//, "")}
                          </a>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Contactos */}
              {contactos.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      Contactos ({contactos.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4 space-y-3">
                    {contactos.map((rel: any) => {
                      const c = rel.contacto;
                      return (
                        <div key={c.id} className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Link
                              href={`/crm/contactos/${c.id}`}
                              className="text-sm font-semibold hover:underline text-primary flex items-center gap-1"
                            >
                              {c.nombre} {c.apellido}
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                            {rel.principal && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">Principal</Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                            {c.cargo && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Briefcase className="h-3.5 w-3.5 shrink-0" />
                                <span>{c.cargo}</span>
                              </div>
                            )}
                            {c.empresa?.nombre && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Building2 className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{c.empresa.nombre}</span>
                              </div>
                            )}
                            {c.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <a href={`mailto:${c.email}`} className="hover:underline text-primary truncate">{c.email}</a>
                              </div>
                            )}
                            {c.telefonoPrincipal && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <a href={`tel:${c.telefonoPrincipal}`} className="hover:underline text-primary">{c.telefonoPrincipal}</a>
                              </div>
                            )}
                            {c.telefonoSecundario && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <a href={`tel:${c.telefonoSecundario}`} className="hover:underline text-primary">{c.telefonoSecundario}
                                  <span className="ml-1 text-[10px] text-muted-foreground">(alt)</span>
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* Campos Personalizados */}
              {campos.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      Campos personalizados
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                      {campos.map((cv: any) => (
                        <div key={cv.id}>
                          <dt className="text-xs font-medium text-muted-foreground mb-0.5">{cv.campo?.nombre ?? cv.campo?.clave}</dt>
                          <dd className="text-sm text-foreground">{formatearValorCampo(cv)}</dd>
                        </div>
                      ))}
                    </dl>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── Tab Productos ─────────────────────────────────── */}
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

            {/* ── Tab Actividades ───────────────────────────────── */}
            <TabsContent value="actividades" className="mt-4">
              {puedeMod && (
                <div className="flex justify-end mb-4">
                  <ButtonLink size="sm" href={`/crm/actividades/nueva?oportunidadId=${id}`}>
                    <Plus className="h-4 w-4" />Nueva actividad
                  </ButtonLink>
                </div>
              )}
              <TimelineActividades actividades={actividades} puedeMod={puedeMod} />
            </TabsContent>

            {/* ── Tab Cotizaciones ──────────────────────────────── */}
            <TabsContent value="cotizaciones" className="mt-4">
              {puedeMod && (
                <div className="flex justify-end mb-4">
                  <ButtonLink
                    size="sm"
                    href={`/sales/cotizaciones/nueva?oportunidadId=${id}${contactoPrincipal ? `&contactoId=${contactoPrincipal.id}` : ""}`}
                  >
                    <Plus className="h-4 w-4" />Nueva cotización
                  </ButtonLink>
                </div>
              )}
              {cotizaciones.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center">
                  <FileCheck className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Sin cotizaciones vinculadas.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Crea una cotización pre-cargada con los datos de esta oportunidad.</p>
                </div>
              ) : (
                <Card>
                  <CardContent className="pt-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-medium text-muted-foreground">Número</th>
                          <th className="text-left py-3 px-2 font-medium text-muted-foreground">Estado</th>
                          <th className="text-right py-3 px-2 font-medium text-muted-foreground">Total</th>
                          <th className="text-right py-3 px-2 font-medium text-muted-foreground">Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cotizaciones.map((cot) => {
                          const conf = ESTADO_COTIZACION_CONFIG[cot.estado];
                          return (
                            <tr
                              key={cot.id}
                              className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                            >
                              <td className="py-2.5 px-2">
                                <a href={`/sales/cotizaciones/${cot.id}`} className="font-medium text-primary hover:underline">
                                  {cot.numero}
                                </a>
                              </td>
                              <td className="py-2.5 px-2">
                                <span className={cn(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                                  cot.estado === "APROBADA" && "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400",
                                  cot.estado === "ENVIADA" && "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
                                  cot.estado === "BORRADOR" && "bg-stone-100 text-stone-600 dark:bg-stone-500/10 dark:text-stone-400",
                                  cot.estado === "RECHAZADA" && "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
                                  cot.estado === "VENCIDA" && "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
                                )}>
                                  {conf.etiqueta}
                                </span>
                              </td>
                              <td className="py-2.5 px-2 text-right font-medium tabular-nums">
                                {cot.moneda} {Number(cot.total).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-2 text-right text-muted-foreground">
                                {format(new Date(cot.creadoEn), "dd MMM yyyy", { locale: es })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
