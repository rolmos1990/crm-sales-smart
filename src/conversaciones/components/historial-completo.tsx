"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BurbujaMensaje } from "./burbuja-mensaje";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface HistorialCompletoProps {
  contactoId: string;
  nombreContacto: string;
}

async function fetchHistorialContacto(contactoId: string) {
  const res = await fetch(`/api/conversaciones/historial?contactoId=${contactoId}`);
  if (!res.ok) throw new Error("Error al cargar historial");
  return res.json();
}

export function HistorialCompleto({ contactoId, nombreContacto }: HistorialCompletoProps) {
  const [abierto, setAbierto] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["historial-contacto", contactoId],
    queryFn: () => fetchHistorialContacto(contactoId),
    enabled: abierto,
  });

  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 transition-colors px-2 py-1 rounded-lg hover:bg-white/5">
        <History className="h-3.5 w-3.5" />
        Ver historial completo
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-lg bg-stone-950 border-white/10 flex flex-col">
        <SheetHeader className="border-b border-white/10 pb-3">
          <SheetTitle className="text-stone-100 text-base">
            Historial de {nombreContacto}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-3">
          {isLoading && (
            <p className="text-center text-stone-500 text-sm py-8">Cargando historial…</p>
          )}

          {!isLoading && data?.conversaciones?.length === 0 && (
            <p className="text-center text-stone-500 text-sm py-8">Sin conversaciones anteriores</p>
          )}

          {!isLoading && data?.conversaciones?.map((conv: any) => (
            <div key={conv.id} className="mb-6">
              <div className="flex items-center gap-2 px-3 mb-2">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-[10px] text-stone-500 uppercase tracking-wide">
                  {conv.cuentaCanal?.nombre ?? conv.cuentaCanal?.canal} · {format(new Date(conv.creadoEn), "d MMM yyyy", { locale: es })}
                </span>
                <div className="flex-1 h-px bg-white/5" />
              </div>
              <div className="px-3 space-y-1">
                {conv.mensajes?.map((m: any) => (
                  <BurbujaMensaje key={m.id} mensaje={m} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
