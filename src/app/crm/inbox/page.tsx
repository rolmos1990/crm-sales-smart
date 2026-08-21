import { redirect } from "next/navigation";
import { InboxLayout } from "@/conversaciones/components/inbox-layout";
import { obtenerConversacionesInbox, obtenerCuentasCanal } from "@/conversaciones/queries";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import type { ConversacionResumen } from "@/conversaciones/types";

type CuentasType = Awaited<ReturnType<typeof obtenerCuentasCanal>>;

export default async function InboxPage() {
  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "inbox", "ver").permitido) redirect("/acceso-denegado");
  let conversaciones: ConversacionResumen[] = [];
  let cuentas: CuentasType = [];
  try {
    [conversaciones, cuentas] = await Promise.all([
      obtenerConversacionesInbox(sesion.instanciaId),
      obtenerCuentasCanal(sesion.instanciaId),
    ]);
  } catch {
    // DB no configurada aún
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-6 pt-5 pb-4 border-b border-border">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Inbox</h1>
      </div>
      <div className="flex-1 overflow-hidden">
        <InboxLayout conversacionesIniciales={conversaciones} cuentas={cuentas} />
      </div>
    </div>
  );
}
