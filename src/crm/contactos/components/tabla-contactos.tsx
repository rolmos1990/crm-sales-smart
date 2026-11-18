"use client";

import { memo } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Mail, MessageCircle, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FechaHora } from "@/shared/fechas/fecha-hora";
import { useSesion } from "@/shared/auth/sesion-context";
import { cn } from "@/lib/utils";
import { TAMANOS_PAGINA_CONTACTOS, type FiltrosVistaContactos } from "../schema";
import { ETIQUETA_GRUPO_CANAL, type GrupoCanal } from "../segmentacion/canales";
import type { FilaContacto } from "../types";
import { AccionesContacto } from "./acciones-contacto";
import { AvatarContacto } from "./avatar-contacto";
import { InsigniaInteres, InsigniaNoContactar, InsigniaRecomendacion, InsigniaTipo } from "./insignias-contacto";

type Orden = FiltrosVistaContactos["orden"];

function CanalContacto({ canal }: { canal: GrupoCanal | null }) {
  if (!canal) return <span className="text-sm text-muted-foreground">—</span>;
  const Icono = canal === "EMAIL" ? Mail : MessageCircle;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
      <Icono className="size-3.5 text-muted-foreground" aria-hidden />
      {ETIQUETA_GRUPO_CANAL[canal]}
    </span>
  );
}

function EncabezadoOrdenable({
  etiqueta,
  orden,
  filtros,
  onOrdenar,
}: {
  etiqueta: string;
  orden: Exclude<Orden, "PRIORIDAD">;
  filtros: FiltrosVistaContactos;
  onOrdenar: (orden: Orden, direccion?: "asc" | "desc") => void;
}) {
  const activo = filtros.orden === orden;
  const porDefecto = orden === "ULTIMA_ACTIVIDAD" ? "desc" : "asc";
  const direccion = activo ? (filtros.direccion ?? porDefecto) : undefined;
  const Icono = !activo ? ArrowUpDown : direccion === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onOrdenar(orden, activo ? (direccion === "asc" ? "desc" : "asc") : porDefecto)}
      className="inline-flex items-center gap-1 text-xs font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground"
    >
      {etiqueta}
      <Icono className={cn("size-3", activo && "text-foreground")} aria-hidden />
    </button>
  );
}

function ariaSort(filtros: FiltrosVistaContactos, orden: Exclude<Orden, "PRIORIDAD">): "ascending" | "descending" | "none" {
  if (filtros.orden !== orden) return "none";
  const dir = filtros.direccion ?? (orden === "ULTIMA_ACTIVIDAD" ? "desc" : "asc");
  return dir === "asc" ? "ascending" : "descending";
}

function nombreCompleto(f: FilaContacto) {
  return [f.nombre, f.apellido].filter(Boolean).join(" ") || "Sin nombre";
}

const FilaTabla = memo(function FilaTabla({
  fila,
  seleccionada,
  puedeMod,
  mostrarRecomendacion,
  onSeleccionar,
}: {
  fila: FilaContacto;
  seleccionada: boolean;
  puedeMod: boolean;
  mostrarRecomendacion: boolean;
  onSeleccionar: (id: string) => void;
}) {
  return (
    <TableRow
      data-state={seleccionada ? "selected" : undefined}
      className="cursor-pointer"
      onClick={() => onSeleccionar(fila.id)}
    >
      <TableCell>
        <button
          type="button"
          className="flex min-w-0 items-center gap-3 text-left outline-none focus-visible:underline"
          onClick={(e) => {
            e.stopPropagation();
            onSeleccionar(fila.id);
          }}
        >
          <AvatarContacto nombre={fila.nombre} apellido={fila.apellido} avatarUrl={fila.avatarUrl} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-medium text-foreground">{nombreCompleto(fila)}</span>
            {fila.datoSecundario && <span className="block truncate text-xs text-muted-foreground">{fila.datoSecundario}</span>}
          </span>
        </button>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-1">
          <InsigniaTipo tipo={fila.tipo} />
          {fila.noContactar && <InsigniaNoContactar />}
        </div>
      </TableCell>
      <TableCell>
        <InsigniaInteres interes={fila.interes} fijado={fila.interesFijado} />
      </TableCell>
      <TableCell className="text-sm text-foreground">
        <FechaHora valor={fila.ultimaInteraccionEn} modo="relativa" vacio="Sin actividad" />
      </TableCell>
      <TableCell className="hidden xl:table-cell">
        <CanalContacto canal={fila.canal} />
      </TableCell>
      {mostrarRecomendacion && (
        <TableCell className="hidden lg:table-cell">
          <InsigniaRecomendacion recomendacion={fila.recomendacion} />
        </TableCell>
      )}
      <TableCell className="w-10 text-right" onClick={(e) => e.stopPropagation()}>
        {puedeMod && <AccionesContacto contacto={fila} />}
      </TableCell>
    </TableRow>
  );
});

function TarjetaMovil({ fila, onSeleccionar }: { fila: FilaContacto; onSeleccionar: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSeleccionar(fila.id)}
      className="flex w-full items-start gap-3 rounded-xl border border-border-subtle bg-card p-3 text-left"
    >
      <AvatarContacto nombre={fila.nombre} apellido={fila.apellido} avatarUrl={fila.avatarUrl} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate font-medium text-foreground">{nombreCompleto(fila)}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            <FechaHora valor={fila.ultimaInteraccionEn} modo="relativa" vacio="Sin actividad" />
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-1">
          <InsigniaTipo tipo={fila.tipo} />
          <InsigniaInteres interes={fila.interes} fijado={fila.interesFijado} />
          {fila.noContactar && <InsigniaNoContactar />}
        </span>
      </span>
    </button>
  );
}

function Paginacion({
  total,
  pagina,
  tamanoPagina,
  onCambiar,
}: {
  total: number;
  pagina: number;
  tamanoPagina: number;
  onCambiar: (cambios: Partial<FiltrosVistaContactos>) => void;
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / tamanoPagina));
  const desde = total === 0 ? 0 : (pagina - 1) * tamanoPagina + 1;
  const hasta = Math.min(pagina * tamanoPagina, total);
  const items = Object.fromEntries(TAMANOS_PAGINA_CONTACTOS.map((t) => [String(t), `${t} por página`]));
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-border-subtle px-4 py-3 sm:flex-row">
      <p className="text-sm text-muted-foreground">
        Mostrando {desde.toLocaleString("es")}–{hasta.toLocaleString("es")} de {total.toLocaleString("es")} contactos
      </p>
      <div className="flex items-center gap-2">
        <Select
          items={items}
          value={String(tamanoPagina)}
          onValueChange={(v) => v && onCambiar({ tamanoPagina: Number(v) as FiltrosVistaContactos["tamanoPagina"], pagina: 1 })}
        >
          <SelectTrigger size="sm" aria-label="Contactos por página">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TAMANOS_PAGINA_CONTACTOS.map((t) => (
              <SelectItem key={t} value={String(t)}>
                {t} por página
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon-sm" aria-label="Página anterior" disabled={pagina <= 1} onClick={() => onCambiar({ pagina: pagina - 1 })}>
          <ChevronLeft />
        </Button>
        <span className="text-sm tabular-nums text-muted-foreground">
          {pagina} / {totalPaginas}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Página siguiente"
          disabled={pagina >= totalPaginas}
          onClick={() => onCambiar({ pagina: pagina + 1 })}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

export function TablaContactos({
  filas,
  total,
  pagina,
  tamanoPagina,
  filtros,
  hayFiltrosActivos,
  seleccionadoId,
  mostrarRecomendacion,
  onCambiar,
  onLimpiar,
  onSeleccionar,
}: {
  filas: FilaContacto[];
  total: number;
  pagina: number;
  tamanoPagina: number;
  filtros: FiltrosVistaContactos;
  hayFiltrosActivos: boolean;
  seleccionadoId: string | null;
  /** Columna Recomendación (Historia 3). */
  mostrarRecomendacion: boolean;
  onCambiar: (cambios: Partial<FiltrosVistaContactos>) => void;
  onLimpiar: () => void;
  onSeleccionar: (id: string) => void;
}) {
  const { puedeModificar } = useSesion();
  const puedeMod = puedeModificar("contactos");
  const ordenar = (orden: Orden, direccion?: "asc" | "desc") => onCambiar({ orden, direccion, pagina: 1 });

  if (filas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-subtle py-16">
        <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
          <SearchX className="size-5 text-muted-foreground" aria-hidden />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Sin resultados para estos filtros.</p>
        {hayFiltrosActivos && (
          <Button variant="outline" size="sm" onClick={onLimpiar}>
            Limpiar filtros
          </Button>
        )}
      </div>
    );
  }

  return (
    <div data-slot="tabla-contactos" className="overflow-hidden rounded-xl border border-border-subtle bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-2 text-xs text-muted-foreground">
        <span>{filtros.orden === "PRIORIDAD" ? "Ordenado por prioridad de atención" : "Orden personalizado"}</span>
        {filtros.orden !== "PRIORIDAD" && (
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => ordenar("PRIORIDAD", undefined)}>
            Volver a prioridad
          </Button>
        )}
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead aria-sort={ariaSort(filtros, "NOMBRE")}>
                <EncabezadoOrdenable etiqueta="Contacto" orden="NOMBRE" filtros={filtros} onOrdenar={ordenar} />
              </TableHead>
              <TableHead className="text-xs tracking-wide uppercase">Tipo</TableHead>
              <TableHead aria-sort={ariaSort(filtros, "INTERES")}>
                <EncabezadoOrdenable etiqueta="Interés" orden="INTERES" filtros={filtros} onOrdenar={ordenar} />
              </TableHead>
              <TableHead aria-sort={ariaSort(filtros, "ULTIMA_ACTIVIDAD")}>
                <EncabezadoOrdenable etiqueta="Última actividad" orden="ULTIMA_ACTIVIDAD" filtros={filtros} onOrdenar={ordenar} />
              </TableHead>
              <TableHead className="hidden text-xs tracking-wide uppercase xl:table-cell">Canal</TableHead>
              {mostrarRecomendacion && <TableHead className="hidden text-xs tracking-wide uppercase lg:table-cell">Recomendación</TableHead>}
              <TableHead className="w-10">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((f) => (
              <FilaTabla
                key={f.id}
                fila={f}
                seleccionada={f.id === seleccionadoId}
                puedeMod={puedeMod}
                mostrarRecomendacion={mostrarRecomendacion}
                onSeleccionar={onSeleccionar}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2 p-3 md:hidden">
        {filas.map((f) => (
          <TarjetaMovil key={f.id} fila={f} onSeleccionar={onSeleccionar} />
        ))}
      </div>

      <Paginacion total={total} pagina={pagina} tamanoPagina={tamanoPagina} onCambiar={onCambiar} />
    </div>
  );
}
