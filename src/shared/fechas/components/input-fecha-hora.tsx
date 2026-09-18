"use client";

import { Input } from "@/components/ui/input";
import { useTimeZone } from "../contexto";
import { aFechaHoraLocal, aInstante } from "../zona";

export interface InputFechaHoraProps {
  value: Date | string | null | undefined;
  onChange: (valor: Date | null) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/**
 * `<input type="datetime-local">` que lee y escribe con la MISMA zona.
 *
 * El patrón que reemplaza era asimétrico:
 *
 *     value={new Date(v).toISOString().slice(0, 16)}   // reloj UTC
 *     onChange={e => field.onChange(new Date(e.target.value))}  // hora local
 *
 * Pintaba el reloj UTC en un control que el navegador interpreta como hora
 * local, así que cada vez que alguien abría y guardaba el formulario la hora
 * almacenada se corría por el offset. No era un error de una vez: la deriva se
 * acumulaba en cada edición.
 */
export function InputFechaHora({ value, onChange, disabled, className, id }: InputFechaHoraProps) {
  const zona = useTimeZone();

  const fecha = normalizar(value);
  const textoLocal = fecha ? aFechaHoraLocal(fecha, zona) : "";

  return (
    <Input
      id={id}
      type="datetime-local"
      className={className}
      disabled={disabled}
      value={textoLocal}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v ? aInstante(v, zona) : null);
      }}
    />
  );
}

function normalizar(valor: Date | string | null | undefined): Date | null {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}
