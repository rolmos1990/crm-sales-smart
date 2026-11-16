import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Inbox, ShieldCheck, Workflow } from "lucide-react";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { PanelBuzones } from "@/integraciones/email/components/panel-buzones";
import { obtenerBuzones, obtenerPipelinesParaBuzon } from "@/integraciones/email/queries";

export default async function CorreoPage() {
  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "integraciones", "ver").permitido) redirect("/acceso-denegado");

  const puedeModificar = verificarAcceso(sesion, "integraciones", "modificar").permitido;

  // Independientes entre sí: en paralelo, no en cascada.
  const [buzones, pipelines] = await Promise.all([
    obtenerBuzones(sesion.instanciaId),
    obtenerPipelinesParaBuzon(sesion.instanciaId),
  ]);

  return (
    <div className="min-h-full p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/integraciones"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm text-muted-foreground">Integraciones</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-sm text-foreground font-medium">Correo electrónico</span>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-info/10 border border-border flex items-center justify-center shrink-0 text-3xl">
          📧
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-semibold text-foreground">Correo electrónico</h1>
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-lime-500/15 text-lime-400 border border-lime-500/20">
              Nuevo
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            Conectá el buzón de tu negocio y atendé los correos desde el mismo inbox que el resto de tus
            canales. Cada correo nuevo crea su contacto y su oportunidad.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Inbox, label: "En tu inbox", desc: "Los correos llegan como cualquier otro mensaje" },
          { icon: Workflow, label: "Con pipeline", desc: "Cada correo nuevo entra en la etapa que elijas" },
          { icon: ShieldCheck, label: "Credenciales seguras", desc: "Se guardan cifradas y nunca se muestran" },
        ].map(({ icon: Icono, label, desc }) => (
          <div key={label} className="rounded-xl bg-card border border-border p-3 text-center">
            <Icono className="h-5 w-5 text-info mx-auto mb-2" />
            <p className="text-xs font-semibold text-foreground">{label}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <PanelBuzones buzones={buzones} pipelines={pipelines} puedeModificar={puedeModificar} />
      </div>
    </div>
  );
}
