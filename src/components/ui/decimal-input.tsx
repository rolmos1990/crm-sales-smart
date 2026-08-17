"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DecimalInputProps {
  value: number | undefined | null;
  onChange: (valor: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

const aTexto = (v: number | undefined | null) =>
  v === undefined || v === null || Number.isNaN(v) ? "" : String(v);

/**
 * Input numérico decimal que acepta tanto coma como punto como separador
 * ("1,5" o "1.5") — un <input type="number"> nativo solo acepta punto y
 * bloquea la coma al escribirla, lo que en la práctica impedía cargar
 * decimales a usuarios acostumbrados al formato es-PE/es-*.
 */
export function DecimalInput({ value, onChange, className, placeholder, disabled }: DecimalInputProps) {
  const [texto, setTexto] = useState(aTexto(value));

  // Sincroniza cuando el valor cambia desde afuera (reset del form, producto
  // seleccionado, etc.) sin pisar lo que el usuario está escribiendo ahora mismo.
  useEffect(() => {
    setTexto((actual) => {
      const normalizado = actual.replace(",", ".");
      const actualComoNumero = normalizado === "" ? undefined : Number(normalizado);
      return actualComoNumero === value ? actual : aTexto(value);
    });
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const crudo = e.target.value;
    // Solo dígitos y, como mucho, un separador decimal (coma o punto)
    if (crudo !== "" && !/^\d*[.,]?\d*$/.test(crudo)) return;
    setTexto(crudo);

    const normalizado = crudo.replace(",", ".");
    if (normalizado === "" || normalizado === ".") { onChange(0); return; }
    const numero = Number(normalizado);
    if (!Number.isNaN(numero)) onChange(numero);
  };

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={texto}
      onChange={handleChange}
      disabled={disabled}
      placeholder={placeholder}
      className={cn(className)}
    />
  );
}
