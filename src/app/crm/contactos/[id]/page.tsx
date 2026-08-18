import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft, Pencil, Phone, Mail, Building2, Briefcase,
  Calendar, Plus, Tag, TrendingUp, ExternalLink, FileText,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TimelineActividades } from "@/crm/actividades/components/timeline-actividades";
import { obtenerContactoPorId } from "@/crm/contactos/queries";
import { obtenerActividadesPorContacto } from "@/crm/actividades/queries";
import { obtenerTags } from "@/crm/tags/queries";
import { GestorTagsInline } from "@/crm/tags/components/gestor-tags-inline";
import { ETAPAS_PIPELINE } from "@/crm/oportunidades/types";
import { obtenerConversacionesResumenPorContacto, obtenerCuentasCanal } from "@/conversaciones/queries";
import { requireSesion } from "@/shared/auth/sesion";
import { puedeModificar, verificarAcceso } from "@/shared/auth/permisos";
import { PanelConversacion } from "@/conversaciones/components/panel-conversacion";
import type { Actividad } from "@/crm/actividades/types";
import type { Tag as TagType } from "@/crm/tags/types";
import { cn } from "@/lib/utils";

const ESTADO_CONFIG = {
  ACTIVO: {
    etiqueta: "Activo",
    clase: "bg-lime-500/10 dark:bg-lime-400/15 text-lime-700 dark:text-lime-400 border border-lime-500/20 dark:border-lime-400/25",
  },
  INACTIVO: {
    etiqueta: "Inactivo",
    clase: "bg-stone-100 dark:bg-white/8 text-stone-500 dark:text-stone-400 border border-stone-200 dark:border-white/10",
  },
  LEAD: {
    etiqueta: "Lead",
    clase: "bg-blue-500/10 dark:bg-blue-400/15 text-blue-700 dark:text-blue-400 border border-blue-500/20 dark:border-blue-400/25",
  },
} as const;

const ETAPA_HEX: Record<string, string> = {
  PROSPECTO: "#94a3b8",
  CALIFICADO: "#60a5fa",
  PROPUESTA: "#a78bfa",
  NEGOCIACION: "#fbbf24",
  GANADO: "#4ade80",
  PERDIDO: "#f87171",
};

export default async function ContactoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let contacto = null;
  let actividades: Actividad[] = [];
  let todosLosTags: TagType[] = [];
  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "contactos", "ver").permitido) redirect("/acceso-denegado");
  const puedeMod = puedeModificar(sesion.rol, "contactos");
  let conversaciones: Awaited<ReturnType<typeof obtenerConversacionesResumenPorContacto>> = [];
  let cuentasCanal: Awaited<ReturnType<typeof obtenerCuentasCanal>> = [];

  try {
    [contacto, actividades, todosLosTags] = await Promise.all([
      obtenerContactoPorId(id, sesion.instanciaId),
      obtenerActividadesPorContacto(id, sesion.instanciaId),
      obtenerTags(sesion.instanciaId),
    ]);
  } catch {
    // DB not configured
  }

  if (!contacto && process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("placeholder")) {
    notFound();
  }

  if (!contacto) {
    return (
      <div className="p-6">
        <ButtonLink variant="ghost" size="icon-sm" href="/crm/contactos">
          <ArrowLeft className="h-4 w-4" />
        </ButtonLink>
        <p className="text-muted-foreground mt-4 text-sm">Contacto no disponible</p>
      </div>
    );
  }

  try {
    [conversaciones, cuentasCanal] = await Promise.all([
      obtenerConversacionesResumenPorContacto(id, sesion.instanciaId),
      obtenerCuentasCanal(sesion.instanciaId),
    ]);
  } catch {
    // Conversaciones no disponibles
  }

  const estadoConf = ESTADO_CONFIG[contacto.estado] ?? ESTADO_CONFIG.ACTIVO;
  const iniciales = `${contacto.nombre[0] ?? ""}${contacto.apellido[0] ?? ""}`.toUpperCase();
  const oportunidades = (contacto as any).oportunidades ?? [];
  const tagIdsActuales: string[] = ((contacto as any).tags ?? []).map((r: any) => r.tagId);
  const tieneContacto = contacto.email || contacto.telefonoPrincipal || contacto.telefonoSecundario;
  const nombreCompleto = `${contacto.nombre} ${contacto.apellido}`.trim();

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">

      {/* ── Panel Chat (izquierda) ──────────────────────────────── */}
      <div className="w-[360px] shrink-0 flex flex-col">
        <PanelConversacion
          oportunidadId=""
          contactoId={id}
          nombreContacto={nombreCompleto}
          telefonoContacto={contacto.telefonoPrincipal}
          cuentas={cuentasCanal}
          conversacionesIniciales={conversaciones}
          puedeMod={puedeMod}
        />
      </div>

      {/* ── Detalle Contacto (derecha, scrollable) ──────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2">
            <ButtonLink variant="ghost" size="icon-sm" href="/crm/contactos">
              <ArrowLeft className="h-4 w-4" />
            </ButtonLink>
            <span className="text-sm text-stone-400 dark:text-stone-500">Contactos</span>
          </div>

          {/* ── Hero card ──────────────────────────────────────────── */}
          <div className="rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-white/4 dark:backdrop-blur-xl overflow-hidden shadow-sm">
            <div className="h-20 bg-gradient-to-r from-lime-500/15 via-emerald-500/8 to-transparent dark:from-lime-400/10 dark:via-emerald-500/5" />

            <div className="px-6 pb-5 -mt-9 flex items-end justify-between gap-4 flex-wrap">
              <div className="flex items-end gap-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-lime-400 to-emerald-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0 ring-4 ring-white dark:ring-stone-950 shadow-lg shadow-lime-500/20">
                  {iniciales}
                </div>
                <div className="pb-0.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
                      {nombreCompleto}
                    </h1>
                    <Badge className={cn("text-xs font-medium px-2 py-0.5 rounded-full", estadoConf.clase)}>
                      {estadoConf.etiqueta}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {contacto.cargo && (
                      <span className="text-sm text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5" />
                        {contacto.cargo}
                      </span>
                    )}
                    {contacto.empresa && (
                      <Link
                        href={`/crm/empresas/${contacto.empresa.id}`}
                        className="text-sm text-lime-600 dark:text-lime-400 hover:underline flex items-center gap-1.5 font-medium"
                      >
                        <Building2 className="h-3.5 w-3.5" />
                        {contacto.empresa.nombre}
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {puedeMod && (
                <ButtonLink
                  href={`/crm/contactos/${id}/editar`}
                  className="h-9 px-3.5 rounded-xl bg-stone-100 dark:bg-white/8 hover:bg-stone-200 dark:hover:bg-white/12 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-white/10 gap-2 text-sm font-medium mb-0.5"
                  variant="ghost"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </ButtonLink>
              )}
            </div>

            {tieneContacto && (
              <div className="border-t border-stone-100 dark:border-white/8 px-6 py-3 flex gap-2 flex-wrap bg-stone-50/50 dark:bg-white/2">
                {contacto.email && (
                  <a
                    href={`mailto:${contacto.email}`}
                    className="inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-sm font-medium text-stone-600 dark:text-stone-300 bg-white dark:bg-white/6 border border-stone-200 dark:border-white/10 hover:border-lime-400/50 dark:hover:border-lime-400/30 hover:text-lime-700 dark:hover:text-lime-400 transition-all"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {contacto.email}
                  </a>
                )}
                {contacto.telefonoPrincipal && (
                  <a
                    href={`tel:${contacto.telefonoPrincipal}`}
                    className="inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-sm font-medium text-stone-600 dark:text-stone-300 bg-white dark:bg-white/6 border border-stone-200 dark:border-white/10 hover:border-lime-400/50 dark:hover:border-lime-400/30 hover:text-lime-700 dark:hover:text-lime-400 transition-all"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {contacto.telefonoPrincipal}
                  </a>
                )}
                {contacto.telefonoSecundario && (
                  <a
                    href={`tel:${contacto.telefonoSecundario}`}
                    className="inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-sm font-medium text-stone-500 dark:text-stone-400 bg-white dark:bg-white/6 border border-stone-200 dark:border-white/10 hover:border-stone-300 dark:hover:border-white/20 transition-all"
                  >
                    <Phone className="h-3.5 w-3.5 opacity-60" />
                    {contacto.telefonoSecundario}
                    <span className="text-xs text-stone-400 dark:text-stone-600">(alt)</span>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* ── Tabs ─────────────────────────────────────────────────── */}
          <Tabs defaultValue="info">
            <TabsList className="h-10 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/8 p-1 gap-1">
              <TabsTrigger
                value="info"
                className="rounded-lg text-sm font-medium px-4 transition-all text-stone-500 dark:text-stone-400 data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-stone-900 dark:data-[state=active]:text-stone-100 data-[state=active]:shadow-sm"
              >
                Información
              </TabsTrigger>
              <TabsTrigger
                value="oportunidades"
                className="rounded-lg text-sm font-medium px-4 transition-all text-stone-500 dark:text-stone-400 data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-stone-900 dark:data-[state=active]:text-stone-100 data-[state=active]:shadow-sm"
              >
                Oportunidades
                {oportunidades.length > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-md bg-stone-200 dark:bg-white/10 text-xs font-bold text-stone-600 dark:text-stone-400">
                    {oportunidades.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="actividades"
                className="rounded-lg text-sm font-medium px-4 transition-all text-stone-500 dark:text-stone-400 data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-stone-900 dark:data-[state=active]:text-stone-100 data-[state=active]:shadow-sm"
              >
                Actividades
                {actividades.length > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-md bg-stone-200 dark:bg-white/10 text-xs font-bold text-stone-600 dark:text-stone-400">
                    {actividades.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── Tab: Información ─────────────────────────────────── */}
            <TabsContent value="info" className="mt-5 space-y-4">
              <div className="rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-white/4 dark:backdrop-blur-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-100 dark:border-white/8 flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">Datos de contacto</span>
                </div>
                <div className="px-5 py-4">
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                    {contacto.email && (
                      <div>
                        <dt className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                          <Mail className="h-3 w-3" /> Email
                        </dt>
                        <dd>
                          <a href={`mailto:${contacto.email}`} className="text-sm text-stone-700 dark:text-stone-300 hover:text-lime-600 dark:hover:text-lime-400 transition-colors">
                            {contacto.email}
                          </a>
                        </dd>
                      </div>
                    )}
                    {contacto.telefonoPrincipal && (
                      <div>
                        <dt className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                          <Phone className="h-3 w-3" /> Teléfono principal
                        </dt>
                        <dd>
                          <a href={`tel:${contacto.telefonoPrincipal}`} className="text-sm text-stone-700 dark:text-stone-300 hover:text-lime-600 dark:hover:text-lime-400 transition-colors">
                            {contacto.telefonoPrincipal}
                          </a>
                        </dd>
                      </div>
                    )}
                    {contacto.telefonoSecundario && (
                      <div>
                        <dt className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                          <Phone className="h-3 w-3 opacity-60" /> Teléfono alternativo
                        </dt>
                        <dd>
                          <a href={`tel:${contacto.telefonoSecundario}`} className="text-sm text-stone-700 dark:text-stone-300 hover:text-lime-600 dark:hover:text-lime-400 transition-colors">
                            {contacto.telefonoSecundario}
                          </a>
                        </dd>
                      </div>
                    )}
                    {contacto.cargo && (
                      <div>
                        <dt className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                          <Briefcase className="h-3 w-3" /> Cargo
                        </dt>
                        <dd className="text-sm text-stone-700 dark:text-stone-300">{contacto.cargo}</dd>
                      </div>
                    )}
                    {contacto.empresa && (
                      <div>
                        <dt className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                          <Building2 className="h-3 w-3" /> Empresa
                        </dt>
                        <dd>
                          <Link
                            href={`/crm/empresas/${contacto.empresa.id}`}
                            className="text-sm text-lime-600 dark:text-lime-400 hover:underline font-medium flex items-center gap-1 w-fit"
                          >
                            {contacto.empresa.nombre}
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </Link>
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" /> Creado
                      </dt>
                      <dd className="text-sm text-stone-500 dark:text-stone-400">
                        {format(new Date(contacto.creadoEn), "dd MMM yyyy", { locale: es })}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {contacto.notas && (
                <div className="rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-white/4 dark:backdrop-blur-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-stone-100 dark:border-white/8 flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-stone-400 dark:text-stone-500" />
                    <span className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">Notas</span>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-sm text-stone-700 dark:text-stone-300 whitespace-pre-wrap leading-relaxed">
                      {contacto.notas}
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-white/4 dark:backdrop-blur-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-100 dark:border-white/8 flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-stone-400 dark:text-stone-500" />
                  <span className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">Etiquetas</span>
                </div>
                <div className="px-5 py-4">
                  <GestorTagsInline
                    entidadId={id}
                    tipo="contacto"
                    tagIdsActuales={tagIdsActuales}
                    todosLosTags={todosLosTags}
                    puedeMod={puedeMod}
                  />
                </div>
              </div>
            </TabsContent>

            {/* ── Tab: Oportunidades ──────────────────────────────── */}
            <TabsContent value="oportunidades" className="mt-5">
              {oportunidades.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3 rounded-2xl border border-dashed border-stone-200 dark:border-white/10">
                  <div className="h-12 w-12 rounded-2xl bg-stone-100 dark:bg-white/5 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-stone-300 dark:text-stone-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-500 dark:text-stone-400">Sin oportunidades</p>
                    <p className="text-xs text-stone-400 dark:text-stone-600 mt-1">No hay oportunidades vinculadas a este contacto</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {oportunidades.map((rel: any) => {
                    const op = rel.oportunidad;
                    // La etapa real de una oportunidad con pipeline dinámico es la del
                    // stage actual (op.stage), no el enum legacy `etapa` — ese solo se
                    // sincroniza al llegar a un stage ganado/perdido, así que para
                    // cualquier otro stage (ej. "Reservado") queda desactualizado.
                    const etapaEtiqueta = op.stage?.nombre
                      ?? ETAPAS_PIPELINE.find((e) => e.valor === op.etapa)?.etiqueta
                      ?? op.etapa;
                    const colorHex = op.stage?.color ?? ETAPA_HEX[op.etapa] ?? "#94a3b8";
                    const valor = Number(op.valor);
                    return (
                      <Link key={op.id} href={`/crm/oportunidades/${op.id}`}>
                        <div className={cn(
                          "group flex items-center gap-4 rounded-2xl border p-4 transition-all cursor-pointer",
                          "border-stone-200 dark:border-white/10 bg-white dark:bg-white/4 dark:backdrop-blur-sm",
                          "hover:border-stone-300 dark:hover:border-white/20 hover:shadow-md dark:hover:shadow-[0_4px_20px_-6px_rgba(0,0,0,0.5)]"
                        )}>
                          <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: colorHex }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">{op.titulo}</p>
                            <span
                              className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold mt-1"
                              style={{ backgroundColor: `${colorHex}1a`, color: colorHex }}
                            >
                              {etapaEtiqueta}
                            </span>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-lime-600 dark:text-lime-400 tabular-nums">
                              S/ {valor.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <ExternalLink className="h-4 w-4 text-stone-300 dark:text-stone-600 group-hover:text-stone-400 flex-shrink-0 transition-colors" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ── Tab: Actividades ────────────────────────────────── */}
            <TabsContent value="actividades" className="mt-5">
              {puedeMod && (
                <div className="flex justify-end mb-5">
                  <ButtonLink
                    size="sm"
                    href={`/crm/actividades/nueva?contactoId=${id}`}
                    className="h-9 px-3.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-stone-950 shadow-sm gap-2 text-sm font-semibold"
                  >
                    <Plus className="h-4 w-4" />
                    Nueva actividad
                  </ButtonLink>
                </div>
              )}
              {actividades.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3 rounded-2xl border border-dashed border-stone-200 dark:border-white/10">
                  <div className="h-12 w-12 rounded-2xl bg-stone-100 dark:bg-white/5 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-stone-300 dark:text-stone-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-500 dark:text-stone-400">Sin actividades</p>
                    <p className="text-xs text-stone-400 dark:text-stone-600 mt-1">Registra llamadas, emails o reuniones con este contacto</p>
                  </div>
                </div>
              ) : (
                <TimelineActividades actividades={actividades} puedeMod={puedeMod} />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
