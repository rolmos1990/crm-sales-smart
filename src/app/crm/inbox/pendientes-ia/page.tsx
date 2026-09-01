import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { BandejaRevision } from "@/ai/autonomia/components/bandeja-revision";

export default async function PendientesIAPage() {
  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "inbox", "ver").permitido) redirect("/acceso-denegado");

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-6 pt-5 pb-4 border-b border-border flex items-center gap-3">
        <Link href="/crm/inbox" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Pendientes de revisión IA</h1>
          <p className="text-sm text-muted-foreground">
            Respuestas generadas por el agente que requieren aprobación humana antes de enviarse.
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <BandejaRevision />
      </div>
    </div>
  );
}
