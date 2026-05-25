"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface OpcionCombobox {
  valor: string;
  etiqueta: string;
}

interface ComboboxProps {
  opciones: OpcionCombobox[];
  valor?: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  placeholderBusqueda?: string;
  mensajeVacio?: string;
  disabled?: boolean;
}

export function Combobox({
  opciones,
  valor,
  onChange,
  placeholder = "Seleccionar...",
  placeholderBusqueda = "Buscar...",
  mensajeVacio = "Sin resultados.",
  disabled = false,
}: ComboboxProps) {
  const [abierto, setAbierto] = useState(false);

  const opcionSeleccionada = opciones.find((o) => o.valor === valor);

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger
        className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between font-normal")}
        aria-expanded={abierto}
        disabled={disabled}
      >
        <span className={cn(!opcionSeleccionada && "text-muted-foreground")}>
          {opcionSeleccionada ? opcionSeleccionada.etiqueta : placeholder}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholderBusqueda} />
          <CommandList>
            <CommandEmpty>{mensajeVacio}</CommandEmpty>
            <CommandGroup>
              {opciones.map((opcion) => (
                <CommandItem
                  key={opcion.valor}
                  value={opcion.valor}
                  onSelect={(valorActual) => {
                    onChange(valorActual === valor ? "" : valorActual);
                    setAbierto(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      valor === opcion.valor ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {opcion.etiqueta}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
