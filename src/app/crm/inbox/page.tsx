import { InboxLayout } from "@/conversaciones/components/inbox-layout";
import { obtenerConversacionesInbox, obtenerCuentasCanal } from "@/conversaciones/queries";
import { requireSesion } from "@/shared/auth/sesion";
import type { ConversacionResumen } from "@/conversaciones/types";

type CuentasType = Awaited<ReturnType<typeof obtenerCuentasCanal>>;

export default async function InboxPage() {
  const sesion = await requireSesion();
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
    <div className="h-full overflow-hidden">
      <InboxLayout conversacionesIniciales={conversaciones} cuentas={cuentas} />
    </div>
  );
}
