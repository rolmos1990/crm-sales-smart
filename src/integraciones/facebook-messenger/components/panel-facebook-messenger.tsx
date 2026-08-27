"use client";

import { useEffect, useState, useTransition } from "react";
import { Trash2, Loader2, CheckCircle2, AlertCircle, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { eliminarCuentaFacebookMessenger } from "../actions";

interface CuentaFB {
  id: string;
  nombre: string;
  identificador: string;
  activa: boolean;
  /** Estado de conexión (FR-008) — ver queries.ts. */
  estadoConexion: "ACTIVA" | "CON_PROBLEMA";
}

interface PanelFacebookMessengerProps {
  cuentas: CuentaFB[];
  facebookConfigurado: boolean;
  /** Mensaje de resultado tras OAuth redirect */
  notificacion?:
    | "conectado"
    | "sin_paginas"
    | "cancelado"
    | "state"
    | "sesion"
    | "token"
    | "no_configurado"
    | "parametros"
    | "oauth"
    | "error"
    | null;
}

// ── Botón "Conectar Facebook Messenger" ───────────────────────────────────────

function BotonConectarFacebookMessenger({
  label = "Conectar Facebook Messenger",
  disabled = false,
}: {
  label?: string;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <button
        disabled
        className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-stone-800 border border-white/10 text-stone-500 text-sm font-semibold cursor-not-allowed"
      >
        <span className="text-base leading-none">💬</span>
        {label}
      </button>
    );
  }

  return (
    <a href="/api/integraciones/facebook-messenger/oauth" className="inline-block">
      <button className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-gradient-to-br from-[#0084FF] to-[#00C6FF] hover:brightness-110 text-white text-sm font-semibold transition-all hover:scale-[1.02] shadow-lg">
        <span className="text-base leading-none">💬</span>
        {label}
      </button>
    </a>
  );
}

// ── Tarjeta de Página conectada ────────────────────────────────────────────────

function TarjetaCuentaFB({
  cuenta,
  onEliminada,
}: {
  cuenta: CuentaFB;
  onEliminada: (id: string) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleEliminar = () => {
    startTransition(async () => {
      const r = await eliminarCuentaFacebookMessenger(cuenta.id);
      if (r.exito) {
        toast.success(`${cuenta.nombre} desconectada`);
        onEliminada(cuenta.id);
      } else {
        toast.error(r.error ?? "Error al desconectar");
      }
      setConfirmando(false);
    });
  };

  const activa = cuenta.estadoConexion === "ACTIVA";

  return (
    <div className="rounded-xl border border-white/10 bg-white/4 px-4 py-3 space-y-2.5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#0084FF]/30 to-[#00C6FF]/30 border border-white/10 flex items-center justify-center shrink-0 text-lg">
          💬
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-stone-100 truncate">{cuenta.nombre}</p>
          <p className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
            <MessageCircle className="h-3 w-3" />
            Mensajes de Messenger activos
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span
            className={
              activa
                ? "text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-lime-500/10 text-lime-400 border-lime-500/20"
                : "text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20"
            }
          >
            {activa ? "Activa" : "Con problema"}
          </span>

          {confirmando ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setConfirmando(false)}
                className="text-[11px] text-stone-500 hover:text-stone-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminar}
                disabled={isPending}
                className="text-[11px] font-semibold text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
              >
                {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                Confirmar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmando(true)}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-stone-500 hover:text-red-400 hover:bg-red-500/8 transition-colors"
              title="Desconectar cuenta"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Estado de conexión (FR-008) — visibilidad sin depender de un mensaje real */}
      {!activa && (
        <div className="flex items-start gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/8 px-2.5 py-1.5 text-[11px] text-amber-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400" />
          <span>
            No pudimos confirmar que esta conexión esté funcionando (token inválido o ausente) — reconecta la Página con el botón de arriba.
          </span>
        </div>
      )}
    </div>
  );
}

// ── Aviso de no configurado (solo admins) ─────────────────────────────────────

function AvisoSinConfiguracion() {
  return (
    <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 px-4 py-3 flex items-start gap-3">
      <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-amber-300">Configuración pendiente</p>
        <p className="text-xs text-amber-400/70 mt-0.5 leading-relaxed">
          Esta integración requiere que el administrador técnico configure las credenciales de Meta en el servidor. Una vez configuradas, podrás conectar tu Página de Facebook aquí.
        </p>
      </div>
    </div>
  );
}

// ── Panel principal ────────────────────────────────────────────────────────────

export function PanelFacebookMessenger({
  cuentas: cuentasIniciales,
  facebookConfigurado,
  notificacion,
}: PanelFacebookMessengerProps) {
  const [cuentas, setCuentas] = useState(cuentasIniciales);

  useEffect(() => {
    if (notificacion === "conectado") {
      toast.success("¡Facebook Messenger conectado exitosamente!");
    } else if (notificacion === "cancelado") {
      toast.info("Conexión cancelada. No se otorgaron permisos.");
    } else if (notificacion === "sin_paginas") {
      toast.error(
        "No encontramos ninguna Página de Facebook asociada a tu cuenta. Asegúrate de ser administrador de la Página que quieres conectar.",
        { duration: 8000 }
      );
    } else if (notificacion === "state" || notificacion === "sesion") {
      toast.error("La conexión expiró o no se pudo verificar. Inténtalo de nuevo.");
    } else if (notificacion === "token") {
      toast.error("No se pudo completar la conexión con Facebook. Inténtalo de nuevo en unos minutos.");
    } else if (notificacion === "no_configurado") {
      toast.error("Esta integración aún no está configurada. Contacta a soporte técnico.");
    } else if (notificacion === "parametros" || notificacion === "oauth" || notificacion === "error") {
      toast.error("Ocurrió un error al conectar. Inténtalo de nuevo.");
    }
  }, [notificacion]);

  const cuentasActivas = cuentas.filter((c) => c.activa);

  return (
    <div className="space-y-6">
      {cuentasActivas.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-stone-100">
                {cuentasActivas.length === 1 ? "Página conectada" : `${cuentasActivas.length} Páginas conectadas`}
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Los mensajes de Messenger llegan al inbox del CRM automáticamente.
              </p>
            </div>
          </div>

          {cuentas.map((cuenta) => (
            <TarjetaCuentaFB
              key={cuenta.id}
              cuenta={cuenta}
              onEliminada={(id) => setCuentas((prev) => prev.filter((c) => c.id !== id))}
            />
          ))}

          {facebookConfigurado && (
            <div className="pt-1">
              <BotonConectarFacebookMessenger label="Conectar otra Página" />
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-14 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0084FF]/15 to-[#00C6FF]/15 border border-white/10 flex items-center justify-center text-3xl">
            💬
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-stone-300">Sin Páginas conectadas</p>
            <p className="text-xs text-stone-500 max-w-xs leading-relaxed">
              Conecta la Página de Facebook de tu negocio para recibir y responder mensajes de Messenger desde el CRM.
            </p>
          </div>

          {facebookConfigurado ? (
            <BotonConectarFacebookMessenger />
          ) : (
            <AvisoSinConfiguracion />
          )}
        </div>
      )}

      {!facebookConfigurado && cuentasActivas.length === 0 && <AvisoSinConfiguracion />}

      <div className="rounded-2xl border border-white/8 bg-white/2 p-4 space-y-2.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-stone-600">Qué incluye</p>
        <ul className="space-y-1.5">
          {[
            "Mensajes de Messenger de tus clientes",
            "Imágenes y videos enviados por mensaje",
            "Creación automática de contactos y oportunidades",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2 text-xs text-stone-400">
              <CheckCircle2 className="h-3.5 w-3.5 text-lime-500 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
