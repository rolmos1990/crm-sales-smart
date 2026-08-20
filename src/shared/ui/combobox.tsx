"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
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
  /** Texto secundario opcional, mostrado debajo de la etiqueta (ej. email). */
  subtitulo?: string;
  /** Palabras clave adicionales para la búsqueda (ej. teléfono), no se muestran. */
  busqueda?: string[];
}

interface ComboboxProps {
  opciones: OpcionCombobox[];
  valor?: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  placeholderBusqueda?: string;
  mensajeVacio?: string;
  disabled?: boolean;
  /**
   * `opciones` suele venir con un límite inicial (ej. los primeros N
   * registros) para no cargar una lista completa de una — cuando se pasa
   * este callback, escribir en el buscador dispara (con debounce) una
   * búsqueda en el servidor sobre el total, así aparecen resultados que no
   * entraron en ese límite inicial. Mientras no haya texto, se sigue
   * mostrando `opciones` tal cual.
   */
  onBuscar?: (query: string) => Promise<OpcionCombobox[]>;
}

export function Combobox({
  opciones,
  valor,
  onChange,
  placeholder = "Seleccionar...",
  placeholderBusqueda = "Buscar...",
  mensajeVacio = "Sin resultados.",
  disabled = false,
  onBuscar,
}: ComboboxProps) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [resultadosBusqueda, setResultadosBusqueda] = useState<OpcionCombobox[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  // Guarda la opción elegida cuando viene de una búsqueda en servidor y no
  // está en `opciones` — sin esto, al cerrar el popover (que limpia los
  // resultados de búsqueda) el trigger perdería la etiqueta seleccionada.
  const [opcionElegidaExtra, setOpcionElegidaExtra] = useState<OpcionCombobox | null>(null);

  useEffect(() => {
    if (!onBuscar) return;
    const termino = busqueda.trim();
    if (!termino) {
      setResultadosBusqueda(null);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const resultado = await onBuscar(termino);
        setResultadosBusqueda(resultado);
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda, onBuscar]);

  const handleOpenChange = (siguiente: boolean) => {
    setAbierto(siguiente);
    if (!siguiente) {
      // La próxima apertura arranca de nuevo con la lista inicial.
      setBusqueda("");
      setResultadosBusqueda(null);
    }
  };

  const buscandoActivo = !!onBuscar && busqueda.trim().length > 0;
  const listaMostrada = buscandoActivo ? (resultadosBusqueda ?? []) : opciones;

  const opcionSeleccionada =
    opciones.find((o) => o.valor === valor) ??
    (opcionElegidaExtra?.valor === valor ? opcionElegidaExtra : undefined);

  return (
    <Popover open={abierto} onOpenChange={handleOpenChange}>
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
        {/* Con búsqueda en servidor, el filtrado ya viene hecho — cmdk no
            debe volver a filtrar localmente sobre esos resultados. */}
        <Command shouldFilter={!onBuscar}>
          <CommandInput
            placeholder={placeholderBusqueda}
            {...(onBuscar ? { value: busqueda, onValueChange: setBusqueda } : {})}
          />
          <CommandList>
            {buscando ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Buscando...
              </div>
            ) : (
              <>
                <CommandEmpty>{mensajeVacio}</CommandEmpty>
                <CommandGroup>
                  {listaMostrada.map((opcion) => (
                    <CommandItem
                      key={opcion.valor}
                      value={opcion.valor}
                      keywords={[opcion.etiqueta, ...(opcion.subtitulo ? [opcion.subtitulo] : []), ...(opcion.busqueda ?? [])]}
                      onSelect={(valorActual) => {
                        const siguienteValor = valorActual === valor ? "" : valorActual;
                        onChange(siguienteValor);
                        if (siguienteValor && !opciones.some((o) => o.valor === siguienteValor)) {
                          setOpcionElegidaExtra(opcion);
                        }
                        setAbierto(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          valor === opcion.valor ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{opcion.etiqueta}</span>
                        {opcion.subtitulo && (
                          <span className="text-xs text-muted-foreground">{opcion.subtitulo}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
