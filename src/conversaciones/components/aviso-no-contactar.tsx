import { Ban } from "lucide-react";

// 041 (FR-025) — Aviso sobre el compositor. Solo informa: el envío de una
// persona no se bloquea. La IA y los Workflows sí quedan bloqueados en el
// servidor (enviarMensajeInterno).
export function AvisoNoContactar() {
  return (
    <div
      role="status"
      data-slot="aviso-no-contactar"
      className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-danger-border bg-danger-muted px-3 py-2 text-xs text-danger-text"
    >
      <Ban className="size-3.5 shrink-0" aria-hidden />
      Este contacto pidió no ser contactado. Puedes enviar igual si es necesario.
    </div>
  );
}
