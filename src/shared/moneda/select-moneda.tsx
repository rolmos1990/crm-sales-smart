"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MONEDAS } from "./constants";

interface SelectMonedaProps {
  value: string;
  onChange: (value: string) => void;
}

export function SelectMoneda({ value, onChange }: SelectMonedaProps) {
  return (
    <Select onValueChange={onChange} value={value}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {MONEDAS.map((m) => (
          <SelectItem key={m.valor} value={m.valor}>
            {m.etiqueta}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
