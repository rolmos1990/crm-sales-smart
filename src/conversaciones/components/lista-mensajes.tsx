"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { ChevronUp, Loader2 } from "lucide-react";
import { BurbujaMensaje } from "./burbuja-mensaje";
import { EventoSistema } from "./evento-sistema";
import type { MensajeConMeta } from "../types";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ListaMensajesProps {
  mensajes: MensajeConMeta[];
  hayMasAnteriores?: boolean;
  cargandoAnteriores?: boolean;
  onCargarAnteriores?: () => void;
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

export function ListaMensajes({
  mensajes,
  hayMasAnteriores,
  cargandoAnteriores,
  onCargarAnteriores,
}: ListaMensajesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // flag: true while a "load more older" operation is in flight
  const loadingOlderRef = useRef(false);
  const savedScrollRef = useRef<{ height: number; top: number } | null>(null);

  // Scroll to bottom on new messages — skip when we're loading older ones
  useEffect(() => {
    if (!loadingOlderRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [mensajes.length]);

  // After older messages are prepended, restore scroll so viewport doesn't jump
  useLayoutEffect(() => {
    if (!loadingOlderRef.current || !savedScrollRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const { height, top } = savedScrollRef.current;
    el.scrollTop = top + (el.scrollHeight - height);
    loadingOlderRef.current = false;
    savedScrollRef.current = null;
  }, [mensajes.length]);

  const handleCargarAnteriores = () => {
    const el = scrollRef.current;
    if (!el || !onCargarAnteriores || cargandoAnteriores) return;
    loadingOlderRef.current = true;
    savedScrollRef.current = { height: el.scrollHeight, top: el.scrollTop };
    onCargarAnteriores();
  };

  if (mensajes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-stone-500 text-sm">
        Sin mensajes aún
      </div>
    );
  }

  const grupos = separarPorFecha(mensajes);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin scrollbar-thumb-white/10"
    >
      {/* Botón "Ver mensajes anteriores" — aparece al tope cuando hay más páginas */}
      {hayMasAnteriores && (
        <div className="flex justify-center py-3">
          <button
            type="button"
            onClick={handleCargarAnteriores}
            disabled={cargandoAnteriores}
            className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-full transition-colors disabled:opacity-40"
          >
            {cargandoAnteriores ? (
              <><Loader2 className="h-3 w-3 animate-spin shrink-0" /> Cargando…</>
            ) : (
              <><ChevronUp className="h-3 w-3 shrink-0" /> Ver mensajes anteriores</>
            )}
          </button>
        </div>
      )}

      <div className="space-y-1">
        {grupos.map((grupo) => (
          <div key={grupo.fecha}>
            <div className="flex items-center gap-2 my-3">
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-[10px] text-stone-500 uppercase tracking-wide">{grupo.fecha}</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>
            <div className="space-y-1">
              {grupo.mensajes.map((m) =>
                m.tipo === "EVENTO_SISTEMA" ? (
                  <EventoSistema key={m.id} mensaje={m} />
                ) : (
                  <BurbujaMensaje key={m.id} mensaje={m} />
                )
              )}
            </div>
          </div>
        ))}
      </div>

      <div ref={bottomRef} />
    </div>
  );
}
