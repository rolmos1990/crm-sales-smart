import { ArrowLeft, Smartphone, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import { resolverInstanciaId } from "@/shared/db/instancia";
import { prisma } from "@/shared/db/prisma";
import { PanelNumerosWhatsApp } from "@/integraciones/whatsapp-lite/components/panel-numeros-whatsapp";

async function obtenerCuentasWALite(instanciaId: string) {
  return prisma.cuentaCanal.findMany({
    where: { instanciaId, canal: "whatsapp_lite" },
    orderBy: { creadoEn: "asc" },
    select: {
      id: true,
      nombre: true,
      identificador: true,
      activa: true,
      pipelineId: true,
      stageId: true,
      stage: { select: { nombre: true, color: true } },
    },
  });
}

async function obtenerInstanciaId(): Promise<string> {
  try {
    return await resolverInstanciaId();
  } catch {
    return "";
  }
}

export default async function WhatsAppLitePage() {
  let cuentas: {
    id: string;
    nombre: string;
    identificador: string;
    activa: boolean;
    pipelineId: string | null;
    stageId: string | null;
    stage: { nombre: string; color: string | null } | null;
  }[] = [];
  let instanciaId = "";

  try {
    instanciaId = await obtenerInstanciaId();
    if (instanciaId) {
      cuentas = await obtenerCuentasWALite(instanciaId);
    }
  } catch (e) {
    console.error("[WhatsApp Lite page] Error cargando datos:", e);
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
        <span className="text-sm text-stone-300 font-medium">WhatsApp Lite</span>
      </div>

      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-white/3 backdrop-blur-xl p-6 flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-green-500/15 flex items-center justify-center shrink-0 text-3xl">
          💬
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-semibold text-stone-100">WhatsApp Lite</h1>
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
              Activo
            </span>
          </div>
          <p className="text-sm text-stone-400 mt-1 leading-relaxed">
            Conecta uno o más números de WhatsApp vía código QR. Cada número queda disponible para responder conversaciones desde el CRM.
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Smartphone, label: "Conexión QR", desc: "Escanea como dispositivo vinculado" },
          { icon: Zap, label: "Múltiples números", desc: "Registra todos los que necesites" },
          { icon: ShieldCheck, label: "Nombre propio", desc: "Alias personalizado por número" },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="rounded-xl bg-white/3 border border-white/8 p-3 text-center">
            <Icon className="h-5 w-5 text-green-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-stone-300">{label}</p>
            <p className="text-[11px] text-stone-500 mt-0.5">{desc}</p>
          </div>
        ))}
      </div>

      {/* Panel de números */}
      <div className="rounded-2xl border border-white/10 bg-white/3 backdrop-blur-xl p-6">
        <PanelNumerosWhatsApp instanciaId={instanciaId} cuentas={cuentas} />
      </div>

      {/* Instrucciones */}
      <div className="rounded-2xl border border-white/8 bg-white/2 p-5 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-stone-500">Cómo conectar</p>
        <ol className="space-y-2">
          {[
            "Haz clic en «Agregar número» y escribe un nombre o alias para el número.",
            "Espera a que aparezca el código QR en pantalla.",
            "Abre WhatsApp en tu teléfono → Configuración → Dispositivos vinculados → Vincular un dispositivo.",
            "Escanea el QR con la cámara de WhatsApp.",
            "El número quedará registrado y disponible para iniciar o responder conversaciones.",
          ].map((paso, i) => (
            <li key={i} className="flex items-start gap-3 text-xs text-stone-500 leading-relaxed">
              <span className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold text-stone-400 shrink-0 mt-0.5">
                {i + 1}
              </span>
              {paso}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
