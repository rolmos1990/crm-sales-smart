"use client";

import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { CodigoAccion } from "@/shared/lib/codigo-sensible";

interface CampoCodigoLicenciaProps {
  /** true si el servidor ya reporta un código configurado (producto, línea
   *  heredada, o pedido existente) — nunca el valor real, ver
   *  src/shared/lib/codigo-sensible.ts. */
  tieneCodigoConfigurado: boolean;
  /** Matiz de copy — "Heredado del producto" vs texto genérico. */
  origen?: "producto" | "linea" | "pedido";
  accion: CodigoAccion;
  onAccionChange: (accion: CodigoAccion) => void;
  valorNuevo: string;
  onValorNuevoChange: (valor: string) => void;
  disabled?: boolean;
}

/**
 * Campo "Código / Licencia" — nunca muestra el valor real ni lo simula con
 * un string enmascarado (`********`). Sin código configurado: input plano.
 * Con código configurado: badge "✓ Configurado" + botón "Reemplazar", que
 * revela un input vacío para un valor nuevo. El estado se modela
 * explícitamente (CONSERVAR/REEMPLAZAR), no con un valor de texto.
 * Reutilizado en form-producto.tsx, form-cotizacion.tsx (por línea Digital)
 * y form-entrega-digital.tsx de Pedido (por línea Digital).
 */
export function CampoCodigoLicencia({
  tieneCodigoConfigurado,
  origen = "linea",
  accion,
  onAccionChange,
  valorNuevo,
  onValorNuevoChange,
  disabled,
}: CampoCodigoLicenciaProps) {
  if (!tieneCodigoConfigurado) {
    return (
      <Input
        placeholder="Código de activación..."
        value={valorNuevo}
        onChange={(e) => onValorNuevoChange(e.target.value)}
        disabled={disabled}
      />
    );
  }

  if (accion === "REEMPLAZAR") {
    return (
      <div className="space-y-1.5">
        <Input
          placeholder="Nuevo código / licencia..."
          value={valorNuevo}
          onChange={(e) => onValorNuevoChange(e.target.value)}
          disabled={disabled}
          autoFocus
        />
        <button
          type="button"
          onClick={() => { onAccionChange("CONSERVAR"); onValorNuevoChange(""); }}
          className="text-xs text-stone-400 hover:text-lime-600 dark:hover:text-lime-400 transition-colors"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 h-9 px-3 rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5">
      <span className="flex items-center gap-1.5 text-sm text-stone-600 dark:text-stone-300 flex-1 min-w-0">
        <Check className="h-3.5 w-3.5 text-lime-600 dark:text-lime-400 flex-shrink-0" />
        <span className="truncate">
          Configurado{origen === "producto" ? "" : " — heredado del producto"}
        </span>
      </span>
      <button
        type="button"
        onClick={() => onAccionChange("REEMPLAZAR")}
        disabled={disabled}
        className="text-xs font-medium text-lime-600 dark:text-lime-400 hover:underline flex-shrink-0 disabled:opacity-50"
      >
        Reemplazar
      </button>
    </div>
  );
}
