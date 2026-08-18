"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { toast } from "sonner";
import { User, Phone, Mail, Building2, Link2, Check, Loader2, Search, X, Smartphone, Trophy, ShoppingBag, Headphones, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { esLid, formatearIdentificadorWA } from "@/lib/whatsapp-utils";
import { actualizarContacto, buscarContactosAction } from "@/crm/contactos/actions";
import { vincularConversacionAContacto, clasificarConversacion } from "../actions";
import type { ConversacionResumen, ClasificacionConversacion } from "../types";

type Contacto = ConversacionResumen["contacto"];

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
  onClasificacionCambiada?: (conversacionId: string, clasificacion: ClasificacionConversacion) => void;
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
      <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-white dark:bg-white/6 border border-lime-400/40 dark:border-lime-400/30">
        <span className="text-stone-400 dark:text-stone-500 shrink-0">{icono}</span>
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
          className="flex-1 bg-transparent text-xs text-stone-800 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-600 outline-none"
        />
        {guardando
          ? <Loader2 className="h-3 w-3 text-lime-600 dark:text-lime-400 animate-spin shrink-0" />
          : <Check className="h-3 w-3 text-lime-600 dark:text-lime-400 shrink-0" />}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setEditando(true); }}
      className="w-full flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-stone-100 dark:hover:bg-white/5 transition-colors group text-left"
      title={`Editar ${label}`}
    >
      <span className="text-stone-400 dark:text-stone-600 group-hover:text-stone-600 dark:group-hover:text-stone-400 shrink-0 transition-colors">{icono}</span>
      <span className={cn(
        "flex-1 text-xs truncate",
        valor ? "text-stone-600 dark:text-stone-300" : "text-stone-400 dark:text-stone-600 italic"
      )}>
        {valor || placeholder}
      </span>
    </button>
  );
}

// ── Panel principal ───────────────────────────────────────────────────────────

const CLASIFICACION_CFG: Record<ClasificacionConversacion, { label: string; icono: React.ReactNode; color: string }> = {
  NINGUNA:   { label: "Sin clasificación", icono: null, color: "text-stone-500 dark:text-stone-500" },
  POSTVENTA: { label: "Postventa",  icono: <ShoppingBag className="h-3 w-3" />, color: "text-amber-600 dark:text-amber-400" },
  SOPORTE:   { label: "Soporte",    icono: <Headphones  className="h-3 w-3" />, color: "text-blue-600 dark:text-blue-400"  },
  COMERCIAL: { label: "Comercial",  icono: <TrendingUp  className="h-3 w-3" />, color: "text-lime-600 dark:text-lime-400"  },
};

export function PanelContactoInbox({ conversacion, onContactoActualizado, onClasificacionCambiada }: PanelContactoInboxProps) {
  const contacto = conversacion.contacto;
  const [vinculando, startVinculando] = useTransition();
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<BuscarResultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [mostrarBusqueda, setMostrarBusqueda] = useState(false);
  const [clasificando, startClasificando] = useTransition();

  const iniciales =
    `${contacto.nombre[0] ?? ""}${contacto.apellido[0] ?? ""}`.toUpperCase() || "?";

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
      });
      setMostrarBusqueda(false);
      setBusqueda("");
      setResultados([]);
      toast.success(`Vinculado a ${candidato.nombre} ${candidato.apellido}`.trim());
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-stone-50/60 dark:bg-white/[0.02] border-l border-stone-200 dark:border-white/8">
      {/* Header del contacto */}
      <div className="px-4 pt-4 pb-3 border-b border-stone-200 dark:border-white/8 shrink-0">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-lime-500/20 to-emerald-500/10 dark:from-lime-500/30 dark:to-emerald-500/20 border border-lime-500/25 dark:border-lime-500/20 flex items-center justify-center text-sm font-bold text-lime-700 dark:text-lime-300 shrink-0">
            {iniciales}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-stone-900 dark:text-stone-100 leading-tight truncate">{nombreCompleto}</p>
            {conversacion.cuentaCanal && (
              <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-500 bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/8 rounded-full px-2 py-0.5">
                {conversacion.cuentaCanal.canal.replace("_lite", "").replace("_", " ")}
                <span className="text-stone-300 dark:text-stone-600">·</span>
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
              <Smartphone className="h-3.5 w-3.5 text-stone-400 dark:text-stone-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-stone-500 dark:text-stone-500 truncate font-mono">
                  {formatearIdentificadorWA(conversacion.identificadorCanal)}
                </p>
                <p className="text-[9px] text-stone-400 dark:text-stone-600">Número privado — no disponible</p>
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
          <p className="text-[9px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-600">Vincular</p>
        </div>

        {/* Botón vincular / sección búsqueda */}
        {!mostrarBusqueda ? (
          <button
            type="button"
            onClick={() => setMostrarBusqueda(true)}
            className="w-full flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-stone-100 dark:hover:bg-white/5 transition-colors text-left"
          >
            <Link2 className="h-3.5 w-3.5 text-stone-400 dark:text-stone-600" />
            <span className="text-xs text-stone-500 dark:text-stone-500">Vincular a contacto existente</span>
          </button>
        ) : (
          <div className="px-1 space-y-1.5">
            <div className="flex items-center gap-1.5 bg-white dark:bg-white/6 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2">
              <Search className="h-3 w-3 text-stone-400 dark:text-stone-500 shrink-0" />
              <input
                autoFocus
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre, teléfono…"
                className="flex-1 bg-transparent text-xs text-stone-800 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-600 outline-none"
              />
              {buscando
                ? <Loader2 className="h-3 w-3 text-stone-400 dark:text-stone-500 animate-spin shrink-0" />
                : <button type="button" onClick={() => { setMostrarBusqueda(false); setBusqueda(""); setResultados([]); }}>
                    <X className="h-3 w-3 text-stone-400 dark:text-stone-600 hover:text-stone-600 dark:hover:text-stone-400" />
                  </button>}
            </div>

            {resultados.length > 0 && (
              <div className="rounded-xl border border-stone-200 dark:border-white/8 bg-white dark:bg-stone-900/80 overflow-hidden divide-y divide-stone-100 dark:divide-white/5">
                {resultados.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={vinculando}
                    onClick={() => handleVincular(c)}
                    className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 hover:bg-stone-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                  >
                    <div className="h-6 w-6 rounded-full bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-white/10 flex items-center justify-center text-[9px] font-bold text-stone-500 dark:text-stone-400 shrink-0">
                      {`${c.nombre[0] ?? ""}${c.apellido[0] ?? ""}`.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-stone-800 dark:text-stone-200 truncate">
                        {`${c.nombre} ${c.apellido}`.trim()}
                      </p>
                      {(c.telefonoPrincipal || c.empresa?.nombre) && (
                        <p className="text-[10px] text-stone-500 dark:text-stone-500 truncate">
                          {c.telefonoPrincipal ?? c.empresa?.nombre}
                        </p>
                      )}
                    </div>
                    {vinculando && <Loader2 className="h-3 w-3 text-stone-400 dark:text-stone-500 animate-spin shrink-0" />}
                  </button>
                ))}
              </div>
            )}

            {busqueda.trim() && !buscando && resultados.length === 0 && (
              <p className="text-[10px] text-stone-400 dark:text-stone-600 text-center py-2">Sin resultados</p>
            )}
          </div>
        )}

        {/* Info del canal */}
        {conversacion.cuentaCanal && (
          <>
            <div className="pt-2 pb-1 px-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-600">Canal</p>
            </div>
            <div className="flex items-center gap-2 py-2 px-3">
              <Building2 className="h-3.5 w-3.5 text-stone-400 dark:text-stone-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-stone-600 dark:text-stone-400 truncate">{conversacion.cuentaCanal.nombre}</p>
                <p className="text-[10px] text-stone-400 dark:text-stone-600 truncate">{conversacion.cuentaCanal.identificador}</p>
              </div>
            </div>
          </>
        )}

        {/* Oportunidad activa vinculada (cuando hay una oportunidad en curso) */}
        {(() => {
          const opActiva = conversacion.oportunidades.find((o) => {
            const op = o.oportunidad;
            if (!op) return false;
            const esGanada = op.stage?.esGanado || op.etapa === "GANADO";
            const esPerdida = op.stage?.esPerdido || op.etapa === "PERDIDO";
            return !esGanada && !esPerdida;
          });
          if (!opActiva) return null;
          const op = opActiva.oportunidad;
          const etapaLabel = op.stage?.nombre ?? op.etapa;
          const stageColor = op.stage?.color ?? "#94a3b8";
          return (
            <>
              <div className="pt-2 pb-1 px-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-600">Oportunidad</p>
              </div>
              <div className="mx-2 px-3 py-2.5 rounded-xl bg-white dark:bg-white/4 border border-stone-200 dark:border-white/8 space-y-1.5">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-lime-600 dark:text-lime-400 shrink-0" />
                  <p className="text-xs font-semibold text-stone-800 dark:text-stone-200 truncate flex-1">{op.titulo}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: stageColor }}
                  />
                  <span className="text-[10px] text-stone-500 dark:text-stone-400">{etapaLabel}</span>
                  {op.valor > 0 && (
                    <span className="ml-auto text-[10px] font-semibold text-lime-600 dark:text-lime-400 tabular-nums">
                      {op.moneda} {Number(op.valor).toLocaleString("es-PE", { minimumFractionDigits: 0 })}
                    </span>
                  )}
                </div>
                <a
                  href={`/crm/oportunidades/${op.id}`}
                  className="mt-1 flex w-full items-center justify-center gap-1.5 text-[11px] font-medium text-stone-600 dark:text-stone-300 bg-stone-50 dark:bg-white/6 hover:bg-stone-100 dark:hover:bg-white/10 border border-stone-200 dark:border-white/10 rounded-lg px-3 py-1.5 transition-all"
                >
                  Ver oportunidad
                </a>
              </div>
            </>
          );
        })()}

        {/* Oportunidad ganada relacionada */}
        {conversacion.oportunidadGanadaRel && (
          <>
            <div className="pt-2 pb-1 px-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-600">Oportunidad</p>
            </div>
            <div className="mx-2 px-3 py-2.5 rounded-xl bg-white dark:bg-white/4 border border-stone-200 dark:border-white/8 space-y-1.5">
              <div className="flex items-center gap-2">
                <Trophy className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                <p className="text-xs font-semibold text-stone-800 dark:text-stone-200 truncate flex-1">
                  {conversacion.oportunidadGanadaRel.titulo}
                </p>
                <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                  Ganada
                </span>
              </div>
              {conversacion.oportunidadGanadaRel.fechaGanada && (
                <p className="text-[10px] text-stone-500 dark:text-stone-500">
                  Ganada el {format(new Date(conversacion.oportunidadGanadaRel.fechaGanada), "dd/MM/yyyy", { locale: es })}
                </p>
              )}
              <a
                href={`/crm/oportunidades/${conversacion.oportunidadGanadaRel.id}`}
                className="mt-1 flex w-full items-center justify-center gap-1.5 text-[11px] font-medium text-stone-600 dark:text-stone-300 bg-stone-50 dark:bg-white/6 hover:bg-stone-100 dark:hover:bg-white/10 border border-stone-200 dark:border-white/10 rounded-lg px-3 py-1.5 transition-all"
              >
                Ver oportunidad
              </a>
            </div>
          </>
        )}

        {/* Clasificación de conversación */}
        {(conversacion.oportunidadGanadaRel || conversacion.clasificacion !== "NINGUNA") && (
          <>
            <div className="pt-2 pb-1 px-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-600">Clasificación de conversación</p>
            </div>
            <div className="mx-2 px-3 py-2.5 rounded-xl bg-white dark:bg-white/4 border border-stone-200 dark:border-white/8 space-y-2">
              {conversacion.clasificacion === "NINGUNA" ? (
                <p className="text-[11px] text-stone-400 dark:text-stone-500 italic">Sin clasificación</p>
              ) : (
                <div className={cn("flex items-center gap-2", CLASIFICACION_CFG[conversacion.clasificacion].color)}>
                  {CLASIFICACION_CFG[conversacion.clasificacion].icono}
                  <span className="text-xs font-semibold">
                    {CLASIFICACION_CFG[conversacion.clasificacion].label}
                  </span>
                </div>
              )}
              <button
                type="button"
                disabled={clasificando}
                onClick={() => {
                  startClasificando(async () => {
                    const result = await clasificarConversacion({
                      conversacionId: conversacion.id,
                      clasificacion: "NINGUNA",
                    });
                    if (result.ok) {
                      onClasificacionCambiada?.(conversacion.id, "NINGUNA");
                    } else {
                      toast.error(result.error ?? "Error al cambiar clasificación");
                    }
                  });
                }}
                className="flex w-full items-center justify-center gap-1.5 text-[11px] font-medium text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-white/5 hover:bg-stone-100 dark:hover:bg-white/8 border border-stone-200 dark:border-white/8 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50"
              >
                {clasificando
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : null}
                Cambiar clasificación
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
