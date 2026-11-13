"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, MessageSquareShare } from "lucide-react";
import { cn } from "@/lib/utils";
import { obtenerTextoCotizacionAction } from "../actions";

// Deja la cotización escrita en el compositor del chat, lista para ajustar
// antes de enviar — no la manda sola. El texto lo arma el servidor con el
// mismo formateador que "Copiar texto" de la ficha (texto-cotizacion.ts), así
// el cliente recibe el mismo documento venga de donde venga.

interface BotonCotizacionAlChatProps {
  cotizacionId: string;
  numero: string;
  /** Lo entrega el contenedor, que es quien sabe llegar al compositor. */
  onTexto: (texto: string) => void;
  /** Sin conversación abierta no hay dónde escribirlo. */
  deshabilitado?: boolean;
  className?: string;
}

export function BotonCotizacionAlChat({
  cotizacionId,
  numero,
  onTexto,
  deshabilitado,
  className,
}: BotonCotizacionAlChatProps) {
  const [cargando, startCargando] = useTransition();
  const [listo, setListo] = useState(false);

  function handleClick() {
    startCargando(async () => {
      const r = await obtenerTextoCotizacionAction(cotizacionId);
      if (!r.exito) {
        toast.error(r.error ?? "No se pudo preparar la cotización");
        return;
      }
      onTexto(r.datos);
      setListo(true);
      setTimeout(() => setListo(false), 2000);
      toast.success(`Cotización ${numero} lista en el mensaje — revisala antes de enviar`);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={cargando || deshabilitado}
      title={
        deshabilitado
          ? "Abre una conversación para escribir la cotización en el chat"
          : `Escribir la cotización ${numero} en el mensaje`
      }
      aria-label={`Escribir la cotización ${numero} en el mensaje`}
      className={cn(
        "h-5 w-5 flex items-center justify-center rounded transition-colors",
        "text-muted-foreground hover:text-primary hover:bg-primary-muted",
        "disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground",
        listo && "text-success-text",
        className,
      )}
    >
      {cargando ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <MessageSquareShare className="h-3 w-3" />
      )}
    </button>
  );
}
