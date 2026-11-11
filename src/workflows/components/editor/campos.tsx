"use client";

import { useRef, type ReactNode } from "react";
import { Braces } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { Destinatario, Duracion } from "../../definicion/schema";
import type { VariableDisponible } from "../../definicion/variables";
import type { OpcionesEditor } from "../../queries";

// Campos compartidos por los formularios de nodos. Son controlados y
// escriben directo en la config del nodo: el borrador admite valores
// incompletos y el validador marca lo que falta.

export function Campo({ etiqueta, ayuda, children, className }: { etiqueta: string; ayuda?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-medium text-foreground">{etiqueta}</Label>
      {children}
      {ayuda && <p className="text-[11px] text-muted-foreground">{ayuda}</p>}
    </div>
  );
}

export interface OpcionSelect {
  valor: string;
  etiqueta: string;
}

/** Select con `items` derivado de las mismas opciones (ver docs/selects.md). */
export function SelectSimple({
  valor,
  opciones,
  onChange,
  placeholder = "Selecciona…",
  className,
}: {
  valor: string | undefined;
  opciones: OpcionSelect[];
  onChange: (valor: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const items = Object.fromEntries(opciones.map((o) => [o.valor, o.etiqueta]));
  return (
    <Select items={items} value={valor ?? null} onValueChange={(v) => v && onChange(v as string)}>
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {opciones.map((o) => (
          <SelectItem key={o.valor} value={o.valor}>
            {o.etiqueta}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const UNIDADES: OpcionSelect[] = [
  { valor: "MINUTOS", etiqueta: "Minutos" },
  { valor: "HORAS", etiqueta: "Horas" },
  { valor: "DIAS", etiqueta: "Días" },
];

export function CampoDuracion({ valor, onChange }: { valor: Duracion | undefined; onChange: (d: Duracion) => void }) {
  const actual = valor ?? { cantidad: 1, unidad: "DIAS" as const };
  return (
    <div className="flex gap-2">
      <Input
        type="number"
        min={1}
        value={Number.isFinite(actual.cantidad) ? actual.cantidad : ""}
        onChange={(e) => onChange({ ...actual, cantidad: e.target.value === "" ? Number.NaN : Number(e.target.value) })}
        className="w-24"
        aria-label="Cantidad"
      />
      <SelectSimple
        valor={actual.unidad}
        opciones={UNIDADES}
        onChange={(u) => onChange({ ...actual, unidad: u as Duracion["unidad"] })}
        className="flex-1"
      />
    </div>
  );
}

const RESPONSABLE = "__responsable__";

export function CampoDestinatario({
  valor,
  onChange,
  usuarios,
}: {
  valor: Destinatario | undefined;
  onChange: (d: Destinatario) => void;
  usuarios: OpcionesEditor["usuarios"];
}) {
  const opciones: OpcionSelect[] = [
    { valor: RESPONSABLE, etiqueta: "Responsable de la oportunidad" },
    ...usuarios.map((u) => ({ valor: u.id, etiqueta: u.nombre })),
  ];
  const actual = !valor || valor.tipo === "RESPONSABLE_OPORTUNIDAD" ? RESPONSABLE : valor.usuarioInstanciaId;
  return (
    <SelectSimple
      valor={actual}
      opciones={opciones}
      onChange={(v) =>
        onChange(v === RESPONSABLE ? { tipo: "RESPONSABLE_OPORTUNIDAD" } : { tipo: "USUARIO", usuarioInstanciaId: v })
      }
    />
  );
}

/** Texto (input o textarea) con un botón para insertar {{variables}} en el cursor. */
export function TextoConVariables({
  valor,
  onChange,
  variables,
  multilinea = true,
  filas = 4,
  placeholder,
}: {
  valor: string;
  onChange: (v: string) => void;
  variables: VariableDisponible[];
  multilinea?: boolean;
  filas?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const grupos = [...new Set(variables.map((v) => v.grupo))];

  const insertar = (ruta: string) => {
    const el = ref.current;
    const token = `{{${ruta}}}`;
    const inicio = el?.selectionStart ?? valor.length;
    const fin = el?.selectionEnd ?? valor.length;
    onChange(valor.slice(0, inicio) + token + valor.slice(fin));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(inicio + token.length, inicio + token.length);
    });
  };

  return (
    <div className="space-y-1.5">
      {multilinea ? (
        <Textarea ref={ref} rows={filas} value={valor} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <Input ref={ref} value={valor} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
      <Popover>
        <PopoverTrigger className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Braces className="h-3 w-3" />
          Insertar variable
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar variable…" />
            <CommandList>
              <CommandEmpty>Sin resultados</CommandEmpty>
              {grupos.map((g) => (
                <CommandGroup key={g} heading={g}>
                  {variables
                    .filter((v) => v.grupo === g)
                    .map((v) => (
                      <CommandItem key={v.ruta} value={`${g} ${v.etiqueta} ${v.ruta}`} onSelect={() => insertar(v.ruta)}>
                        <span className="flex-1">{v.etiqueta}</span>
                        <code className="text-[10px] text-muted-foreground">{v.ruta}</code>
                      </CommandItem>
                    ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
