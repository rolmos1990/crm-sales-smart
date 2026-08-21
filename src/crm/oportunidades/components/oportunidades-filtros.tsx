"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import {
  Search, SlidersHorizontal, RotateCcw, ChevronDown, X, CalendarIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel,
} from "@/components/ui/select";
import { Combobox, type OpcionCombobox } from "@/shared/ui/combobox";
import { MultiCombobox } from "@/shared/ui/multi-combobox";
import { SelectorTags } from "@/crm/tags/components/selector-tags";
import { buscarProductosAction } from "@/shared/productos/actions";
import { buscarContactosAction } from "@/crm/contactos/actions";
import { buscarEmpresasAction } from "@/crm/empresas/actions";
import { cn } from "@/lib/utils";
import { ETAPAS_PIPELINE } from "../types";
import type { Tag } from "@/crm/tags/types";

export interface PipelineConEtapasResumen {
  id: string;
  nombre: string;
  stages: { id: string; nombre: string; color: string | null }[];
}

interface OportunidadesFiltrosBarProps {
  productosIniciales: OpcionCombobox[];
  contactosIniciales: OpcionCombobox[];
  empresasIniciales: OpcionCombobox[];
  usuarios: OpcionCombobox[];
  tags: Tag[];
  pipelines: PipelineConEtapasResumen[];
}

const VENCIMIENTO_OPCIONES: { valor: string; etiqueta: string }[] = [
  { valor: "vencidas", etiqueta: "Vencidas" },
  { valor: "hoy", etiqueta: "Vencen hoy" },
  { valor: "7dias", etiqueta: "Próximos 7 días" },
  { valor: "30dias", etiqueta: "Próximos 30 días" },
  { valor: "sinfecha", etiqueta: "Sin fecha de vencimiento" },
  { valor: "personalizado", etiqueta: "Rango personalizado" },
];

const ESTADO_OPCIONES: { valor: string; etiqueta: string }[] = [
  { valor: "activas", etiqueta: "Activas" },
  { valor: "ganadas", etiqueta: "Ganadas" },
  { valor: "perdidas", etiqueta: "Perdidas" },
  { valor: "todas", etiqueta: "Todas" },
];

const CLAVES_FILTRO = [
  "q", "productoIds", "contactoIds", "vencimiento", "vencDesde", "vencHasta",
  "etapaId", "etapa", "estado", "responsable", "tagIds", "empresaId",
  "valorMin", "valorMax", "probMin", "probMax", "creadoDesde", "creadoHasta",
  "cotizacion", "actividadPendiente", "sinActividadReciente",
];

const CLAVES_MAS_FILTROS = [
  "etapaId", "etapa", "estado", "responsable", "tagIds", "empresaId",
  "valorMin", "valorMax", "probMin", "probMax", "creadoDesde", "creadoHasta",
  "cotizacion", "actividadPendiente", "sinActividadReciente",
];

function csvAArray(valor: string | null): string[] {
  return valor ? valor.split(",").filter(Boolean) : [];
}

export function OportunidadesFiltrosBar({
  productosIniciales, contactosIniciales, empresasIniciales, usuarios, tags, pipelines,
}: OportunidadesFiltrosBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [busqueda, setBusqueda] = useState(searchParams.get("q") ?? "");
  const [masFiltrosAbierto, setMasFiltrosAbierto] = useState(false);
  const [vencimientoAbierto, setVencimientoAbierto] = useState(false);
  const [rangoVencAbierto, setRangoVencAbierto] = useState(false);

  // Etiquetas resueltas para pintar los chips de producto/contacto sin
  // volver a pedirle al servidor los ids ya elegidos.
  const [productosConEtiqueta, setProductosConEtiqueta] = useState<OpcionCombobox[]>(
    () => productosIniciales.filter((p) => csvAArray(searchParams.get("productoIds")).includes(p.valor))
  );
  const [contactosConEtiqueta, setContactosConEtiqueta] = useState<OpcionCombobox[]>(
    () => contactosIniciales.filter((c) => csvAArray(searchParams.get("contactoIds")).includes(c.valor))
  );

  // ── Borrador de "Más filtros" — se aplica de una sola vez con el botón
  // "Aplicar", en vez de empujar un cambio de URL por cada campo tocado.
  const [draftEtapa, setDraftEtapa] = useState(searchParams.get("etapaId") ?? searchParams.get("etapa") ?? "");
  const [draftEstado, setDraftEstado] = useState(searchParams.get("estado") ?? "");
  const [draftResponsable, setDraftResponsable] = useState(searchParams.get("responsable") ?? "");
  const [draftTagIds, setDraftTagIds] = useState<string[]>(csvAArray(searchParams.get("tagIds")));
  const [draftEmpresaId, setDraftEmpresaId] = useState(searchParams.get("empresaId") ?? "");
  const [draftValorMin, setDraftValorMin] = useState(searchParams.get("valorMin") ?? "");
  const [draftValorMax, setDraftValorMax] = useState(searchParams.get("valorMax") ?? "");
  const [draftProbMin, setDraftProbMin] = useState(searchParams.get("probMin") ?? "");
  const [draftProbMax, setDraftProbMax] = useState(searchParams.get("probMax") ?? "");
  const [draftCreadoDesde, setDraftCreadoDesde] = useState(searchParams.get("creadoDesde") ?? "");
  const [draftCreadoHasta, setDraftCreadoHasta] = useState(searchParams.get("creadoHasta") ?? "");
  const [draftCotizacion, setDraftCotizacion] = useState(searchParams.get("cotizacion") ?? "");
  const [draftActividadPendiente, setDraftActividadPendiente] = useState(searchParams.get("actividadPendiente") === "1");
  const [draftSinActividadReciente, setDraftSinActividadReciente] = useState(searchParams.get("sinActividadReciente") === "1");

  // Reabrir el popover con un filtro ya aplicado (ej. recargando la URL)
  // debe reflejar el estado real, no lo que quedó en el borrador anterior.
  useEffect(() => {
    if (masFiltrosAbierto) return;
    setDraftEtapa(searchParams.get("etapaId") ?? searchParams.get("etapa") ?? "");
    setDraftEstado(searchParams.get("estado") ?? "");
    setDraftResponsable(searchParams.get("responsable") ?? "");
    setDraftTagIds(csvAArray(searchParams.get("tagIds")));
    setDraftEmpresaId(searchParams.get("empresaId") ?? "");
    setDraftValorMin(searchParams.get("valorMin") ?? "");
    setDraftValorMax(searchParams.get("valorMax") ?? "");
    setDraftProbMin(searchParams.get("probMin") ?? "");
    setDraftProbMax(searchParams.get("probMax") ?? "");
    setDraftCreadoDesde(searchParams.get("creadoDesde") ?? "");
    setDraftCreadoHasta(searchParams.get("creadoHasta") ?? "");
    setDraftCotizacion(searchParams.get("cotizacion") ?? "");
    setDraftActividadPendiente(searchParams.get("actividadPendiente") === "1");
    setDraftSinActividadReciente(searchParams.get("sinActividadReciente") === "1");
  }, [searchParams, masFiltrosAbierto]);

  const navegarConParams = (params: URLSearchParams) => {
    // Cualquier cambio de filtro vuelve a la primera página.
    params.delete("pagina");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const actualizarParam = (clave: string, valor: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set(clave, valor);
    else params.delete(clave);
    navegarConParams(params);
  };

  // Búsqueda con debounce — no dispara una navegación por cada tecla.
  useEffect(() => {
    const actual = searchParams.get("q") ?? "";
    if (busqueda === actual) return;
    const t = setTimeout(() => actualizarParam("q", busqueda || null), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  const hayFiltros = CLAVES_FILTRO.some((k) => searchParams.get(k));
  const hayMasFiltros = CLAVES_MAS_FILTROS.some((k) => searchParams.get(k));
  const cantidadMasFiltros = CLAVES_MAS_FILTROS.filter((k) => searchParams.get(k)).length;

  const vencimientoActual = searchParams.get("vencimiento");
  const vencDesdeStr = searchParams.get("vencDesde");
  const vencHastaStr = searchParams.get("vencHasta");
  const rangoVenc: DateRange | undefined = useMemo(
    () => (vencDesdeStr || vencHastaStr
      ? { from: vencDesdeStr ? new Date(`${vencDesdeStr}T00:00:00`) : undefined, to: vencHastaStr ? new Date(`${vencHastaStr}T00:00:00`) : undefined }
      : undefined),
    [vencDesdeStr, vencHastaStr]
  );

  const etiquetaVencimiento = vencimientoActual === "personalizado"
    ? (rangoVenc?.from
      ? `${format(rangoVenc.from, "dd MMM", { locale: es })}${rangoVenc.to ? ` - ${format(rangoVenc.to, "dd MMM", { locale: es })}` : ""}`
      : "Rango personalizado")
    : (VENCIMIENTO_OPCIONES.find((o) => o.valor === vencimientoActual)?.etiqueta ?? "Vencimiento: Todas");

  const seleccionarVencimiento = (valor: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (valor === "personalizado") {
      params.set("vencimiento", "personalizado");
      setVencimientoAbierto(false);
      setRangoVencAbierto(true);
      navegarConParams(params);
      return;
    }
    params.set("vencimiento", valor);
    params.delete("vencDesde");
    params.delete("vencHasta");
    setVencimientoAbierto(false);
    navegarConParams(params);
  };

  const handleRangoVenc = (r: DateRange | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("vencimiento", "personalizado");
    if (r?.from) params.set("vencDesde", format(r.from, "yyyy-MM-dd")); else params.delete("vencDesde");
    if (r?.to) params.set("vencHasta", format(r.to, "yyyy-MM-dd")); else params.delete("vencHasta");
    navegarConParams(params);
    if (r?.from && r?.to) setRangoVencAbierto(false);
  };

  const aplicarMasFiltros = () => {
    const params = new URLSearchParams(searchParams.toString());
    // Etapa dinámica vs legacy son mutuamente excluyentes — draftEtapa guarda
    // el id/valor elegido sin distinguir cuál es; se resuelve acá.
    params.delete("etapaId");
    params.delete("etapa");
    if (draftEtapa) {
      const esDinamica = pipelines.some((p) => p.stages.some((s) => s.id === draftEtapa));
      if (esDinamica) params.set("etapaId", draftEtapa);
      else params.set("etapa", draftEtapa);
    }
    if (draftEstado) params.set("estado", draftEstado); else params.delete("estado");
    if (draftResponsable) params.set("responsable", draftResponsable); else params.delete("responsable");
    if (draftTagIds.length > 0) params.set("tagIds", draftTagIds.join(",")); else params.delete("tagIds");
    if (draftEmpresaId) params.set("empresaId", draftEmpresaId); else params.delete("empresaId");
    if (draftValorMin) params.set("valorMin", draftValorMin); else params.delete("valorMin");
    if (draftValorMax) params.set("valorMax", draftValorMax); else params.delete("valorMax");
    if (draftProbMin) params.set("probMin", draftProbMin); else params.delete("probMin");
    if (draftProbMax) params.set("probMax", draftProbMax); else params.delete("probMax");
    if (draftCreadoDesde) params.set("creadoDesde", draftCreadoDesde); else params.delete("creadoDesde");
    if (draftCreadoHasta) params.set("creadoHasta", draftCreadoHasta); else params.delete("creadoHasta");
    if (draftCotizacion) params.set("cotizacion", draftCotizacion); else params.delete("cotizacion");
    if (draftActividadPendiente) params.set("actividadPendiente", "1"); else params.delete("actividadPendiente");
    if (draftSinActividadReciente) params.set("sinActividadReciente", "1"); else params.delete("sinActividadReciente");
    setMasFiltrosAbierto(false);
    navegarConParams(params);
  };

  const limpiarMasFiltros = () => {
    const params = new URLSearchParams(searchParams.toString());
    for (const k of CLAVES_MAS_FILTROS) params.delete(k);
    setMasFiltrosAbierto(false);
    navegarConParams(params);
  };

  const limpiarTodo = () => {
    setBusqueda("");
    setProductosConEtiqueta([]);
    setContactosConEtiqueta([]);
    router.push(pathname);
  };

  // ── Chips de filtros activos ────────────────────────────────────────────
  const etapaSeleccionadaId = searchParams.get("etapaId");
  const etapaSeleccionadaLegacy = searchParams.get("etapa");
  const etapaEtiqueta = etapaSeleccionadaId
    ? pipelines.flatMap((p) => p.stages).find((s) => s.id === etapaSeleccionadaId)?.nombre
    : etapaSeleccionadaLegacy
      ? ETAPAS_PIPELINE.find((e) => e.valor === etapaSeleccionadaLegacy)?.etiqueta
      : undefined;

  const chips: { clave: string; etiqueta: string; onQuitar: () => void }[] = [];
  if (searchParams.get("productoIds")) {
    for (const p of productosConEtiqueta) {
      chips.push({
        clave: `producto-${p.valor}`,
        etiqueta: `Producto: ${p.etiqueta}`,
        onQuitar: () => {
          const restantes = productosConEtiqueta.filter((x) => x.valor !== p.valor);
          setProductosConEtiqueta(restantes);
          actualizarParam("productoIds", restantes.length > 0 ? restantes.map((x) => x.valor).join(",") : null);
        },
      });
    }
  }
  if (searchParams.get("contactoIds")) {
    for (const c of contactosConEtiqueta) {
      chips.push({
        clave: `contacto-${c.valor}`,
        etiqueta: `Contacto: ${c.etiqueta}`,
        onQuitar: () => {
          const restantes = contactosConEtiqueta.filter((x) => x.valor !== c.valor);
          setContactosConEtiqueta(restantes);
          actualizarParam("contactoIds", restantes.length > 0 ? restantes.map((x) => x.valor).join(",") : null);
        },
      });
    }
  }
  if (vencimientoActual) {
    chips.push({
      clave: "vencimiento",
      etiqueta: `Vencimiento: ${etiquetaVencimiento}`,
      onQuitar: () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("vencimiento"); params.delete("vencDesde"); params.delete("vencHasta");
        navegarConParams(params);
      },
    });
  }
  if (etapaEtiqueta) {
    chips.push({
      clave: "etapa",
      etiqueta: `Etapa: ${etapaEtiqueta}`,
      onQuitar: () => { const p = new URLSearchParams(searchParams.toString()); p.delete("etapaId"); p.delete("etapa"); navegarConParams(p); },
    });
  }
  if (searchParams.get("estado")) {
    chips.push({
      clave: "estado",
      etiqueta: `Estado: ${ESTADO_OPCIONES.find((o) => o.valor === searchParams.get("estado"))?.etiqueta}`,
      onQuitar: () => actualizarParam("estado", null),
    });
  }
  if (searchParams.get("responsable")) {
    chips.push({
      clave: "responsable",
      etiqueta: `Responsable: ${usuarios.find((u) => u.valor === searchParams.get("responsable"))?.etiqueta ?? ""}`,
      onQuitar: () => actualizarParam("responsable", null),
    });
  }
  for (const tagId of csvAArray(searchParams.get("tagIds"))) {
    const tag = tags.find((t) => t.id === tagId);
    if (!tag) continue;
    chips.push({
      clave: `tag-${tagId}`,
      etiqueta: `Etiqueta: ${tag.nombre}`,
      onQuitar: () => {
        const restantes = csvAArray(searchParams.get("tagIds")).filter((id) => id !== tagId);
        actualizarParam("tagIds", restantes.length > 0 ? restantes.join(",") : null);
      },
    });
  }
  if (searchParams.get("empresaId")) {
    const emp = empresasIniciales.find((e) => e.valor === searchParams.get("empresaId"));
    chips.push({ clave: "empresa", etiqueta: `Empresa: ${emp?.etiqueta ?? ""}`, onQuitar: () => actualizarParam("empresaId", null) });
  }
  if (searchParams.get("valorMin") || searchParams.get("valorMax")) {
    chips.push({
      clave: "valor",
      etiqueta: `Valor: ${searchParams.get("valorMin") ?? "0"} – ${searchParams.get("valorMax") ?? "∞"}`,
      onQuitar: () => { const p = new URLSearchParams(searchParams.toString()); p.delete("valorMin"); p.delete("valorMax"); navegarConParams(p); },
    });
  }
  if (searchParams.get("probMin") || searchParams.get("probMax")) {
    chips.push({
      clave: "probabilidad",
      etiqueta: `Probabilidad: ${searchParams.get("probMin") ?? "0"}% – ${searchParams.get("probMax") ?? "100"}%`,
      onQuitar: () => { const p = new URLSearchParams(searchParams.toString()); p.delete("probMin"); p.delete("probMax"); navegarConParams(p); },
    });
  }
  if (searchParams.get("creadoDesde") || searchParams.get("creadoHasta")) {
    chips.push({
      clave: "creado",
      etiqueta: "Creada en rango personalizado",
      onQuitar: () => { const p = new URLSearchParams(searchParams.toString()); p.delete("creadoDesde"); p.delete("creadoHasta"); navegarConParams(p); },
    });
  }
  if (searchParams.get("cotizacion")) {
    chips.push({
      clave: "cotizacion",
      etiqueta: searchParams.get("cotizacion") === "con" ? "Con cotización" : "Sin cotización",
      onQuitar: () => actualizarParam("cotizacion", null),
    });
  }
  if (searchParams.get("actividadPendiente") === "1") {
    chips.push({ clave: "actividadPendiente", etiqueta: "Con actividades pendientes", onQuitar: () => actualizarParam("actividadPendiente", null) });
  }
  if (searchParams.get("sinActividadReciente") === "1") {
    chips.push({ clave: "sinActividadReciente", etiqueta: "Sin actividad reciente", onQuitar: () => actualizarParam("sinActividadReciente", null) });
  }

  const opcionesEtapaItems: Record<string, string> = {};
  for (const p of pipelines) for (const s of p.stages) opcionesEtapaItems[s.id] = s.nombre;
  if (pipelines.length === 0) for (const e of ETAPAS_PIPELINE) opcionesEtapaItems[e.valor] = e.etiqueta;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar oportunidad..."
            className="pl-9 rounded-xl"
          />
        </div>

        <div className="w-[190px]">
          <MultiCombobox
            opciones={productosIniciales}
            valores={csvAArray(searchParams.get("productoIds"))}
            onChange={(vals) => actualizarParam("productoIds", vals.length > 0 ? vals.join(",") : null)}
            onChangeConEtiquetas={setProductosConEtiqueta}
            onBuscar={async (q) => (await buscarProductosAction(q)).map((p) => ({ valor: p.id, etiqueta: p.nombre }))}
            placeholder="Producto"
            placeholderBusqueda="Buscar producto..."
          />
        </div>

        <div className="w-[190px]">
          <MultiCombobox
            opciones={contactosIniciales}
            valores={csvAArray(searchParams.get("contactoIds"))}
            onChange={(vals) => actualizarParam("contactoIds", vals.length > 0 ? vals.join(",") : null)}
            onChangeConEtiquetas={setContactosConEtiqueta}
            onBuscar={async (q) => (await buscarContactosAction(q)).map((c) => ({
              valor: c.id, etiqueta: `${c.nombre} ${c.apellido}`, subtitulo: c.telefonoPrincipal ?? c.email ?? undefined,
            }))}
            placeholder="Contacto"
            placeholderBusqueda="Buscar contacto..."
          />
        </div>

        <Popover open={vencimientoAbierto} onOpenChange={setVencimientoAbierto}>
          <PopoverTrigger className={cn(buttonVariants({ variant: "outline" }), "rounded-xl gap-2 justify-start font-normal")}>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            {etiquetaVencimiento}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-1">
            {VENCIMIENTO_OPCIONES.map((op) => (
              <button
                key={op.valor}
                type="button"
                onClick={() => seleccionarVencimiento(op.valor)}
                className={cn(
                  "w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors",
                  vencimientoActual === op.valor ? "bg-primary-muted text-primary" : "text-foreground hover:bg-muted"
                )}
              >
                {op.etiqueta}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {vencimientoActual === "personalizado" && (
          <Popover open={rangoVencAbierto} onOpenChange={setRangoVencAbierto}>
            <PopoverTrigger className={cn(buttonVariants({ variant: "outline", size: "icon" }), "rounded-xl")} title="Elegir rango de fechas">
              <CalendarIcon className="h-4 w-4" />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="range"
                selected={rangoVenc}
                onSelect={handleRangoVenc}
                defaultMonth={rangoVenc?.from ?? new Date()}
                numberOfMonths={2}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                locale={es as any}
              />
            </PopoverContent>
          </Popover>
        )}

        <Popover open={masFiltrosAbierto} onOpenChange={setMasFiltrosAbierto}>
          <PopoverTrigger className={cn(buttonVariants({ variant: "outline" }), "rounded-xl gap-2")}>
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
            {cantidadMasFiltros > 0 && (
              <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {cantidadMasFiltros}
              </span>
            )}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[26rem] max-h-[70vh] overflow-y-auto p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Etapa</label>
                <Select
                  items={opcionesEtapaItems}
                  value={draftEtapa || "todas"}
                  onValueChange={(v) => setDraftEtapa(!v || v === "todas" ? "" : v)}
                >
                  <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {pipelines.length > 0 ? pipelines.map((p) => (
                      <SelectGroup key={p.id}>
                        <SelectLabel>{p.nombre}</SelectLabel>
                        {p.stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
                      </SelectGroup>
                    )) : ETAPAS_PIPELINE.map((e) => (
                      <SelectItem key={e.valor} value={e.valor}>{e.etiqueta}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</label>
                <Select
                  items={Object.fromEntries(ESTADO_OPCIONES.map((o) => [o.valor, o.etiqueta]))}
                  value={draftEstado || "todas"}
                  onValueChange={(v) => setDraftEstado(!v || v === "todas" ? "" : v)}
                >
                  <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESTADO_OPCIONES.map((o) => <SelectItem key={o.valor} value={o.valor}>{o.etiqueta}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Responsable</label>
              <Combobox
                opciones={usuarios}
                valor={draftResponsable}
                onChange={setDraftResponsable}
                placeholder="Cualquier responsable"
                placeholderBusqueda="Buscar responsable..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Empresa</label>
              <Combobox
                opciones={empresasIniciales}
                valor={draftEmpresaId}
                onChange={setDraftEmpresaId}
                onBuscar={async (q) => (await buscarEmpresasAction(q)).map((e) => ({ valor: e.id, etiqueta: e.nombre }))}
                placeholder="Cualquier empresa"
                placeholderBusqueda="Buscar empresa..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Etiquetas</label>
              <SelectorTags tags={tags} seleccionados={draftTagIds} onChange={setDraftTagIds} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor mínimo</label>
                <Input type="number" min={0} value={draftValorMin} onChange={(e) => setDraftValorMin(e.target.value)} placeholder="0" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor máximo</label>
                <Input type="number" min={0} value={draftValorMax} onChange={(e) => setDraftValorMax(e.target.value)} placeholder="Sin límite" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Probabilidad mín. (%)</label>
                <Input type="number" min={0} max={100} value={draftProbMin} onChange={(e) => setDraftProbMin(e.target.value)} placeholder="0" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Probabilidad máx. (%)</label>
                <Input type="number" min={0} max={100} value={draftProbMax} onChange={(e) => setDraftProbMax(e.target.value)} placeholder="100" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Creada desde</label>
                <Input type="date" value={draftCreadoDesde} onChange={(e) => setDraftCreadoDesde(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Creada hasta</label>
                <Input type="date" value={draftCreadoHasta} onChange={(e) => setDraftCreadoHasta(e.target.value)} className="rounded-xl" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cotización</label>
              <Select
                items={{ todas: "Con o sin cotización", con: "Con cotización", sin: "Sin cotización" }}
                value={draftCotizacion || "todas"}
                onValueChange={(v) => setDraftCotizacion(!v || v === "todas" ? "" : v)}
              >
                <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Con o sin cotización</SelectItem>
                  <SelectItem value="con">Con cotización</SelectItem>
                  <SelectItem value="sin">Sin cotización</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={draftActividadPendiente}
                  onChange={(e) => setDraftActividadPendiente(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                />
                Con actividades pendientes
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={draftSinActividadReciente}
                  onChange={(e) => setDraftSinActividadReciente(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                />
                Sin actividad reciente (14 días)
              </label>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
              {hayMasFiltros ? (
                <Button variant="ghost" size="sm" onClick={limpiarMasFiltros} className="gap-1.5 text-muted-foreground">
                  <RotateCcw className="h-3.5 w-3.5" /> Limpiar estos filtros
                </Button>
              ) : <span />}
              <Button size="sm" onClick={aplicarMasFiltros} className="rounded-lg">Aplicar</Button>
            </div>
          </PopoverContent>
        </Popover>

        {hayFiltros && (
          <Button variant="ghost" onClick={limpiarTodo} className="gap-1.5 text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5" />
            Limpiar
          </Button>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.clave}
              className="inline-flex items-center gap-1 rounded-full bg-badge-bg text-badge-text text-xs px-2.5 py-1"
            >
              {chip.etiqueta}
              <button type="button" onClick={chip.onQuitar} className="hover:text-foreground" aria-label={`Quitar filtro ${chip.etiqueta}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
