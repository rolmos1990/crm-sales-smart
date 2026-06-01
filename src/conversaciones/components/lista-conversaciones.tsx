"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatearIdentificadorWA } from "@/lib/whatsapp-utils";
import type { ConversacionResumen } from "../types";

const ESTADO_CONFIG: Record<string, { etiqueta: string; clase: string }> = {
  ABIERTA:    { etiqueta: "Abierta",    clase: "bg-lime-500/15 text-lime-400 border border-lime-500/25" },
  EN_ESPERA:  { etiqueta: "En espera",  clase: "bg-amber-500/15 text-amber-400 border border-amber-500/25" },
  CERRADA:    { etiqueta: "Cerrada",    clase: "bg-white/8 text-stone-400 border border-white/10" },
  ARCHIVADA:  { etiqueta: "Archivada",  clase: "bg-white/5 text-stone-500 border border-white/8" },
};

function Avatar({ nombre, apellido }: { nombre: string; apellido: string }) {
  const iniciales = `${nombre[0] ?? ""}${apellido[0] ?? ""}`.toUpperCase() || "?";
  return (
    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-lime-500/30 to-emerald-500/20 border border-lime-500/20 flex items-center justify-center text-sm font-semibold text-lime-300 shrink-0">
      {iniciales}
    </div>
  );
}

function PreviewMensaje({ contenido }: { contenido: string | null | undefined }) {
  if (!contenido) {
    return <span className="italic text-stone-600">Sin mensajes</span>;
  }
  return <span>{contenido.length > 60 ? `${contenido.slice(0, 60)}…` : contenido}</span>;
}

interface ListaConversacionesProps {
  conversaciones: ConversacionResumen[];
}

export function ListaConversaciones({ conversaciones }: ListaConversacionesProps) {
  return (
    <ul className="divide-y divide-white/6 rounded-2xl border border-white/10 bg-stone-950/60 backdrop-blur-xl overflow-hidden">
      {conversaciones.map((conv) => {
        const oportunidadId = conv.oportunidades[0]?.oportunidadId ?? null;
        const href = oportunidadId
          ? `/crm/oportunidades/${oportunidadId}`
          : `/crm/contactos/${conv.contactoId}`;

        const nombreCompleto = `${conv.contacto.nombre} ${conv.contacto.apellido}`.trim();
        const estadoConf = ESTADO_CONFIG[conv.estado] ?? ESTADO_CONFIG.CERRADA;
        const tiempoRelativo = formatDistanceToNow(new Date(conv.actualizadoEn), {
          addSuffix: true,
          locale: es,
        });

        return (
          <li key={conv.id}>
            <Link
              href={href}
              className={cn(
                "flex items-center gap-4 px-5 py-4 transition-colors",
                "hover:bg-white/5 active:bg-white/8"
              )}
            >
              {/* Avatar */}
              <Avatar nombre={conv.contacto.nombre} apellido={conv.contacto.apellido} />

              {/* Contenido central */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-stone-100 truncate">
                    {nombreCompleto || conv.contacto.telefonoPrincipal || formatearIdentificadorWA(conv.identificadorCanal) || "Sin nombre"}
                  </p>
                  {conv.cuentaCanal && (
                    <span className="text-[10px] font-medium text-stone-500 uppercase tracking-wide shrink-0">
                      {conv.cuentaCanal.nombre}
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500 truncate">
                  <PreviewMensaje contenido={conv.ultimoMensaje?.contenido} />
                </p>
              </div>

              {/* Columna derecha */}
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", estadoConf.clase)}>
                  {estadoConf.etiqueta}
                </span>
                <span className="text-[10px] text-stone-600 whitespace-nowrap">{tiempoRelativo}</span>
                {(conv._count?.mensajes ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-stone-600">
                    <MessageSquare className="h-3 w-3" />
                    {conv._count!.mensajes}
                  </span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
