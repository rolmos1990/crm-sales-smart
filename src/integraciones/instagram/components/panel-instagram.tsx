"use client";

import { useEffect, useState, useTransition } from "react";
import { Trash2, Loader2, CheckCircle2, AlertCircle, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { desconectarCuentaInstagram, eliminarCuentaInstagram } from "../actions";

interface CuentaIG {
  id: string;
  nombre: string;
  identificador: string;
  activa: boolean;
  username?: string | null;
  profilePicUrl?: string | null;
}

interface PanelInstagramProps {
  instanciaId: string;
  cuentas: CuentaIG[];
  metaConfigurado: boolean;
  /** Mensaje de resultado tras OAuth redirect */
  notificacion?: "conectado" | "sin_instagram" | "cancelado" | "error" | null;
}

// ── Botón "Continuar con Instagram / Meta" ────────────────────────────────────

function BotonConectarInstagram({
  instanciaId,
  label = "Continuar con Meta",
  disabled = false,
}: {
  instanciaId: string;
  label?: string;
  disabled?: boolean;
}) {
  const oauthUrl = `/api/integraciones/instagram/oauth?instanciaId=${instanciaId}`;

  if (disabled) {
    return (
      <button
        disabled
        className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-stone-800 border border-white/10 text-stone-500 text-sm font-semibold cursor-not-allowed"
      >
        <span className="text-base leading-none">📸</span>
        {label}
      </button>
    );
  }

  return (
    <a href={oauthUrl} className="inline-block">
      <button className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-[#1877F2] hover:bg-[#166FE5] text-white text-sm font-semibold transition-all hover:scale-[1.02] shadow-lg">
        {/* Meta "f" logo en SVG mínimo */}
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white" aria-hidden="true">
          <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.027 4.388 11.024 10.125 11.927v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.953h-1.514c-1.491 0-1.956.93-1.956 1.884v2.25h3.328l-.532 3.49h-2.796v8.437C19.612 23.097 24 18.1 24 12.073z" />
        </svg>
        {label}
      </button>
    </a>
  );
}

// ── Tarjeta de cuenta conectada ────────────────────────────────────────────────

function TarjetaCuentaIG({
  cuenta,
  onEliminada,
}: {
  cuenta: CuentaIG;
  onEliminada: (id: string) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleEliminar = () => {
    startTransition(async () => {
      const r = await eliminarCuentaInstagram(cuenta.id);
      if (r.exito) {
        toast.success(`${cuenta.nombre} desconectada`);
        onEliminada(cuenta.id);
      } else {
        toast.error(r.error ?? "Error al desconectar");
      }
      setConfirmando(false);
    });
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/4 px-4 py-3">
      {/* Avatar */}
      {cuenta.profilePicUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cuenta.profilePicUrl}
          alt={cuenta.nombre}
          className="h-10 w-10 rounded-full object-cover border border-white/10 shrink-0"
        />
      ) : (
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#E1306C]/30 to-[#833AB4]/30 border border-white/10 flex items-center justify-center shrink-0 text-lg">
          📸
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-stone-100 truncate">{cuenta.nombre}</p>
        <p className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
          <MessageCircle className="h-3 w-3" />
          Mensajes directos activos
        </p>
      </div>

      {/* Estado + Eliminar */}
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-lime-500/10 text-lime-400 border-lime-500/20">
          Activa
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
          Esta integración requiere que el administrador técnico configure las credenciales de Meta en el servidor. Una vez configuradas, podrás conectar tu cuenta de Instagram aquí.
        </p>
      </div>
    </div>
  );
}

// ── Panel principal ────────────────────────────────────────────────────────────

export function PanelInstagram({
  instanciaId,
  cuentas: cuentasIniciales,
  metaConfigurado,
  notificacion,
}: PanelInstagramProps) {
  const [cuentas, setCuentas] = useState(cuentasIniciales);

  // Toast de resultado tras redirect OAuth
  useEffect(() => {
    if (notificacion === "conectado") {
      toast.success("¡Instagram conectado exitosamente!");
    } else if (notificacion === "cancelado") {
      toast.info("Conexión cancelada");
    } else if (notificacion === "sin_instagram") {
      toast.error(
        "No encontramos una cuenta de Instagram Business asociada a tu Página de Facebook. Asegúrate de tener el perfil de Instagram como cuenta de empresa o creador.",
        { duration: 8000 }
      );
    } else if (notificacion === "error") {
      toast.error("Ocurrió un error al conectar. Inténtalo de nuevo.");
    }
  }, [notificacion]);

  const cuentasActivas = cuentas.filter((c) => c.activa);

  return (
    <div className="space-y-6">

      {/* Cuentas conectadas */}
      {cuentasActivas.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-stone-100">
                {cuentasActivas.length === 1 ? "Cuenta conectada" : `${cuentasActivas.length} cuentas conectadas`}
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Los mensajes directos llegan al inbox del CRM automáticamente.
              </p>
            </div>
          </div>

          {cuentas.map((cuenta) => (
            <TarjetaCuentaIG
              key={cuenta.id}
              cuenta={cuenta}
              onEliminada={(id) => setCuentas((prev) => prev.filter((c) => c.id !== id))}
            />
          ))}

          {/* Conectar cuenta adicional */}
          {metaConfigurado && (
            <div className="pt-1">
              <BotonConectarInstagram
                instanciaId={instanciaId}
                label="Conectar otra cuenta"
              />
            </div>
          )}
        </div>
      ) : (
        /* Estado vacío */
        <div className="flex flex-col items-center justify-center py-14 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#E1306C]/15 via-[#C13584]/10 to-[#833AB4]/15 border border-white/10 flex items-center justify-center text-3xl">
            📸
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-stone-300">Sin cuentas de Instagram</p>
            <p className="text-xs text-stone-500 max-w-xs leading-relaxed">
              Conecta tu cuenta de Instagram Business para recibir y responder mensajes directos desde el CRM.
            </p>
          </div>

          {metaConfigurado ? (
            <BotonConectarInstagram instanciaId={instanciaId} />
          ) : (
            <AvisoSinConfiguracion />
          )}
        </div>
      )}

      {/* Aviso de no configurado cuando hay cuentas */}
      {!metaConfigurado && cuentasActivas.length === 0 && (
        <AvisoSinConfiguracion />
      )}

      {/* Qué funciona con esta integración */}
      <div className="rounded-2xl border border-white/8 bg-white/2 p-4 space-y-2.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-stone-600">Qué incluye</p>
        <ul className="space-y-1.5">
          {[
            "Mensajes directos (DMs) de tus seguidores",
            "Imágenes y videos enviados por mensaje",
            "Respuestas a historias",
            "Reacciones a mensajes",
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
