"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AtSign,
  Briefcase,
  Building2,
  Calendar,
  CalendarPlus,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  History,
  Info,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Plus,
  Send,
  ShoppingBag,
  Sparkles,
  Tag,
  Target,
  TrendingUp,
  User,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampoEditable, CampoEditableTexto } from "@/shared/ui/campo-editable";
import { Combobox } from "@/shared/ui/combobox";
import { SelectorPipelineStage } from "@/crm/pipeline/components/selector-pipeline-stage";
import { actualizarOportunidad } from "@/crm/oportunidades/actions";
import { actualizarContacto } from "../actions";
import { FechaHora } from "@/shared/fechas/fecha-hora";
import { cn } from "@/lib/utils";
import { TimelineActividades } from "@/crm/actividades/components/timeline-actividades";
import { GestorTagsInline } from "@/crm/tags/components/gestor-tags-inline";
import { EtapaBadge } from "@/crm/oportunidades/components/etapa-badge";
import type { Etapa } from "@/crm/oportunidades/types";
import type { Actividad } from "@/crm/actividades/types";
import type { Tag as TagType } from "@/crm/tags/types";
import type { PerfilCliente } from "@/ai/perfil-cliente/tipos";
import type { ResumenContacto } from "../resumen";
import { analizarContactoAction } from "../analisis/actions";
import { SeccionAnalisisIA } from "../analisis/components/seccion-analisis-ia";
import {
  ETIQUETA_INTENCION,
  ETIQUETA_RELACION,
  ETIQUETA_URGENCIA,
} from "../analisis/components/insignias-analisis";
import { ETIQUETA_GRUPO_CANAL, grupoDeCanal } from "../segmentacion/canales";
import { ETIQUETA_SEGUIMIENTO } from "./contactos-filtros";
import { AvatarContacto } from "./avatar-contacto";
import { ControlClasificacion } from "./control-clasificacion";
import { PanelPerfilCliente } from "./panel-perfil-cliente";
import {
  ETIQUETA_INTERES,
  InsigniaInteres,
  InsigniaNoContactar,
  InsigniaRecomendacion,
  InsigniaTipo,
} from "./insignias-contacto";

export interface OportunidadFicha {
  id: string;
  titulo: string;
  etapa: Etapa;
  valor: number;
  moneda: string;
  creadoEn: Date;
  pipelineId: string | null;
  stageId: string | null;
  stage: { nombre: string; color: string | null; esGanado: boolean; esPerdido: boolean } | null;
}

export interface FichaContactoProps {
  contacto: {
    id: string;
    nombre: string;
    apellido: string;
    email: string | null;
    telefonoPrincipal: string | null;
    telefonoSecundario: string | null;
    cargo: string | null;
    empresa: { id: string; nombre: string } | null;
    notas: string | null;
    creadoEn: Date;
  };
  resumen: ResumenContacto | null;
  oportunidades: OportunidadFicha[];
  actividades: Actividad[];
  tagIdsActuales: string[];
  todosLosTags: TagType[];
  perfil: PerfilCliente | null;
  puedeMod: boolean;
  puedeModOportunidades: boolean;
  empresas: Array<{ id: string; nombre: string }>;
}

const SIN_EMPRESA = "__sin_empresa__";

const ETIQUETA_ORIGEN = { MANUAL: "manual", REGLA: "regla", IA: "IA" } as const;

// ── Piezas ─────────────────────────────────────────────────────────────────

function Tarjeta({
  titulo,
  Icono,
  accion,
  children,
  className,
}: {
  titulo: ReactNode;
  Icono: LucideIcon;
  accion?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      data-slot="tarjeta-ficha"
      className={cn("flex flex-col gap-4 rounded-2xl border border-border-subtle bg-card p-5 shadow-sm", className)}
    >
      <header className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Icono className="size-4 text-primary" aria-hidden />
          {titulo}
        </h2>
        {accion}
      </header>
      {children}
    </section>
  );
}

function FilaDato({ Icono, etiqueta, children }: { Icono: LucideIcon; etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 text-sm">
      <Icono className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="w-36 shrink-0 text-muted-foreground">{etiqueta}</span>
      <span className="min-w-0 flex-1 truncate text-foreground">{children}</span>
    </div>
  );
}

function IconoCanal({ canal, className }: { canal: string; className?: string }) {
  const clase = cn("size-3.5 shrink-0", className);
  if (canal.startsWith("whatsapp")) return <MessageCircle className={cn(clase, "text-success")} aria-hidden />;
  if (canal === "instagram") return <Camera className={cn(clase, "text-stage-purple-text")} aria-hidden />;
  if (canal === "facebook_messenger") return <Send className={cn(clase, "text-info")} aria-hidden />;
  if (canal === "email") return <Mail className={cn(clase, "text-info")} aria-hidden />;
  return <MessageCircle className={cn(clase, "text-muted-foreground")} aria-hidden />;
}

function etiquetaCanal(canal: string) {
  const grupo = grupoDeCanal(canal);
  return grupo ? ETIQUETA_GRUPO_CANAL[grupo] : canal;
}

function Vacio({ Icono, titulo, detalle }: { Icono: LucideIcon; titulo: string; detalle: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-subtle py-8 text-center">
      <span className="flex size-10 items-center justify-center rounded-xl bg-muted">
        <Icono className="size-4 text-muted-foreground" aria-hidden />
      </span>
      <p className="text-sm font-medium text-foreground">{titulo}</p>
      <p className="max-w-xs text-xs text-muted-foreground">{detalle}</p>
    </div>
  );
}

function formatearMonto(valor: number, moneda: string) {
  try {
    return new Intl.NumberFormat("es", { style: "currency", currency: moneda, maximumFractionDigits: 2 }).format(valor);
  } catch {
    return `${moneda} ${valor.toFixed(2)}`;
  }
}

function claseAnillo(puntaje: number) {
  if (puntaje >= 70) return "text-success";
  if (puntaje >= 40) return "text-stage-amber";
  return "text-muted-foreground";
}

function AnilloPuntaje({ puntaje }: { puntaje: number | null }) {
  const radio = 22;
  const circunferencia = 2 * Math.PI * radio;
  const progreso = puntaje === null ? 0 : Math.max(0, Math.min(100, puntaje)) / 100;
  return (
    <div
      data-slot="anillo-puntaje"
      className="relative flex size-16 shrink-0 items-center justify-center"
      title={puntaje === null ? "Sin analizar" : `Puntaje comercial ${puntaje} de 100`}
    >
      <svg viewBox="0 0 52 52" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="26" cy="26" r={radio} fill="none" strokeWidth="5" className="stroke-muted" />
        <circle
          cx="26"
          cy="26"
          r={radio}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={circunferencia}
          strokeDashoffset={circunferencia * (1 - progreso)}
          className={cn("transition-[stroke-dashoffset] duration-500", puntaje === null ? "text-transparent" : claseAnillo(puntaje))}
        />
      </svg>
      <span className="text-lg font-semibold tabular-nums text-foreground">{puntaje ?? "—"}</span>
    </div>
  );
}

function Chip({ Icono, children, className }: { Icono?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border border-border-subtle bg-background-subtle px-2.5 text-xs font-medium text-foreground",
        className,
      )}
    >
      {Icono && <Icono className="size-3.5 shrink-0" aria-hidden />}
      {children}
    </span>
  );
}

// ── Resumen IA ─────────────────────────────────────────────────────────────

function TarjetaResumenIA({
  contactoId,
  analisis,
  puedeMod,
}: {
  contactoId: string;
  analisis: ResumenContacto["analisis"];
  puedeMod: boolean;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const ev = analisis.evaluacion;
  const analizando = analisis.analizandoAhora;

  // Mientras corre un análisis se vuelve a pedir la página hasta que termine (042 FR-051).
  useEffect(() => {
    if (!analizando) return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [analizando, router]);

  const analizar = async () => {
    setEnviando(true);
    const r = await analizarContactoAction({ contactoId });
    setEnviando(false);
    if (!r.exito) toast.error("error" in r && r.error ? r.error : "No se pudo iniciar el análisis");
    else toast.success("Análisis en curso");
    router.refresh();
  };

  const titular = ev
    ? [
        ETIQUETA_RELACION[ev.relacionComercial],
        ev.intencion && ev.intencion !== "DESCONOCIDA" ? `intención de compra ${ETIQUETA_INTENCION[ev.intencion].toLowerCase()}` : null,
        ev.urgencia ? `urgencia ${ETIQUETA_URGENCIA[ev.urgencia].toLowerCase()}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <section
      data-slot="resumen-ia"
      className="relative overflow-hidden rounded-2xl border border-primary-border bg-card p-5 shadow-sm"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-subtle via-transparent to-transparent" />
      <div className="relative flex gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-muted">
          <Sparkles className="size-5 text-primary" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-base font-semibold text-foreground">
              Resumen IA
              <span title="Lectura comercial calculada por reglas y, si está habilitado, por la IA. No es un hecho confirmado.">
                <Info className="size-3.5 text-muted-foreground" aria-hidden />
              </span>
            </h2>
            <div className="flex items-center gap-2">
              {ev && (
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-stage-purple-muted px-2.5 text-xs font-medium text-stage-purple-text">
                  <Sparkles className="size-3" aria-hidden />
                  {ev.origen === "IA" ? "Generado por IA" : "Por reglas"}
                </span>
              )}
              {puedeMod && analisis.iaDisponible && (
                <Button size="sm" variant="outline" disabled={enviando || analizando} onClick={analizar}>
                  {enviando || analizando ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="size-3.5" aria-hidden />
                  )}
                  {analizando ? "Analizando…" : "Analizar"}
                </Button>
              )}
            </div>
          </div>

          {!ev ? (
            <p className="text-sm text-muted-foreground">
              {analisis.estadoCola === "PENDIENTE" || analisis.estadoCola === "EN_PROCESO"
                ? "El análisis de este contacto está en cola."
                : "Este contacto todavía no fue analizado."}
            </p>
          ) : (
            <>
              {titular && <p className="text-sm font-medium text-foreground">{titular}</p>}
              {ev.motivos.length > 0 && (
                <p className="text-sm leading-relaxed text-text-secondary">{ev.motivos.slice(0, 3).join(" · ")}</p>
              )}
              {ev.senales.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {ev.senales.slice(0, 5).map((s, i) => (
                    <Chip key={`${i}-${s}`}>{s}</Chip>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Analizado <FechaHora valor={ev.evaluadoIAEn ?? ev.evaluadoEn} modo="relativa" />
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Actividad reciente ─────────────────────────────────────────────────────

interface EventoReciente {
  id: string;
  Icono: LucideIcon;
  titulo: string;
  detalle: string | null;
  fecha: Date | string;
  href?: string;
}

function construirEventos(
  actividades: Actividad[],
  oportunidades: OportunidadFicha[],
  resumen: ResumenContacto | null,
): EventoReciente[] {
  const eventos: EventoReciente[] = actividades.slice(0, 6).map((a) => ({
    id: `a-${a.id}`,
    Icono: a.completada ? CheckCircle2 : Calendar,
    titulo: a.titulo,
    detalle: a.completada ? "Actividad completada" : "Actividad pendiente",
    fecha: a.completadaEn ?? a.fecha,
  }));
  for (const o of oportunidades) {
    eventos.push({
      id: `o-${o.id}`,
      Icono: Target,
      titulo: "Oportunidad creada",
      detalle: o.titulo,
      fecha: o.creadoEn,
      href: `/crm/oportunidades/${o.id}`,
    });
  }
  const compra = resumen?.actividadComercial.ultimaCompra;
  if (compra) {
    eventos.push({
      id: `p-${compra.pedidoId}`,
      Icono: ShoppingBag,
      titulo: "Última compra",
      detalle: `Pedido #${compra.numero}`,
      fecha: compra.fecha,
      href: `/sales/pedidos/${compra.pedidoId}`,
    });
  }
  return eventos
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, 4);
}

// ── Ficha ──────────────────────────────────────────────────────────────────

export function FichaContacto({
  contacto,
  resumen,
  oportunidades,
  actividades,
  tagIdsActuales,
  todosLosTags,
  perfil,
  puedeMod,
  puedeModOportunidades,
  empresas,
}: FichaContactoProps) {
  const router = useRouter();

  /** Un campo por vez, igual que el panel del Inbox; la página se refresca para que el resto de la ficha lo refleje. */
  const guardarContacto = async (cambio: Record<string, string>, aviso = "Guardado") => {
    const res = await actualizarContacto(contacto.id, cambio);
    if (!res.exito) {
      toast.error(res.error);
      return;
    }
    toast.success(aviso);
    router.refresh();
  };
  const [pestaña, setPestaña] = useState("resumen");
  const r = resumen?.contacto;
  const nombreCompleto = `${contacto.nombre} ${contacto.apellido}`.trim() || "Sin nombre";
  const canales = r?.canales ?? [];
  const ev = resumen?.analisis.evaluacion ?? null;
  const eventos = construirEventos(actividades, oportunidades, resumen);
  const oportunidadesAbiertas = oportunidades.filter((o) => !o.stage?.esGanado && !o.stage?.esPerdido);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section
        data-slot="hero-contacto"
        className="relative overflow-hidden rounded-2xl border border-border-subtle bg-card shadow-sm"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary-subtle via-transparent to-transparent" />
        <div className="relative flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex min-w-0 items-center gap-4">
            <AvatarContacto
              nombre={contacto.nombre}
              apellido={contacto.apellido}
              avatarUrl={r?.avatarUrl}
              size="lg"
              className="rounded-2xl shadow-sm ring-2 ring-primary-border after:rounded-2xl [&_[data-slot=avatar-fallback]]:rounded-2xl [&_[data-slot=avatar-image]]:rounded-2xl"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">{nombreCompleto}</h1>
                {r && <InsigniaTipo tipo={r.tipo} />}
                {r?.noContactar && <InsigniaNoContactar />}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {canales.slice(0, 3).map((c) => (
                  <span key={`${c.canal}-${c.identificador}`} className="inline-flex items-center gap-1.5">
                    <IconoCanal canal={c.canal} />
                    {c.handle ? `@${c.handle}` : etiquetaCanal(c.canal)}
                  </span>
                ))}
                {contacto.cargo && (
                  <span className="inline-flex items-center gap-1.5">
                    <Briefcase className="size-3.5" aria-hidden />
                    {contacto.cargo}
                  </span>
                )}
                {contacto.empresa && (
                  <Link href={`/crm/empresas/${contacto.empresa.id}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                    <Building2 className="size-3.5" aria-hidden />
                    {contacto.empresa.nombre}
                  </Link>
                )}
              </div>
            </div>
          </div>

          {puedeMod && (
            <div className="flex items-center gap-2">
              <ButtonLink size="sm" href={`/crm/actividades/nueva?contactoId=${contacto.id}`}>
                <CalendarPlus className="size-3.5" aria-hidden />
                Crear actividad
              </ButtonLink>
            </div>
          )}
        </div>
      </section>

      {/* ── Pestañas ─────────────────────────────────────────────────── */}
      <Tabs value={pestaña} onValueChange={(v) => setPestaña(String(v))}>
        <TabsList className="h-10 rounded-xl p-1">
          <TabsTrigger value="resumen" className="rounded-lg px-4">Resumen</TabsTrigger>
          <TabsTrigger value="oportunidades" className="rounded-lg px-4">
            Oportunidades
            {oportunidades.length > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-badge-bg px-1.5 text-xs font-semibold text-badge-text">
                {oportunidades.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="actividades" className="rounded-lg px-4">
            Actividades
            {actividades.length > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-badge-bg px-1.5 text-xs font-semibold text-badge-text">
                {actividades.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="perfil" className="rounded-lg px-4">Perfil</TabsTrigger>
        </TabsList>

        {/* ── Resumen ────────────────────────────────────────────────── */}
        <TabsContent value="resumen" className="mt-3 flex flex-col gap-4">
          {resumen && <TarjetaResumenIA contactoId={contacto.id} analisis={resumen.analisis} puedeMod={puedeMod} />}

          <div className="grid gap-4 lg:grid-cols-2">
            <Tarjeta titulo="Datos de contacto" Icono={User}>
              <div className="-mx-3 -my-2 flex flex-col">
                <CampoEditable
                  variante="fila"
                  label="Nombre"
                  valor={contacto.nombre}
                  placeholder="Agregar nombre"
                  icono={<User className="size-4" />}
                  deshabilitado={!puedeMod}
                  onGuardar={async (v) => {
                    if (!v.trim()) { toast.error("El nombre es requerido"); return; }
                    await guardarContacto({ nombre: v.trim() });
                  }}
                />
                <CampoEditable
                  variante="fila"
                  label="Apellido"
                  valor={contacto.apellido}
                  placeholder="Agregar apellido"
                  icono={<User className="size-4" />}
                  deshabilitado={!puedeMod}
                  onGuardar={async (v) => {
                    if (!v.trim()) { toast.error("El apellido es requerido"); return; }
                    await guardarContacto({ apellido: v.trim() });
                  }}
                />
                <CampoEditable
                  variante="fila"
                  tipo="tel"
                  label="Teléfono"
                  valor={contacto.telefonoPrincipal}
                  placeholder="Agregar teléfono"
                  icono={<Phone className="size-4" />}
                  deshabilitado={!puedeMod}
                  onGuardar={(v) => guardarContacto({ telefonoPrincipal: v.trim() })}
                />
                <CampoEditable
                  variante="fila"
                  tipo="tel"
                  label="Teléfono alternativo"
                  valor={contacto.telefonoSecundario}
                  placeholder="Agregar teléfono"
                  icono={<Phone className="size-4" />}
                  deshabilitado={!puedeMod}
                  onGuardar={(v) => guardarContacto({ telefonoSecundario: v.trim() })}
                />
                <CampoEditable
                  variante="fila"
                  tipo="email"
                  label="Email"
                  valor={contacto.email}
                  placeholder="Agregar email"
                  icono={<Mail className="size-4" />}
                  deshabilitado={!puedeMod}
                  onGuardar={(v) => guardarContacto({ email: v.trim() })}
                />
                <CampoEditable
                  variante="fila"
                  label="Cargo"
                  valor={contacto.cargo}
                  placeholder="Agregar cargo"
                  icono={<Briefcase className="size-4" />}
                  deshabilitado={!puedeMod}
                  onGuardar={(v) => guardarContacto({ cargo: v.trim() })}
                />
                {puedeMod ? (
                  <div className="flex items-center gap-3 px-3 py-1.5 text-sm">
                    <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="w-36 shrink-0 text-muted-foreground">Empresa</span>
                    <div className="min-w-0 flex-1 [&_[data-slot=popover-trigger]]:h-8">
                      <Combobox
                        opciones={[
                          { valor: SIN_EMPRESA, etiqueta: "Sin empresa" },
                          ...empresas.map((e) => ({ valor: e.id, etiqueta: e.nombre })),
                        ]}
                        valor={contacto.empresa?.id ?? SIN_EMPRESA}
                        onChange={(v) => {
                          const nueva = v === SIN_EMPRESA ? "" : v;
                          if (nueva === (contacto.empresa?.id ?? "")) return;
                          void guardarContacto({ empresaId: nueva });
                        }}
                        placeholderBusqueda="Buscar empresa..."
                        mensajeVacio="Sin empresas."
                      />
                    </div>
                  </div>
                ) : (
                  <FilaDato Icono={Building2} etiqueta="Empresa">
                    {contacto.empresa?.nombre ?? <span className="text-muted-foreground">Sin empresa</span>}
                  </FilaDato>
                )}

                <div className="mx-3 my-1 border-t border-border-subtle" />

                <FilaDato Icono={Calendar} etiqueta="Creado">
                  <FechaHora valor={contacto.creadoEn} modo="fecha" />
                </FilaDato>
                <FilaDato Icono={MessageSquare} etiqueta="Canal">
                  {canales.length === 0 ? (
                    <span className="text-muted-foreground">Sin canal</span>
                  ) : (
                    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                      {Array.from(new Set(canales.map((c) => etiquetaCanal(c.canal)))).map((etiqueta) => {
                        const c = canales.find((x) => etiquetaCanal(x.canal) === etiqueta)!;
                        return (
                          <span key={etiqueta} className="inline-flex items-center gap-1.5">
                            <IconoCanal canal={c.canal} />
                            {etiqueta}
                          </span>
                        );
                      })}
                    </span>
                  )}
                </FilaDato>
                <FilaDato Icono={Clock} etiqueta="Última interacción">
                  <FechaHora
                    valor={resumen?.actividadComercial.ultimaInteraccionEn}
                    modo="fechaHora"
                    vacio="Sin interacción"
                  />
                </FilaDato>
                {canales
                  .filter((c) => c.handle)
                  .map((c) => (
                    <FilaDato key={`${c.canal}-${c.identificador}`} Icono={AtSign} etiqueta={`Usuario (${etiquetaCanal(c.canal)})`}>
                      @{c.handle}
                    </FilaDato>
                  ))}
              </div>
            </Tarjeta>

            <Tarjeta
              titulo="Estado comercial"
              Icono={TrendingUp}
              accion={
                <span title="Tipo, seguimiento y recomendación salen de las mismas reglas que la lista de contactos.">
                  <Info className="size-4 text-muted-foreground" aria-hidden />
                </span>
              }
            >
              {r ? (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Tipo</span>
                        <InsigniaTipo tipo={r.tipo} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Seguimiento</span>
                        <span className="text-sm font-medium text-foreground">{ETIQUETA_SEGUIMIENTO[r.seguimiento]}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 border-l border-border-subtle pl-4">
                      <span className="text-xs text-muted-foreground">Puntaje<br />comercial</span>
                      <AnilloPuntaje puntaje={ev?.puntaje ?? null} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-background-subtle px-3 py-2">
                    <span className="text-xs text-muted-foreground">Recomendación</span>
                    <InsigniaRecomendacion recomendacion={r.recomendacion} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <InsigniaInteres interes={r.interes} fijado={r.interesFijado} className="h-7 px-2.5" />
                    {ev?.intencion && ev.intencion !== "DESCONOCIDA" && (
                      <Chip Icono={TrendingUp}>Intención {ETIQUETA_INTENCION[ev.intencion].toLowerCase()}</Chip>
                    )}
                    {ev?.urgencia && <Chip Icono={Clock}>Urgencia {ETIQUETA_URGENCIA[ev.urgencia].toLowerCase()}</Chip>}
                    {resumen.actividadComercial.ultimaCompra && <Chip Icono={ShoppingBag}>Compra previa</Chip>}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Estado comercial no disponible.</p>
              )}
            </Tarjeta>

            <Tarjeta
              titulo={`Oportunidades (${oportunidades.length})`}
              Icono={Target}
              accion={
                oportunidades.length > 3 ? (
                  <Button size="sm" variant="ghost" onClick={() => setPestaña("oportunidades")}>
                    Ver todas
                    <ChevronRight className="size-3.5" aria-hidden />
                  </Button>
                ) : null
              }
            >
              {oportunidades.length === 0 ? (
                <Vacio Icono={Target} titulo="Sin oportunidades" detalle="Aún no hay oportunidades vinculadas a este contacto." />
              ) : (
                <ul className="-my-1 flex flex-col divide-y divide-border-subtle">
                  {(oportunidadesAbiertas.length > 0 ? oportunidadesAbiertas : oportunidades).slice(0, 3).map((o) => (
                    <li key={o.id}>
                      <FilaOportunidad o={o} editable={puedeModOportunidades} />
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>

            <Tarjeta titulo="Actividad reciente" Icono={Activity}>
              {eventos.length === 0 ? (
                <Vacio Icono={Activity} titulo="Sin actividad" detalle="Las actividades, oportunidades y compras aparecerán acá." />
              ) : (
                <ol className="relative flex flex-col gap-4 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-border-subtle">
                  {eventos.map((e) => {
                    const contenido = (
                      <div className="flex items-start gap-3">
                        <span aria-hidden className="relative z-10 mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-card bg-primary" />
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <e.Icono className="size-4 text-muted-foreground" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{e.titulo}</p>
                          {e.detalle && <p className="truncate text-xs text-muted-foreground">{e.detalle}</p>}
                        </div>
                        <FechaHora valor={e.fecha} modo="corta" className="shrink-0 text-xs text-muted-foreground" />
                      </div>
                    );
                    return (
                      <li key={e.id}>
                        {e.href ? (
                          <Link href={e.href} className="block rounded-lg transition-colors hover:bg-muted/40">
                            {contenido}
                          </Link>
                        ) : (
                          contenido
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </Tarjeta>
          </div>

          <Tarjeta titulo="Etiquetas" Icono={Tag}>
            <GestorTagsInline
              entidadId={contacto.id}
              tipo="contacto"
              tagIdsActuales={tagIdsActuales}
              todosLosTags={todosLosTags}
              puedeMod={puedeMod}
            />
          </Tarjeta>

          {(contacto.notas || puedeMod) && (
            <Tarjeta titulo="Notas" Icono={FileText}>
              <CampoEditableTexto
                variante="fila"
                label="Notas internas"
                valor={contacto.notas}
                placeholder="Agrega una nota sobre este contacto..."
                icono={<FileText className="size-4" />}
                filas={4}
                deshabilitado={!puedeMod}
                className="-mx-3 -my-2"
                onGuardar={(v) => guardarContacto({ notas: v }, "Nota guardada")}
              />
            </Tarjeta>
          )}
        </TabsContent>

        {/* ── Oportunidades ──────────────────────────────────────────── */}
        <TabsContent value="oportunidades" className="mt-3">
          {oportunidades.length === 0 ? (
            <Vacio Icono={TrendingUp} titulo="Sin oportunidades" detalle="No hay oportunidades vinculadas a este contacto." />
          ) : (
            <div className="flex flex-col gap-2.5">
              {oportunidades.map((o) => (
                <div key={o.id} className="rounded-2xl border border-border-subtle bg-card px-4 py-1 shadow-sm transition-shadow hover:shadow-md">
                  <FilaOportunidad o={o} editable={puedeModOportunidades} />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Actividades ────────────────────────────────────────────── */}
        <TabsContent value="actividades" className="mt-3 flex flex-col gap-4">
          {puedeMod && (
            <div className="flex justify-end">
              <ButtonLink size="sm" href={`/crm/actividades/nueva?contactoId=${contacto.id}`}>
                <Plus className="size-4" aria-hidden />
                Nueva actividad
              </ButtonLink>
            </div>
          )}
          {actividades.length === 0 ? (
            <Vacio Icono={Calendar} titulo="Sin actividades" detalle="Registra llamadas, emails o reuniones con este contacto." />
          ) : (
            <TimelineActividades actividades={actividades} puedeMod={puedeMod} />
          )}
        </TabsContent>

        {/* ── Perfil ─────────────────────────────────────────────────── */}
        <TabsContent value="perfil" className="mt-3 flex flex-col gap-4">
          {resumen && (
            <Tarjeta titulo="Análisis de IA" Icono={Sparkles}>
              <SeccionAnalisisIA
                contactoId={contacto.id}
                analisis={resumen.analisis}
                puedeModificar={puedeMod}
                onCambio={() => router.refresh()}
              />
            </Tarjeta>
          )}
          {puedeMod && r && (
            <Tarjeta titulo="Clasificación" Icono={TrendingUp}>
              <ControlClasificacion
                contactoId={r.id}
                interes={r.interes}
                interesFijado={r.interesFijado}
                noContactar={Boolean(r.noContactar)}
              />
              {r.noContactar && (
                <p className="text-xs text-muted-foreground">
                  No contactar desde <FechaHora valor={r.noContactar.desde} modo="fecha" />
                  {r.noContactar.porNombre ? ` · marcado por ${r.noContactar.porNombre}` : ""}
                </p>
              )}
            </Tarjeta>
          )}
          <PanelPerfilCliente perfil={perfil} />
          {resumen && resumen.historial.length > 0 && (
            <Tarjeta titulo="Historial de clasificación" Icono={History}>
              <ul className="flex flex-col gap-2">
                {resumen.historial.map((h, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    <span className="text-foreground">
                      {h.dimension === "INTERES" ? "Interés" : "Preferencia"}: {valorHistorial(h.dimension, h.valorAnterior)} →{" "}
                      {valorHistorial(h.dimension, h.valorNuevo)}
                    </span>{" "}
                    · {ETIQUETA_ORIGEN[h.origen]}
                    {h.usuarioNombre ? ` · ${h.usuarioNombre}` : ""} · <FechaHora valor={h.creadoEn} modo="relativa" />
                  </li>
                ))}
              </ul>
            </Tarjeta>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function valorHistorial(dimension: "INTERES" | "PREFERENCIA_CONTACTO", valor: string | null) {
  if (!valor) return "—";
  if (dimension === "INTERES") return ETIQUETA_INTERES[valor as keyof typeof ETIQUETA_INTERES] ?? valor;
  return valor === "NO_CONTACTAR" ? "No contactar" : "Contactable";
}

/**
 * Fila de oportunidad con la etapa editable en el lugar, igual que la tarjeta
 * del Inbox: mover de etapa no obliga a abrir la oportunidad completa.
 */
function FilaOportunidad({ o, editable }: { o: OportunidadFicha; editable: boolean }) {
  const router = useRouter();
  const [moviendo, iniciar] = useTransition();
  const [etapa, setEtapa] = useState({
    pipelineId: o.pipelineId,
    stageId: o.stageId,
    nombre: o.stage?.nombre ?? null,
    color: o.stage?.color ?? null,
  });

  useEffect(() => {
    setEtapa({ pipelineId: o.pipelineId, stageId: o.stageId, nombre: o.stage?.nombre ?? null, color: o.stage?.color ?? null });
  }, [o.pipelineId, o.stageId, o.stage?.nombre, o.stage?.color]);

  const mover = (stageId: string, pipelineId: string, nombre: string, color: string | null) => {
    if (stageId === etapa.stageId) return;
    const anterior = etapa;
    setEtapa({ pipelineId, stageId, nombre, color });
    iniciar(async () => {
      const res = await actualizarOportunidad(o.id, { stageId, pipelineId });
      if (!res.exito) {
        setEtapa(anterior);
        toast.error(res.error);
        return;
      }
      toast.success(`Movida a ${nombre}`);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Target className="size-4 text-muted-foreground" aria-hidden />
      </span>
      <Link href={`/crm/oportunidades/${o.id}`} className="group min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">{o.titulo}</p>
        <p className="text-xs text-muted-foreground">
          <FechaHora valor={o.creadoEn} modo="fecha" />
        </p>
      </Link>
      {editable ? (
        <SelectorPipelineStage
          pipelineId={etapa.pipelineId}
          stageId={etapa.stageId}
          stageNombre={etapa.nombre}
          stageColor={etapa.color}
          cargando={moviendo}
          onSelect={mover}
        />
      ) : (
        <EtapaBadge etapa={o.etapa} stage={o.stage} />
      )}
      <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
        {formatearMonto(o.valor, o.moneda)}
      </span>
    </div>
  );
}
