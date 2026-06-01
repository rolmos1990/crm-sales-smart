"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { toast } from "sonner";
import { User, Phone, Mail, Building2, Link2, Check, Loader2, Search, X, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { esLid, formatearIdentificadorWA } from "@/lib/whatsapp-utils";
import { actualizarContacto, buscarContactosAction } from "@/crm/contactos/actions";
import { vincularConversacionAContacto } from "../actions";
import type { ConversacionResumen } from "../types";

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
  onContactoActualizado: (
    conversacionId: string,
    nuevoContacto: Contacto
  ) => void;
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
      <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-white/6 border border-lime-400/30">
        <span className="text-stone-500 shrink-0">{icono}</span>
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
          className="flex-1 bg-transparent text-xs text-stone-100 placeholder-stone-600 outline-none"
        />
        {guardando
          ? <Loader2 className="h-3 w-3 text-lime-400 animate-spin shrink-0" />
          : <Check className="h-3 w-3 text-lime-400 shrink-0" />}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setEditando(true); }}
      className="w-full flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-white/5 transition-colors group text-left"
      title={`Editar ${label}`}
    >
      <span className="text-stone-600 group-hover:text-stone-400 shrink-0 transition-colors">{icono}</span>
      <span className={cn(
        "flex-1 text-xs truncate",
        valor ? "text-stone-300" : "text-stone-600 italic"
      )}>
        {valor || placeholder}
      </span>
    </button>
  );
}

// ── Panel principal ───────────────────────────────────────────────────────────

export function PanelContactoInbox({ conversacion, onContactoActualizado }: PanelContactoInboxProps) {
  const contacto = conversacion.contacto;
  const [vinculando, startVinculando] = useTransition();
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<BuscarResultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [mostrarBusqueda, setMostrarBusqueda] = useState(false);

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
    <div className="flex flex-col h-full overflow-hidden bg-stone-950/60 border-l border-white/8">
      {/* Header del contacto */}
      <div className="px-4 pt-4 pb-3 border-b border-white/8 shrink-0">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-lime-500/30 to-emerald-500/20 border border-lime-500/20 flex items-center justify-center text-sm font-bold text-lime-300 shrink-0">
            {iniciales}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-stone-100 leading-tight truncate">{nombreCompleto}</p>
            {conversacion.cuentaCanal && (
              <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-semibold uppercase tracking-wide text-stone-500 bg-white/5 border border-white/8 rounded-full px-2 py-0.5">
                {conversacion.cuentaCanal.canal.replace("_lite", "").replace("_", " ")}
                <span className="text-stone-600">·</span>
                {conversacion.cuentaCanal.nombre}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Campos editables */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 px-2 py-2 space-y-0.5">

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
              <Smartphone className="h-3.5 w-3.5 text-stone-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-stone-500 truncate font-mono">
                  {formatearIdentificadorWA(conversacion.identificadorCanal)}
                </p>
                <p className="text-[9px] text-stone-600">Número privado — no disponible</p>
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
          <p className="text-[9px] font-bold uppercase tracking-widest text-stone-600">Vincular</p>
        </div>

        {/* Botón vincular / sección búsqueda */}
        {!mostrarBusqueda ? (
          <button
            type="button"
            onClick={() => setMostrarBusqueda(true)}
            className="w-full flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-white/5 transition-colors text-left"
          >
            <Link2 className="h-3.5 w-3.5 text-stone-600" />
            <span className="text-xs text-stone-500">Vincular a contacto existente</span>
          </button>
        ) : (
          <div className="px-1 space-y-1.5">
            <div className="flex items-center gap-1.5 bg-white/6 border border-white/10 rounded-xl px-3 py-2">
              <Search className="h-3 w-3 text-stone-500 shrink-0" />
              <input
                autoFocus
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre, teléfono…"
                className="flex-1 bg-transparent text-xs text-stone-100 placeholder-stone-600 outline-none"
              />
              {buscando
                ? <Loader2 className="h-3 w-3 text-stone-500 animate-spin shrink-0" />
                : <button type="button" onClick={() => { setMostrarBusqueda(false); setBusqueda(""); setResultados([]); }}>
                    <X className="h-3 w-3 text-stone-600 hover:text-stone-400" />
                  </button>}
            </div>

            {resultados.length > 0 && (
              <div className="rounded-xl border border-white/8 bg-stone-900/80 overflow-hidden divide-y divide-white/5">
                {resultados.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={vinculando}
                    onClick={() => handleVincular(c)}
                    className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/5 transition-colors disabled:opacity-50"
                  >
                    <div className="h-6 w-6 rounded-full bg-stone-800 border border-white/10 flex items-center justify-center text-[9px] font-bold text-stone-400 shrink-0">
                      {`${c.nombre[0] ?? ""}${c.apellido[0] ?? ""}`.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-stone-200 truncate">
                        {`${c.nombre} ${c.apellido}`.trim()}
                      </p>
                      {(c.telefonoPrincipal || c.empresa?.nombre) && (
                        <p className="text-[10px] text-stone-500 truncate">
                          {c.telefonoPrincipal ?? c.empresa?.nombre}
                        </p>
                      )}
                    </div>
                    {vinculando && <Loader2 className="h-3 w-3 text-stone-500 animate-spin shrink-0" />}
                  </button>
                ))}
              </div>
            )}

            {busqueda.trim() && !buscando && resultados.length === 0 && (
              <p className="text-[10px] text-stone-600 text-center py-2">Sin resultados</p>
            )}
          </div>
        )}

        {/* Info del canal */}
        {conversacion.cuentaCanal && (
          <>
            <div className="pt-2 pb-1 px-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-stone-600">Canal</p>
            </div>
            <div className="flex items-center gap-2 py-2 px-3">
              <Building2 className="h-3.5 w-3.5 text-stone-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-stone-400 truncate">{conversacion.cuentaCanal.nombre}</p>
                <p className="text-[10px] text-stone-600 truncate">{conversacion.cuentaCanal.identificador}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
