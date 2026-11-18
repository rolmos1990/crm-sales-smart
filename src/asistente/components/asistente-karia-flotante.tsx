"use client";

import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { KariaAvatar } from "@/asistente/karia/karia-avatar";
import { usarAsistenteKaria } from "@/asistente/contexto-asistente";
import { usarArrastreFlotante } from "@/asistente/components/usar-arrastre-flotante";
import { cn } from "@/lib/utils";

// El compositor de la bandeja ocupa todo el ancho inferior, con el botón de
// enviar justo donde iría la mascota.
const RUTAS_SIN_ASISTENTE = ["/crm/inbox"];

const CONSULTA_ESCRITORIO = "(min-width: 640px)";

function suscribirEscritorio(avisar: () => void) {
  const consulta = window.matchMedia(CONSULTA_ESCRITORIO);
  consulta.addEventListener("change", avisar);
  return () => consulta.removeEventListener("change", avisar);
}

function usarEsEscritorio() {
  return useSyncExternalStore(
    suscribirEscritorio,
    () => window.matchMedia(CONSULTA_ESCRITORIO).matches,
    () => true,
  );
}

export function AsistenteKariaFlotante({ className }: { className?: string }) {
  const pathname = usePathname();
  const { state, emotion, reinicio, celebrar, reposar } = usarAsistenteKaria();
  const esEscritorio = usarEsEscritorio();
  const [abierto, setAbierto] = useState(false);
  const { botonRef, posicion, arrastrando, esClicDeArrastre, manejadores } = usarArrastreFlotante();

  if (RUTAS_SIN_ASISTENTE.some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`))) {
    return null;
  }

  return (
    <Popover
      open={abierto}
      onOpenChange={(siguiente) => {
        // Soltar un arrastre dispara un clic: mover a Karia no debe abrir el saludo.
        if (siguiente && esClicDeArrastre()) return;
        setAbierto(siguiente);
        if (siguiente) celebrar();
      }}
    >
      <PopoverTrigger
        ref={botonRef}
        aria-label="Asistente Karia"
        title="Arrastra para moverla · flechas para moverla · Inicio para volver a la esquina"
        data-slot="asistente-karia"
        data-arrastrando={arrastrando || undefined}
        {...manejadores}
        style={posicion ? { left: posicion.x, top: posicion.y, right: "auto", bottom: "auto" } : undefined}
        className={cn(
          "fixed z-40 touch-none rounded-full bg-transparent p-1 outline-none select-none",
          !posicion && "bottom-4 right-4 sm:bottom-6 sm:right-6",
          arrastrando ? "cursor-grabbing" : "cursor-grab",
          "focus-visible:ring-2 focus-visible:ring-ring print:hidden",
          className,
        )}
      >
        <KariaAvatar
          state={state}
          emotion={emotion}
          reinicio={reinicio}
          size={esEscritorio ? 72 : 56}
          onSuccessEnd={reposar}
        />
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={8} className="w-64">
        <div className="flex items-center gap-3">
          <KariaAvatar size={40} emotion="happy" floating={false} />
          <p className="text-sm text-foreground">Hola, soy Karia. Muy pronto podré ayudarte aquí.</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
