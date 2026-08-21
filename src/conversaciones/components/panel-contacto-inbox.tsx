"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  User, Phone, Mail, Building2, Link2, Check, Loader2, Search, X, Smartphone, Camera,
  Trophy, XCircle, ShoppingBag, Headphones, TrendingUp, ChevronDown, History,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { esLid, formatearIdentificadorWA } from "@/lib/whatsapp-utils";
import { actualizarContacto, buscarContactosAction } from "@/crm/contactos/actions";
import { actualizarOportunidad, obtenerOportunidadesAnterioresContactoAction } from "@/crm/oportunidades/actions";
import { obtenerTagsAction } from "@/crm/tags/actions";
import { SelectorTags } from "@/crm/tags/components/selector-tags";
import type { Tag } from "@/crm/tags/types";
import { SelectorPipelineStage } from "@/crm/pipeline/components/selector-pipeline-stage";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { vincularConversacionAContacto, clasificarConversacion } from "../actions";
import { AvatarContacto } from "./avatar-contacto";
import type { ConversacionResumen, ClasificacionConversacion, OportunidadActivaResumen } from "../types";

type Contacto = ConversacionResumen["contacto"];
type OportunidadAnterior = Awaited<ReturnType<typeof obtenerOportunidadesAnterioresContactoAction>>[number];

interface BuscarResultado {
  id: string;
  nombre: string;
  apellido: string;
  email: string | null;
  telefonoPrincipal: string | null;
  empresa: { id: string; nombre: string } | null;
}

interface PanelContactoInboxProps {
  conversacion: ConversacionResumen;
  onContactoActualizado: (conversacionId: string, nuevoContacto: Contacto) => void;
  /** Se llama tras clasificar o editar la oportunidad activa, para que el
   *  padre refresque esta conversación (trae la oportunidad recién creada,
   *  la nueva etapa/etiquetas, etc.). Si ya se tienen los datos frescos a
   *  mano (ej. clasificarConversacion los devuelve en la misma llamada), se
   *  pasan como segundo argumento para evitar un round-trip aparte — si no,
   *  el padre los vuelve a pedir por conversacionId. */
  onConversacionActualizada: (conversacionId: string, datosFrescos?: ConversacionResumen) => void;
}

// ── Campo editable inline ────────────────────────────────────────────────────

function CampoEditable({
  label,
  valor,
  placeholder,
  icono,
  onGuardar,
}: {
  label: string;
  valor: string | null | undefined;
  placeholder: string;
  icono: React.ReactNode;
  onGuardar: (v: string) => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [val, setVal] = useState(valor ?? "");
  const [guardando, startGuardando] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setVal(valor ?? "");
  }, [valor]);

  const guardar = () => {
    if (val === (valor ?? "")) { setEditando(false); return; }
    startGuardando(async () => {
      await onGuardar(val);
      setEditando(false);
    });
  };

  if (editando) {
    return (
      <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-input-bg border border-input-focus/50">
        <span className="text-muted-foreground shrink-0">{icono}</span>
        <input
          ref={inputRef}
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={guardar}
          onKeyDown={(e) => {
            if (e.key === "Enter") guardar();
            if (e.key === "Escape") { setVal(valor ?? ""); setEditando(false); }
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-xs text-foreground placeholder:text-input-placeholder outline-none"
        />
        {guardando
          ? <Loader2 className="h-3 w-3 text-primary animate-spin shrink-0" />
          : <Check className="h-3 w-3 text-primary shrink-0" />}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setEditando(true); }}
      className="w-full flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-muted transition-colors group text-left"
      title={`Editar ${label}`}
    >
      <span className="text-muted-foreground group-hover:text-foreground shrink-0 transition-colors">{icono}</span>
      <span className={cn(
        "flex-1 text-xs truncate",
        valor ? "text-text-secondary" : "text-muted-foreground italic"
      )}>
        {valor || placeholder}
      </span>
    </button>
  );
}

// ── Panel principal ───────────────────────────────────────────────────────────

const CLASIFICACION_OPCIONES: {
  valor: Exclude<ClasificacionConversacion, "NINGUNA">;
  label: string;
  icono: React.ReactNode;
  color: string;
  colorActivo: string;
}[] = [
  {
    valor: "POSTVENTA",
    label: "Postventa",
    icono: <ShoppingBag className="h-3 w-3" />,
    color: "text-stage-amber-text border-stage-amber-border bg-stage-amber-muted hover:bg-stage-amber-muted/70",
    colorActivo: "text-stage-amber-text border-2 border-stage-amber bg-stage-amber-muted ring-2 ring-stage-amber/20",
  },
  {
    valor: "COMERCIAL",
    label: "Comercial",
    icono: <TrendingUp className="h-3 w-3" />,
    color: "text-primary border-primary-border bg-primary-muted hover:bg-primary-muted/70",
    colorActivo: "text-primary border-2 border-primary bg-primary-muted ring-2 ring-primary/20",
  },
  {
    valor: "SOPORTE",
    label: "Soporte",
    icono: <Headphones className="h-3 w-3" />,
    color: "text-stage-cyan-text border-stage-cyan-border bg-stage-cyan-muted hover:bg-stage-cyan-muted/70",
    colorActivo: "text-stage-cyan-text border-2 border-stage-cyan bg-stage-cyan-muted ring-2 ring-stage-cyan/20",
  },
];

// ── Tarjeta editable de la oportunidad activa (solo conversaciones Comercial) ──

function TarjetaOportunidadEditable({
  oportunidad,
  onGuardado,
}: {
  oportunidad: OportunidadActivaResumen;
  onGuardado: () => void;
}) {
  const [tagsDisponibles, setTagsDisponibles] = useState<Tag[]>([]);
  const [tagIds, setTagIds] = useState<string[]>(oportunidad.tags.map((t) => t.tagId));
  const [stageId, setStageId] = useState(oportunidad.stageId);
  const [pipelineId, setPipelineId] = useState(oportunidad.pipelineId);
  const [stageNombre, setStageNombre] = useState(oportunidad.stage?.nombre ?? oportunidad.etapa);
  const [stageColor, setStageColor] = useState(oportunidad.stage?.color ?? null);
  const [fechaCierre, setFechaCierre] = useState<Date | undefined>(oportunidad.fechaCierre ?? undefined);
  const [nota, setNota] = useState(oportunidad.notas ?? "");
  const [guardando, startGuardando] = useTransition();

  // Re-sincronizar campos locales cuando cambia la oportunidad (otra
  // conversación seleccionada, o refresco tras guardar/clasificar).
  useEffect(() => {
    setTagIds(oportunidad.tags.map((t) => t.tagId));
    setStageId(oportunidad.stageId);
    setPipelineId(oportunidad.pipelineId);
    setStageNombre(oportunidad.stage?.nombre ?? oportunidad.etapa);
    setStageColor(oportunidad.stage?.color ?? null);
    setFechaCierre(oportunidad.fechaCierre ?? undefined);
    setNota(oportunidad.notas ?? "");
  }, [oportunidad]);

  useEffect(() => {
    obtenerTagsAction().then(setTagsDisponibles);
  }, []);

  const guardar = () => {
    startGuardando(async () => {
      const result = await actualizarOportunidad(oportunidad.id, {
        stageId: stageId ?? undefined,
        tagIds,
        notas: nota,
        ...(fechaCierre ? { fechaCierre } : {}),
      });
      if (!result.exito) {
        toast.error(result.error);
        return;
      }
      toast.success("Oportunidad actualizada");
      onGuardado();
    });
  };

  return (
    <div className="mx-2 px-3 py-2.5 rounded-xl bg-card border border-card-border space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-3.5 w-3.5 text-primary shrink-0" />
        <p className="text-xs font-semibold text-foreground truncate flex-1">{oportunidad.titulo}</p>
      </div>

      <div className="space-y-1">
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Etapa</p>
        <div className="[&>button]:w-full">
          <SelectorPipelineStage
            pipelineId={pipelineId}
            stageId={stageId}
            stageNombre={stageNombre}
            stageColor={stageColor}
            onSelect={(nuevoStageId, nuevoPipelineId, nuevoStageNombre, nuevoStageColor) => {
              setStageId(nuevoStageId);
              setPipelineId(nuevoPipelineId);
              setStageNombre(nuevoStageNombre);
              setStageColor(nuevoStageColor);
            }}
          />
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Etiquetas</p>
        <SelectorTags tags={tagsDisponibles} seleccionados={tagIds} onChange={setTagIds} placeholder="Agregar etiqueta..." />
      </div>

      <div className="space-y-1">
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Fecha de cierre</p>
        <SmartDatePicker value={fechaCierre} onChange={setFechaCierre} presets={[]} placeholder="Sin fecha" className="gap-2" />
      </div>

      <div className="space-y-1">
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Nota</p>
        <textarea
          rows={2}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Agrega una nota..."
          className="w-full resize-none rounded-xl border border-input bg-input-bg px-3 py-2 text-xs text-foreground placeholder:text-input-placeholder outline-none focus:border-input-focus/50 transition-colors"
        />
      </div>

      <button
        type="button"
        disabled={guardando}
        onClick={guardar}
        className="flex w-full items-center justify-center gap-1.5 text-[11px] font-semibold text-primary-foreground bg-primary hover:bg-primary-hover rounded-lg px-3 py-1.5 transition-all hover:scale-[1.02] disabled:opacity-50 shadow-sm"
      >
        {guardando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        Guardar cambios
      </button>

      <a
        href={`/crm/oportunidades/${oportunidad.id}`}
        className="flex w-full items-center justify-center text-[11px] font-medium text-primary hover:text-primary-hover transition-colors"
      >
        Abrir oportunidad completa
      </a>
    </div>
  );
}

// ── Historial: últimas oportunidades anteriores del contacto ─────────────────

function SeccionOportunidadesAnteriores({
  contactoId,
  excluirId,
}: {
  contactoId: string;
  excluirId?: string | null;
}) {
  const [abierta, setAbierta] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [items, setItems] = useState<OportunidadAnterior[]>([]);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    obtenerOportunidadesAnterioresContactoAction(contactoId, excluirId).then((r) => {
      if (cancelado) return;
      setItems(r);
      setCargando(false);
    });
    return () => { cancelado = true; };
  }, [contactoId, excluirId]);

  if (!cargando && items.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="w-full flex items-center gap-1.5 pt-2 pb-1 px-3"
      >
        <History className="h-3 w-3 text-muted-foreground shrink-0" />
        <p className="flex-1 text-left text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
          Oportunidades anteriores
        </p>
        {items.length > 0 && (
          <span className="text-[9px] font-semibold text-muted-foreground tabular-nums">{items.length}</span>
        )}
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform shrink-0", !abierta && "-rotate-90")} />
      </button>

      {abierta && (
        <div className="mx-2 mb-1 rounded-xl border border-card-border bg-card divide-y divide-card-divider overflow-hidden">
          {cargando ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
            </div>
          ) : (
            items.map((op) => {
              const estado = op.stage?.esGanado
                ? { label: "Ganada", dot: "bg-success" }
                : op.stage?.esPerdido
                ? { label: "Perdida", dot: "bg-danger" }
                : { label: "Cerrada", dot: "bg-info" };
              const fecha = op.fechaGanada ?? op.fechaPerdida ?? op.actualizadoEn;
              return (
                <a
                  key={op.id}
                  href={`/crm/oportunidades/${op.id}`}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors min-w-0"
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", estado.dot)} />
                  <span className="flex-1 min-w-0 text-[11px] text-text-secondary truncate">{op.titulo}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{estado.label}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                    {format(new Date(fecha), "dd MMM yyyy", { locale: es })}
                  </span>
                </a>
              );
            })
          )}
        </div>
      )}
    </>
  );
}

export function PanelContactoInbox({ conversacion, onContactoActualizado, onConversacionActualizada }: PanelContactoInboxProps) {
  const contacto = conversacion.contacto;
  const [vinculando, startVinculando] = useTransition();
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<BuscarResultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [mostrarBusqueda, setMostrarBusqueda] = useState(false);
  const [clasificando, startClasificando] = useTransition();

  const nombreCompleto =
    `${contacto.nombre} ${contacto.apellido}`.trim() || contacto.telefonoPrincipal || "Sin nombre";

  // ── Buscar contactos con debounce ───────────────────────────────────────────
  useEffect(() => {
    if (!busqueda.trim()) { setResultados([]); return; }
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await buscarContactosAction(busqueda);
        setResultados(r.filter((c) => c.id !== contacto.id) as BuscarResultado[]);
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda, contacto.id]);

  // ── Actualizar campo del contacto ───────────────────────────────────────────
  const actualizarCampo = async (campo: string, valor: string) => {
    const result = await actualizarContacto(contacto.id, { [campo]: valor });
    if (!result.exito) {
      toast.error(result.error);
      return;
    }
    onContactoActualizado(conversacion.id, {
      ...contacto,
      [campo]: valor || null,
    });
    toast.success("Guardado");
  };

  // ── Guardar nombre (nombre + apellido) ──────────────────────────────────────
  const guardarNombre = async (valorCompleto: string) => {
    const partes = valorCompleto.trim().split(/\s+/);
    const nombre = partes[0] ?? "";
    const apellido = partes.slice(1).join(" ");
    const result = await actualizarContacto(contacto.id, { nombre, apellido });
    if (!result.exito) { toast.error(result.error); return; }
    onContactoActualizado(conversacion.id, {
      ...contacto,
      nombre,
      apellido,
    });
    toast.success("Nombre guardado");
  };

  // ── Vincular a contacto existente ───────────────────────────────────────────
  const handleVincular = (candidato: BuscarResultado) => {
    startVinculando(async () => {
      const result = await vincularConversacionAContacto(conversacion.id, candidato.id);
      if (!result.ok) { toast.error(result.error); return; }
      onContactoActualizado(conversacion.id, {
        id: candidato.id,
        nombre: candidato.nombre,
        apellido: candidato.apellido,
        email: candidato.email,
        telefonoPrincipal: candidato.telefonoPrincipal,
        avatarUrl: null,
      });
      setMostrarBusqueda(false);
      setBusqueda("");
      setResultados([]);
      toast.success(`Vinculado a ${candidato.nombre} ${candidato.apellido}`.trim());
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background-subtle border-l border-border">
      {/* Header del contacto */}
      <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
        <div className="flex items-start gap-3">
          <AvatarContacto
            nombre={contacto.nombre}
            apellido={contacto.apellido}
            avatarUrl={contacto.avatarUrl}
            className="h-10 w-10 text-sm font-bold"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground leading-tight truncate">{nombreCompleto}</p>
            {conversacion.cuentaCanal && (
              <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-semibold uppercase tracking-wide text-badge-text bg-badge-bg border border-badge-border rounded-full px-2 py-0.5">
                {conversacion.cuentaCanal.canal.replace("_lite", "").replace("_", " ")}
                <span className="text-muted-foreground">·</span>
                {conversacion.cuentaCanal.nombre}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Campos editables */}
      <div className="flex-1 inbox-scroll px-2 py-2 space-y-0.5">

        {/* Nombre */}
        <CampoEditable
          label="Nombre"
          valor={nombreCompleto !== contacto.telefonoPrincipal ? nombreCompleto : null}
          placeholder="Nombre completo"
          icono={<User className="h-3.5 w-3.5" />}
          onGuardar={guardarNombre}
        />

        {/* Teléfono / WhatsApp ID */}
        {esLid(conversacion.identificadorCanal) ? (
          <>
            {/* Mostrar el WA ID como referencia no editable */}
            <div className="flex items-center gap-2 py-2 px-3 rounded-xl">
              <Smartphone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground truncate font-mono">
                  {formatearIdentificadorWA(conversacion.identificadorCanal)}
                </p>
                <p className="text-[9px] text-muted-foreground">Número privado — no disponible</p>
              </div>
            </div>
            {/* Campo para ingresar el número real cuando el agente lo consiga */}
            <CampoEditable
              label="Teléfono real"
              valor={contacto.telefonoPrincipal}
              placeholder="Agregar cuando lo consigas"
              icono={<Phone className="h-3.5 w-3.5" />}
              onGuardar={(v) => actualizarCampo("telefonoPrincipal", v)}
            />
          </>
        ) : conversacion.cuentaCanal?.canal === "instagram" ? (
          <>
            {/* @usuario de Instagram como referencia no editable — Instagram no comparte teléfono */}
            <div className="flex items-center gap-2 py-2 px-3 rounded-xl">
              <Camera className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground truncate font-mono">
                  {conversacion.handleCanal ? `@${conversacion.handleCanal}` : `ID: ${conversacion.identificadorCanal ?? "—"}`}
                </p>
                <p className="text-[9px] text-muted-foreground">Instagram no comparte el teléfono del contacto</p>
              </div>
            </div>
            <CampoEditable
              label="Teléfono"
              valor={contacto.telefonoPrincipal}
              placeholder="Agregar teléfono si lo consigues"
              icono={<Phone className="h-3.5 w-3.5" />}
              onGuardar={(v) => actualizarCampo("telefonoPrincipal", v)}
            />
          </>
        ) : (
          <CampoEditable
            label="Teléfono"
            valor={contacto.telefonoPrincipal}
            placeholder="Agregar teléfono"
            icono={<Phone className="h-3.5 w-3.5" />}
            onGuardar={(v) => actualizarCampo("telefonoPrincipal", v)}
          />
        )}

        {/* Email */}
        <CampoEditable
          label="Email"
          valor={contacto.email}
          placeholder="Agregar email"
          icono={<Mail className="h-3.5 w-3.5" />}
          onGuardar={(v) => actualizarCampo("email", v)}
        />

        {/* Separador */}
        <div className="pt-2 pb-1 px-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Vincular</p>
        </div>

        {/* Botón vincular / sección búsqueda */}
        {!mostrarBusqueda ? (
          <button
            type="button"
            onClick={() => setMostrarBusqueda(true)}
            className="w-full flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-muted transition-colors text-left"
          >
            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Vincular a contacto existente</span>
          </button>
        ) : (
          <div className="px-1 space-y-1.5">
            <div className="flex items-center gap-1.5 bg-input-bg border border-input rounded-xl px-3 py-2">
              <Search className="h-3 w-3 text-muted-foreground shrink-0" />
              <input
                autoFocus
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre, teléfono…"
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-input-placeholder outline-none"
              />
              {buscando
                ? <Loader2 className="h-3 w-3 text-muted-foreground animate-spin shrink-0" />
                : <button type="button" onClick={() => { setMostrarBusqueda(false); setBusqueda(""); setResultados([]); }}>
                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </button>}
            </div>

            {resultados.length > 0 && (
              <div className="rounded-xl border border-card-border bg-dropdown overflow-hidden divide-y divide-card-divider">
                {resultados.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={vinculando}
                    onClick={() => handleVincular(c)}
                    className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <div className="h-6 w-6 rounded-full bg-badge-bg border border-border flex items-center justify-center text-[9px] font-bold text-badge-text shrink-0">
                      {`${c.nombre[0] ?? ""}${c.apellido[0] ?? ""}`.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {`${c.nombre} ${c.apellido}`.trim()}
                      </p>
                      {(c.telefonoPrincipal || c.empresa?.nombre) && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {c.telefonoPrincipal ?? c.empresa?.nombre}
                        </p>
                      )}
                    </div>
                    {vinculando && <Loader2 className="h-3 w-3 text-muted-foreground animate-spin shrink-0" />}
                  </button>
                ))}
              </div>
            )}

            {busqueda.trim() && !buscando && resultados.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-2">Sin resultados</p>
            )}
          </div>
        )}

        {/* Info del canal */}
        {conversacion.cuentaCanal && (
          <>
            <div className="pt-2 pb-1 px-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Canal</p>
            </div>
            <div className="flex items-center gap-2 py-2 px-3">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-text-secondary truncate">{conversacion.cuentaCanal.nombre}</p>
                <p className="text-[10px] text-muted-foreground truncate">{conversacion.cuentaCanal.identificador}</p>
              </div>
            </div>
          </>
        )}

        {/* Clasificación de conversación — visible siempre que haya una
            clasificación aplicada (Comercial/Postventa/Soporte) o quede una
            oportunidad finalizada (ganada o perdida) sin resolver, para no
            perder de vista cuál es una vez aplicada (antes desaparecía en
            cuanto se limpiaba la referencia, ej. al clasificar Comercial —
            ver crearOportunidadDesdeConversacion). */}
        {(conversacion.oportunidadGanadaRel || conversacion.clasificacion !== "NINGUNA") && (
          <>
            <div className="pt-2 pb-1 px-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Clasificación de conversación</p>
            </div>
            <div className="mx-2 px-3 py-2.5 rounded-xl bg-card border border-card-border space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {CLASIFICACION_OPCIONES.map((opcion) => {
                  const activo = conversacion.clasificacion === opcion.valor;
                  return (
                    <button
                      key={opcion.valor}
                      type="button"
                      disabled={clasificando}
                      onClick={() => {
                        const nuevaClasificacion = activo ? "NINGUNA" : opcion.valor;
                        startClasificando(async () => {
                          const result = await clasificarConversacion({
                            conversacionId: conversacion.id,
                            clasificacion: nuevaClasificacion,
                          });
                          if (!result.ok) {
                            toast.error(result.error ?? "Error al clasificar");
                            return;
                          }
                          if (result.oportunidadId) toast.success("Oportunidad creada");
                          // Comercial sin oportunidadId no siempre es error: puede
                          // que el contacto ya tenga una activa en otra parte — antes
                          // esto quedaba en silencio y parecía que no había pasado nada.
                          else if (result.aviso) toast.warning(result.aviso);
                          onConversacionActualizada(conversacion.id, result.conversacion);
                        });
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all disabled:opacity-60",
                        activo ? opcion.colorActivo : opcion.color
                      )}
                    >
                      {opcion.icono}
                      {opcion.label}
                    </button>
                  );
                })}
                {clasificando && <Loader2 className="h-3 w-3 text-muted-foreground animate-spin shrink-0" />}
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug">
                Puedes cambiarla en cualquier momento.
              </p>
            </div>
          </>
        )}

        {/* Oportunidad activa: editable cuando la conversación es Comercial o
            todavía no se clasificó (NINGUNA — aún no hay oportunidad
            finalizada de por medio, así que se puede seguir editando la
            activa desde acá). De solo lectura solo para Postventa/Soporte,
            donde el foco de la conversación ya no es esa venta. */}
        {(() => {
          const opActivaRel = conversacion.oportunidades.find((o) => {
            const op = o.oportunidad;
            if (!op) return false;
            const esGanada = op.stage?.esGanado || op.etapa === "GANADO";
            const esPerdida = op.stage?.esPerdido || op.etapa === "PERDIDO";
            return !esGanada && !esPerdida;
          });
          if (!opActivaRel) return null;
          const op = opActivaRel.oportunidad;

          if (conversacion.clasificacion === "COMERCIAL" || conversacion.clasificacion === "NINGUNA") {
            return (
              <>
                <div className="pt-2 pb-1 px-3">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Oportunidad actual</p>
                </div>
                <TarjetaOportunidadEditable
                  oportunidad={op}
                  onGuardado={() => onConversacionActualizada(conversacion.id)}
                />
              </>
            );
          }

          const etapaLabel = op.stage?.nombre ?? op.etapa;
          const stageColor = op.stage?.color ?? "var(--text-muted)";
          return (
            <>
              <div className="pt-2 pb-1 px-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Oportunidad</p>
              </div>
              <div className="mx-2 px-3 py-2.5 rounded-xl bg-card border border-card-border space-y-1.5">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-primary shrink-0" />
                  <p className="text-xs font-semibold text-foreground truncate flex-1">{op.titulo}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: stageColor }}
                  />
                  <span className="text-[10px] text-muted-foreground">{etapaLabel}</span>
                  {op.valor > 0 && (
                    <span className="ml-auto text-[10px] font-semibold text-primary tabular-nums">
                      {op.moneda} {Number(op.valor).toLocaleString("es-PE", { minimumFractionDigits: 0 })}
                    </span>
                  )}
                </div>
                <a
                  href={`/crm/oportunidades/${op.id}`}
                  className="mt-1 flex w-full items-center justify-center gap-1.5 text-[11px] font-medium text-text-secondary bg-button-secondary-bg hover:bg-button-secondary-hover border border-button-secondary-border rounded-lg px-3 py-1.5 transition-all"
                >
                  Ver oportunidad
                </a>
              </div>
            </>
          );
        })()}

        {/* Última oportunidad finalizada relacionada (solo lectura — Postventa
            / Soporte / sin clasificar) — ganada o perdida se tratan igual:
            el agente reclasifica desde acá arriba en vez de que se cree un
            prospecto nuevo solo. */}
        {conversacion.oportunidadGanadaRel && (() => {
          const rel = conversacion.oportunidadGanadaRel;
          const esPerdida = rel.stage?.esPerdido || rel.etapa === "PERDIDO";
          const fecha = esPerdida ? rel.fechaPerdida : rel.fechaGanada;
          return (
            <>
              <div className="pt-2 pb-1 px-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Oportunidad</p>
              </div>
              <div className="mx-2 px-3 py-2.5 rounded-xl bg-card border border-card-border space-y-1.5">
                <div className="flex items-center gap-2">
                  {esPerdida
                    ? <XCircle className="h-3.5 w-3.5 text-danger shrink-0" />
                    : <Trophy className="h-3.5 w-3.5 text-stage-amber shrink-0" />}
                  <p className="text-xs font-semibold text-foreground truncate flex-1">
                    {rel.titulo}
                  </p>
                  <span className={cn(
                    "shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border",
                    esPerdida
                      ? "bg-danger-muted text-danger-text border-danger-border"
                      : "bg-stage-amber-muted text-stage-amber-text border-stage-amber-border"
                  )}>
                    {esPerdida ? "Perdida" : "Ganada"}
                  </span>
                </div>
                {fecha && (
                  <p className="text-[10px] text-muted-foreground">
                    {esPerdida ? "Perdida" : "Ganada"} el {format(new Date(fecha), "dd/MM/yyyy", { locale: es })}
                  </p>
                )}
                <a
                  href={`/crm/oportunidades/${rel.id}`}
                  className="mt-1 flex w-full items-center justify-center gap-1.5 text-[11px] font-medium text-text-secondary bg-button-secondary-bg hover:bg-button-secondary-hover border border-button-secondary-border rounded-lg px-3 py-1.5 transition-all"
                >
                  Ver oportunidad
                </a>
              </div>
            </>
          );
        })()}

        {/* Oportunidades anteriores del contacto (últimas 5) */}
        <SeccionOportunidadesAnteriores
          contactoId={contacto.id}
          excluirId={
            conversacion.oportunidades.find((o) => {
              const op = o.oportunidad;
              if (!op) return false;
              const esGanada = op.stage?.esGanado || op.etapa === "GANADO";
              const esPerdida = op.stage?.esPerdido || op.etapa === "PERDIDO";
              return !esGanada && !esPerdida;
            })?.oportunidad.id ?? conversacion.oportunidadGanadaRel?.id ?? null
          }
        />
      </div>
    </div>
  );
}
