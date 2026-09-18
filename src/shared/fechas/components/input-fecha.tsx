"use client";

import { Input } from "@/components/ui/input";
import { useTimeZone } from "../contexto";
import { aFechaCalendario, desdeFechaCalendario } from "../zona";

export interface InputFechaProps {
  value: Date | string | null | undefined;
  onChange: (valor: Date | null) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  min?: string;
  max?: string;
}

/**
 * `<input type="date">` para una fecha de calendario pura.
 *
 * Reemplaza al patrón `value={d.toISOString().slice(0, 10)}`, que lee el día en
 * UTC: para cualquier fecha guardada como medianoche local en una zona con
 * offset negativo (toda América), eso muestra el día anterior. Y el
 * `onChange={new Date(e.target.value)}` del otro lado parseaba "2026-09-17"
 * como medianoche UTC, que es otra vez el día anterior en la zona de negocio.
 *
 * Acá los dos lados usan la misma zona, así que el día que el usuario elige es
 * el día que se guarda y el que se vuelve a mostrar.
 */
export function InputFecha({ value, onChange, disabled, className, id, min, max }: InputFechaProps) {
  const zona = useTimeZone();

  const fecha = normalizar(value);
  const ymd = fecha ? aFechaCalendario(fecha, zona) : "";

  return (
    <Input
      id={id}
      type="date"
      className={className}
      disabled={disabled}
      min={min}
      max={max}
      value={ymd}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v ? desdeFechaCalendario(v, zona) : null);
      }}
    />
  );
}

function normalizar(valor: Date | string | null | undefined): Date | null {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}
