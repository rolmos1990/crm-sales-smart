"use client";

import { useEffect, useRef } from "react";
import { BurbujaMensaje } from "./burbuja-mensaje";
import type { MensajeConMeta } from "../types";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ListaMensajesProps {
  mensajes: MensajeConMeta[];
}

function separarPorFecha(mensajes: MensajeConMeta[]) {
  const grupos: { fecha: string; mensajes: MensajeConMeta[] }[] = [];
  for (const m of mensajes) {
    const fecha = format(new Date(m.creadoEn), "d MMM yyyy", { locale: es });
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.fecha === fecha) {
      ultimo.mensajes.push(m);
    } else {
      grupos.push({ fecha, mensajes: [m] });
    }
  }
  return grupos;
}

export function ListaMensajes({ mensajes }: ListaMensajesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes.length]);

  if (mensajes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-stone-500 text-sm">
        Sin mensajes aún
      </div>
    );
  }

  const grupos = separarPorFecha(mensajes);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-thin scrollbar-thumb-white/10">
      {grupos.map((grupo) => (
        <div key={grupo.fecha}>
          <div className="flex items-center gap-2 my-3">
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-[10px] text-stone-500 uppercase tracking-wide">{grupo.fecha}</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>
          <div className="space-y-1">
            {grupo.mensajes.map((m) => (
              <BurbujaMensaje key={m.id} mensaje={m} />
            ))}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
