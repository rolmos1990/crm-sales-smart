import { redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { InboxLayout } from "@/conversaciones/components/inbox-layout";
import { obtenerConversacionesInbox, obtenerCuentasCanal } from "@/conversaciones/queries";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { listarRespuestasPendientes } from "@/ai/autonomia/queries";
import type { ConversacionResumen } from "@/conversaciones/types";

type CuentasType = Awaited<ReturnType<typeof obtenerCuentasCanal>>;

export default async function InboxPage() {
  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "inbox", "ver").permitido) redirect("/acceso-denegado");
  let conversaciones: ConversacionResumen[] = [];
  let cuentas: CuentasType = [];
  let pendientesIA: Awaited<ReturnType<typeof listarRespuestasPendientes>> = [];
  try {
    [conversaciones, cuentas, pendientesIA] = await Promise.all([
      obtenerConversacionesInbox(sesion.instanciaId),
      obtenerCuentasCanal(sesion.instanciaId),
      listarRespuestasPendientes(sesion.instanciaId),
    ]);
  } catch {
    // DB no configurada aún
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-6 pt-5 pb-4 border-b border-border flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Inbox</h1>
        {/* 016-niveles-autonomia-automatizacion (Historia 3) */}
        <Link
          href="/crm/inbox/pendientes-ia"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Pendientes IA
          {pendientesIA.length > 0 && (
            <span className="text-xs rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 font-medium">
              {pendientesIA.length}
            </span>
          )}
        </Link>
      </div>
      <div className="flex-1 overflow-hidden">
        <InboxLayout conversacionesIniciales={conversaciones} cuentas={cuentas} />
      </div>
    </div>
  );
}
