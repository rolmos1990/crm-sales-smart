import { InboxLayout } from "@/conversaciones/components/inbox-layout";
import { obtenerConversacionesInbox, obtenerTodasLasCuentasCanal } from "@/conversaciones/queries";
import type { ConversacionResumen } from "@/conversaciones/types";

type CuentasType = Awaited<ReturnType<typeof obtenerTodasLasCuentasCanal>>;

export default async function InboxPage() {
  let conversaciones: ConversacionResumen[] = [];
  let cuentas: CuentasType = [];
  try {
    [conversaciones, cuentas] = await Promise.all([
      obtenerConversacionesInbox(),
      obtenerTodasLasCuentasCanal(),
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
