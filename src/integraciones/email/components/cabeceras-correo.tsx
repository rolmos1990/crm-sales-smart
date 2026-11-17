"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { FechaHora } from "@/shared/fechas/fecha-hora";
import type { DireccionCorreo } from "@/integraciones/email/vista/schema";
import type { RespuestaCorreoMensaje } from "./use-correo-mensaje";

const VISIBLES = 3;

interface CabecerasCorreoProps {
  /** Cabeceras reales del correo; null si es previo a 035 (se usa el respaldo). */
  cabeceras: RespuestaCorreoMensaje["cabeceras"];
  /** Lo que el hilo deducía antes de 035: se muestra si no hay cabeceras guardadas. */
  respaldoPara: string | null;
  fechaRespaldo: string | Date;
  className?: string;
}

function formatear(d: DireccionCorreo): string {
  return d.nombre ? `${d.nombre} <${d.direccion}>` : d.direccion;
}

/** De/Para/CC/fecha/asunto de ESTE correo, como en un cliente de correo (US2). */
export function CabecerasCorreo({ cabeceras, respaldoPara, fechaRespaldo, className }: CabecerasCorreoProps) {
  if (!cabeceras) {
    return respaldoPara ? (
      <div data-slot="cabeceras-correo" className={cn("text-[11px] text-muted-foreground", className)}>
        <p className="truncate">
          <span className="text-text-secondary">Para:</span> {respaldoPara}
        </p>
      </div>
    ) : null;
  }

  return (
    <dl
      data-slot="cabeceras-correo"
      className={cn("grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground", className)}
    >
      {cabeceras.de && (
        <Fila etiqueta="De">
          <span className="break-all">{formatear(cabeceras.de)}</span>
        </Fila>
      )}
      {(cabeceras.para.length > 0 || cabeceras.paraTotal > 0) && (
        <Fila etiqueta="Para">
          <ListaDirecciones direcciones={cabeceras.para} total={cabeceras.paraTotal} />
        </Fila>
      )}
      {(cabeceras.cc.length > 0 || cabeceras.ccTotal > 0) && (
        <Fila etiqueta="CC">
          <ListaDirecciones direcciones={cabeceras.cc} total={cabeceras.ccTotal} />
        </Fila>
      )}
      <Fila etiqueta="Fecha">
        <FechaHora valor={cabeceras.fechaEnvio ?? fechaRespaldo} modo="fechaHora" />
      </Fila>
      {cabeceras.asunto && (
        <Fila etiqueta="Asunto">
          <span className="break-words">{cabeceras.asunto}</span>
        </Fila>
      )}
    </dl>
  );
}

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-text-secondary">{etiqueta}:</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

function ListaDirecciones({ direcciones, total }: { direcciones: DireccionCorreo[]; total: number }) {
  const [todas, setTodas] = useState(false);
  const visibles = todas ? direcciones : direcciones.slice(0, VISIBLES);
  const ocultasGuardadas = direcciones.length - visibles.length;
  // Más de las que se guardan (tope de 50): se informa el número, no se inventan.
  const noGuardadas = Math.max(0, total - direcciones.length);

  return (
    <span className="break-all">
      {visibles.map(formatear).join(", ")}
      {ocultasGuardadas > 0 && (
        <>
          {" "}
          <button
            type="button"
            onClick={() => setTodas(true)}
            className="font-medium text-inbox-accent hover:underline"
          >
            y {ocultasGuardadas + noGuardadas} más
          </button>
        </>
      )}
      {ocultasGuardadas === 0 && noGuardadas > 0 && <span> (+{noGuardadas} no mostradas)</span>}
    </span>
  );
}
