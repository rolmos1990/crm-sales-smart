import { redirect } from "next/navigation";
import { ArrowLeft, MessageCircle, Shield, Zap } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { PanelInstagram } from "@/integraciones/instagram/components/panel-instagram";

async function obtenerCuentasIG(instanciaId: string) {
  const cuentas = await prisma.cuentaCanal.findMany({
    where: { instanciaId, canal: "instagram" },
    orderBy: { creadoEn: "asc" },
    select: { id: true, nombre: true, identificador: true, activa: true, configuracion: true },
  });

  return cuentas.map((c) => {
    const cfg = c.configuracion as Record<string, unknown> | null;
    return {
      id: c.id,
      nombre: c.nombre,
      identificador: c.identificador,
      activa: c.activa,
      username: cfg?.username as string | null | undefined,
      profilePicUrl: cfg?.profilePicUrl as string | null | undefined,
    };
  });
}

type SearchParams = Promise<{ conectadas?: string; error?: string }>;

function resolverNotificacion(params: { conectadas?: string; error?: string }) {
  if (params.conectadas) return "conectado" as const;
  const err = params.error;
  if (!err) return null;
  if (err === "cancelado") return "cancelado" as const;
  if (err === "sin_instagram") return "sin_instagram" as const;
  return "error" as const;
}

export default async function InstagramPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const notificacion = resolverNotificacion(params);

  // Meta configurado = APP_ID + APP_SECRET disponibles en servidor
  const metaConfigurado = !!(process.env.META_APP_ID && process.env.META_APP_SECRET);

  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "integraciones", "ver").permitido) redirect("/acceso-denegado");

  let cuentas: Awaited<ReturnType<typeof obtenerCuentasIG>> = [];
  const instanciaId = sesion.instanciaId;

  try {
    cuentas = await obtenerCuentasIG(instanciaId);
  } catch (e) {
    console.error("[Instagram page] Error cargando datos:", e);
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
        <span className="text-sm text-stone-300 font-medium">Instagram</span>
      </div>

      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-white/3 backdrop-blur-xl p-6 flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#E1306C]/20 via-[#C13584]/15 to-[#833AB4]/20 border border-white/10 flex items-center justify-center shrink-0 text-3xl">
          📸
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-semibold text-stone-100">Instagram</h1>
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-lime-500/15 text-lime-400 border border-lime-500/20">
              Nuevo
            </span>
          </div>
          <p className="text-sm text-stone-400 mt-1 leading-relaxed">
            Gestiona los mensajes directos de Instagram desde el CRM. Conecta una o varias cuentas de Instagram Business en segundos.
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: MessageCircle, label: "Mensajes directos", desc: "Recibe y responde DMs en el inbox" },
          { icon: Zap,           label: "Tiempo real",       desc: "Notificaciones instantáneas" },
          { icon: Shield,        label: "Seguro",            desc: "OAuth oficial de Meta" },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="rounded-xl bg-white/3 border border-white/8 p-3 text-center">
            <Icon className="h-5 w-5 text-[#E1306C] mx-auto mb-2" />
            <p className="text-xs font-semibold text-stone-300">{label}</p>
            <p className="text-[11px] text-stone-500 mt-0.5">{desc}</p>
          </div>
        ))}
      </div>

      {/* Panel principal */}
      <div className="rounded-2xl border border-white/10 bg-white/3 backdrop-blur-xl p-6">
        <PanelInstagram
          instanciaId={instanciaId}
          cuentas={cuentas}
          metaConfigurado={metaConfigurado}
          notificacion={notificacion}
        />
      </div>
    </div>
  );
}
