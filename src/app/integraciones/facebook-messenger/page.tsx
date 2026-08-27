import { redirect } from "next/navigation";
import { ArrowLeft, MessageCircle, Zap, Shield } from "lucide-react";
import Link from "next/link";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { PanelFacebookMessenger } from "@/integraciones/facebook-messenger/components/panel-facebook-messenger";
import { obtenerCuentasFacebookMessenger } from "@/integraciones/facebook-messenger/queries";

type SearchParams = Promise<{ conectadas?: string; error?: string }>;

const ERRORES_CONOCIDOS = new Set([
  "cancelado",
  "sin_paginas",
  "state",
  "sesion",
  "token",
  "no_configurado",
  "parametros",
  "oauth",
]);

function resolverNotificacion(params: { conectadas?: string; error?: string }) {
  if (params.conectadas) return "conectado" as const;
  const err = params.error;
  if (!err) return null;
  if (ERRORES_CONOCIDOS.has(err)) return err as "cancelado" | "sin_paginas" | "state" | "sesion" | "token" | "no_configurado" | "parametros" | "oauth";
  return "error" as const;
}

export default async function FacebookMessengerPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const notificacion = resolverNotificacion(params);

  // La app de Meta usada acá es la misma que el flujo heredado de Instagram
  // vía Página (META_APP_ID/META_APP_SECRET) — no requiere credenciales
  // nuevas (ver spec.md, Diagnóstico previo).
  const facebookConfigurado = !!(process.env.META_APP_ID && process.env.META_APP_SECRET);

  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "integraciones", "ver").permitido) redirect("/acceso-denegado");

  let cuentas: Awaited<ReturnType<typeof obtenerCuentasFacebookMessenger>> = [];
  try {
    cuentas = await obtenerCuentasFacebookMessenger(sesion.instanciaId);
  } catch (e) {
    console.error("[Facebook Messenger page] Error cargando datos:", e);
  }

  return (
    <div className="min-h-full p-6 max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href="/integraciones"
          className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm text-stone-500">Integraciones</span>
        <span className="text-stone-700">/</span>
        <span className="text-sm text-stone-300 font-medium">Facebook Messenger</span>
      </div>

      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-white/3 backdrop-blur-xl p-6 flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0084FF]/20 to-[#00C6FF]/20 border border-white/10 flex items-center justify-center shrink-0 text-3xl">
          💬
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-semibold text-stone-100">Facebook Messenger</h1>
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-lime-500/15 text-lime-400 border border-lime-500/20">
              Nuevo
            </span>
          </div>
          <p className="text-sm text-stone-400 mt-1 leading-relaxed">
            Gestiona los mensajes de Messenger desde el CRM. Conecta la Página de Facebook de tu negocio en segundos.
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: MessageCircle, label: "Mensajes directos", desc: "Recibe y responde en el inbox" },
          { icon: Zap,           label: "Tiempo real",       desc: "Notificaciones instantáneas" },
          { icon: Shield,        label: "Seguro",            desc: "OAuth oficial de Meta" },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="rounded-xl bg-white/3 border border-white/8 p-3 text-center">
            <Icon className="h-5 w-5 text-[#0084FF] mx-auto mb-2" />
            <p className="text-xs font-semibold text-stone-300">{label}</p>
            <p className="text-[11px] text-stone-500 mt-0.5">{desc}</p>
          </div>
        ))}
      </div>

      {/* Panel principal */}
      <div className="rounded-2xl border border-white/10 bg-white/3 backdrop-blur-xl p-6">
        <PanelFacebookMessenger
          cuentas={cuentas}
          facebookConfigurado={facebookConfigurado}
          notificacion={notificacion}
        />
      </div>
    </div>
  );
}
