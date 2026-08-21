"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Filter, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Combobox } from "@/shared/ui/combobox";
import { SelectorTags } from "@/crm/tags/components/selector-tags";
import { cn } from "@/lib/utils";
import type { OpcionCombobox } from "@/shared/ui/combobox";
import type { Tag } from "@/crm/tags/types";

/** Campo de fecha compacto para el drawer de filtros — reutiliza Calendar/Popover. */
function CampoFecha({
  value,
  onChange,
}: {
  value?: Date;
  onChange: (fecha: Date | undefined) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border px-2.5 text-[12.5px] transition-colors",
          "border-stone-200 dark:border-white/[0.08] bg-stone-50 dark:bg-white/[0.04]",
          "hover:bg-stone-100 dark:hover:bg-white/[0.07]",
          value ? "text-stone-700 dark:text-stone-200" : "text-stone-400 dark:text-white/30"
        )}
      >
        <span className="truncate">{value ? format(value, "dd MMM yyyy", { locale: es }) : "Cualquiera"}</span>
        {value ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange(undefined);
            }}
            className="shrink-0 opacity-50 hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </span>
        ) : (
          <CalendarIcon className="h-3 w-3 shrink-0 opacity-40" />
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(fecha) => {
            onChange(fecha ?? undefined);
            setOpen(false);
          }}
          captionLayout="dropdown"
          defaultMonth={value ?? new Date()}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          locale={es as any}
        />
      </PopoverContent>
    </Popover>
  );
}

interface DraftFiltros {
  creadoDesde?: Date;
  creadoHasta?: Date;
  cierreDesde?: Date;
  cierreHasta?: Date;
  contactoId?: string;
  empresaId?: string;
  titulo: string;
  tagIds: string[];
}

const FILTROS_VACIOS: DraftFiltros = { titulo: "", tagIds: [] };

function fechaDesdeParam(valor: string | null): Date | undefined {
  if (!valor) return undefined;
  const fecha = new Date(`${valor}T00:00:00`);
  return Number.isNaN(fecha.getTime()) ? undefined : fecha;
}

function leerFiltrosDeUrl(params: URLSearchParams): DraftFiltros {
  return {
    creadoDesde: fechaDesdeParam(params.get("creadoDesde")),
    creadoHasta: fechaDesdeParam(params.get("creadoHasta")),
    cierreDesde: fechaDesdeParam(params.get("cierreDesde")),
    cierreHasta: fechaDesdeParam(params.get("cierreHasta")),
    contactoId: params.get("contactoId") ?? undefined,
    empresaId: params.get("empresaId") ?? undefined,
    titulo: params.get("titulo") ?? "",
    tagIds: params.get("tags")?.split(",").filter(Boolean) ?? [],
  };
}

function contarFiltrosActivos(f: DraftFiltros): number {
  let n = 0;
  if (f.creadoDesde || f.creadoHasta) n++;
  if (f.cierreDesde || f.cierreHasta) n++;
  if (f.contactoId) n++;
  if (f.empresaId) n++;
  if (f.titulo.trim()) n++;
  if (f.tagIds.length > 0) n++;
  return n;
}

interface PipelineFiltrosDrawerProps {
  contactos: OpcionCombobox[];
  empresas: OpcionCombobox[];
  tags: Tag[];
}

export function PipelineFiltrosDrawer({ contactos, empresas, tags }: PipelineFiltrosDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filtrosAplicados = leerFiltrosDeUrl(searchParams);
  const totalActivos = contarFiltrosActivos(filtrosAplicados);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftFiltros>(filtrosAplicados);

  const handleOpenChange = (siguiente: boolean) => {
    // Al abrir, el draft siempre parte de los filtros actualmente aplicados
    // (no de lo que haya quedado de una sesión anterior sin aplicar).
    if (siguiente) setDraft(leerFiltrosDeUrl(searchParams));
    setOpen(siguiente);
  };

  const aplicar = () => {
    const params = new URLSearchParams(searchParams.toString());
    const set = (clave: string, valor?: string) => {
      if (valor) params.set(clave, valor);
      else params.delete(clave);
    };

    set("creadoDesde", draft.creadoDesde ? format(draft.creadoDesde, "yyyy-MM-dd") : undefined);
    set("creadoHasta", draft.creadoHasta ? format(draft.creadoHasta, "yyyy-MM-dd") : undefined);
    set("cierreDesde", draft.cierreDesde ? format(draft.cierreDesde, "yyyy-MM-dd") : undefined);
    set("cierreHasta", draft.cierreHasta ? format(draft.cierreHasta, "yyyy-MM-dd") : undefined);
    set("contactoId", draft.contactoId);
    set("empresaId", draft.empresaId);
    set("titulo", draft.titulo.trim() || undefined);
    set("tags", draft.tagIds.length > 0 ? draft.tagIds.join(",") : undefined);

    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  };

  const limpiar = () => setDraft(FILTROS_VACIOS);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <Button
        type="button"
        variant="outline"
        onClick={() => handleOpenChange(true)}
        className={cn(
          "h-8 px-3 rounded-lg gap-1.5 text-[12.5px] font-medium",
          "border-stone-200 dark:border-white/[0.08] text-stone-600 dark:text-stone-300",
          "hover:bg-stone-50 dark:hover:bg-white/[0.06]",
          totalActivos > 0 && "border-lime-500/30 dark:border-lime-400/25 text-lime-700 dark:text-lime-400 bg-lime-500/[0.06] dark:bg-lime-400/[0.06]"
        )}
      >
        <Filter className="h-3.5 w-3.5" />
        Filtros{totalActivos > 0 && ` (${totalActivos})`}
      </Button>

      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 data-[side=right]:sm:max-w-sm bg-modal border-l border-border shadow-2xl"
      >
        <SheetHeader className="flex-row items-center gap-2.5 border-b border-stone-100 dark:border-white/10 px-5 py-4 pr-12 flex-shrink-0 space-y-0">
          <SheetTitle className="text-stone-900 dark:text-stone-50">Filtros</SheetTitle>
          <button
            type="button"
            onClick={limpiar}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11.5px] font-medium transition-colors",
              "border-stone-200 dark:border-white/10 text-stone-500 dark:text-white/45",
              "hover:border-stone-300 dark:hover:border-white/20 hover:bg-stone-50 dark:hover:bg-white/[0.05] hover:text-stone-700 dark:hover:text-white/80"
            )}
          >
            <RotateCcw className="h-3 w-3" />
            Limpiar filtros
          </button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* Fecha de creación */}
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-stone-400 dark:text-white/30 uppercase tracking-[0.08em]">
              Fecha de creación
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-[11px] text-stone-400 dark:text-white/30">Desde</span>
                <CampoFecha
                  value={draft.creadoDesde}
                  onChange={(fecha) => setDraft((d) => ({ ...d, creadoDesde: fecha }))}
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-stone-400 dark:text-white/30">Hasta</span>
                <CampoFecha
                  value={draft.creadoHasta}
                  onChange={(fecha) => setDraft((d) => ({ ...d, creadoHasta: fecha }))}
                />
              </div>
            </div>
          </div>

          {/* Fecha de cierre */}
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-stone-400 dark:text-white/30 uppercase tracking-[0.08em]">
              Fecha de cierre
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-[11px] text-stone-400 dark:text-white/30">Desde</span>
                <CampoFecha
                  value={draft.cierreDesde}
                  onChange={(fecha) => setDraft((d) => ({ ...d, cierreDesde: fecha }))}
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-stone-400 dark:text-white/30">Hasta</span>
                <CampoFecha
                  value={draft.cierreHasta}
                  onChange={(fecha) => setDraft((d) => ({ ...d, cierreHasta: fecha }))}
                />
              </div>
            </div>
          </div>

          {/* Contacto */}
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-stone-400 dark:text-white/30 uppercase tracking-[0.08em]">
              Contacto
            </Label>
            <Combobox
              opciones={contactos}
              valor={draft.contactoId}
              onChange={(valor) => setDraft((d) => ({ ...d, contactoId: valor || undefined }))}
              placeholder="Selecciona un contacto"
              placeholderBusqueda="Buscar por nombre, email o teléfono..."
              mensajeVacio="Sin contactos."
            />
          </div>

          {/* Empresa */}
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-stone-400 dark:text-white/30 uppercase tracking-[0.08em]">
              Empresa
            </Label>
            <Combobox
              opciones={empresas}
              valor={draft.empresaId}
              onChange={(valor) => setDraft((d) => ({ ...d, empresaId: valor || undefined }))}
              placeholder="Selecciona una empresa"
              placeholderBusqueda="Buscar empresa..."
              mensajeVacio="Sin empresas."
            />
          </div>

          {/* Nombre de oportunidad */}
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-stone-400 dark:text-white/30 uppercase tracking-[0.08em]">
              Nombre de oportunidad
            </Label>
            <Input
              value={draft.titulo}
              onChange={(e) => setDraft((d) => ({ ...d, titulo: e.target.value }))}
              placeholder="Ej: Luna"
              className="bg-stone-50 dark:bg-white/[0.04] border-stone-200 dark:border-white/[0.08] rounded-xl"
            />
          </div>

          {/* Etiquetas */}
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-stone-400 dark:text-white/30 uppercase tracking-[0.08em]">
              Etiquetas
            </Label>
            <SelectorTags
              tags={tags}
              seleccionados={draft.tagIds}
              onChange={(tagIds) => setDraft((d) => ({ ...d, tagIds }))}
              placeholder="Selecciona etiquetas..."
            />
          </div>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t border-stone-100 dark:border-white/10 px-5 py-4 flex-shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            className="rounded-xl"
          >
            <X className="h-3.5 w-3.5" />
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={aplicar}
            className="rounded-xl bg-lime-500 hover:bg-lime-400 text-stone-950 shadow-[0_0_14px_rgba(132,204,22,0.3)]"
          >
            Aplicar filtros
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
