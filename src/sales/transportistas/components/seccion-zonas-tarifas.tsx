"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, Coins, Copy, MapPinPlus, MoreHorizontal, Pencil, Percent, Plus, Power, Search, Tag, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { duplicarTarifa, eliminarTarifa, toggleTarifa } from "../tarifas/actions";
import { eliminarZonaEntrega } from "../zonas/actions";
import { BotonExportarDestinos } from "./boton-exportar-destinos";
import { WizardImportacionDestinos } from "../importacion-destinos/components/wizard-importacion-destinos";
import { DialogAliasUbicacion } from "./dialog-alias-ubicacion";
import { DialogEditarZona, type ZonaEditable } from "./dialog-editar-zona";
import { DialogTarifa, type TarifaExistente } from "./dialog-tarifa";
import { DialogZonaEntrega } from "./dialog-zona-entrega";

/** Máximo de etiquetas de cobertura antes de resumir el resto en "+N más". */
const MAX_ETIQUETAS_COBERTURA = 3;

interface TarifaFila {
  id: string;
  zonaEntrega: { id: string; nombre: string };
  // 023-transportistas-por-pais — ubicaciones reales de catálogo (FR-007),
  // ya deduplicadas para presentación por `resumirCobertura` en la página.
  cobertura: { etiqueta: string; detalle: string }[];
  servicioTransportista: { id: string; nombre: string };
  costoInterno: number;
  precioCliente: number;
  margen: number;
  tiempoMinimoDias: number | null;
  tiempoMaximoDias: number | null;
  activa: boolean;
  usada: boolean;
}

interface SeccionZonasTarifasProps {
  transportistaId: string;
  // 023-transportistas-por-pais — null = "país pendiente" (FR-009): se
  // deshabilita agregar zonas/tarifas nuevas hasta completarlo.
  pais: { nombre: string; banderaEmoji: string | null } | null;
  paisId: string | null;
  /** Catálogo de zonas del país del transportista, con sus ubicaciones para
   *  poder editarlas sin una consulta extra al abrir el modal. */
  zonasIniciales: ZonaEditable[];
  servicios: { id: string; nombre: string }[];
  tarifas: TarifaFila[];
  promedio: { costoPromedio: number; margenPromedio: number; cantidad: number };
  /** Código ISO de la moneda principal de la empresa (no hay moneda por tarifa). */
  moneda: string;
  puedeVerCostos: boolean;
  puedeModificar: boolean;
}

// 022-transportistas-zonas-tarifas — pestaña "Zonas y tarifas" (FR-014 a
// FR-022). Costo/margen se ocultan por completo cuando el usuario no tiene
// el permiso "transportistas-costos" (US5, Fase 7 — no implementado en esta
// pasada; se deja el flag `puedeVerCostos` cableado para esa historia).
export function SeccionZonasTarifas({
  transportistaId, pais, paisId, zonasIniciales, servicios, tarifas, promedio, moneda, puedeVerCostos, puedeModificar,
}: SeccionZonasTarifasProps) {
  const paisLabel = pais ? `${pais.banderaEmoji ? `${pais.banderaEmoji} ` : ""}${pais.nombre}`.trim() : null;
  const puedeAgregar = puedeModificar && paisId != null;
  const [zonas, setZonas] = useState(zonasIniciales);
  const [busqueda, setBusqueda] = useState("");
  const [dialogTarifaAbierto, setDialogTarifaAbierto] = useState(false);
  const [tarifaEnEdicion, setTarifaEnEdicion] = useState<TarifaExistente | undefined>(undefined);
  const [zonaPreseleccionadaId, setZonaPreseleccionadaId] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();
  // 024-alias-ubicaciones-transportistas
  const [zonaAliasSeleccionada, setZonaAliasSeleccionada] = useState<{ id: string; nombre: string } | null>(null);
  const [zonaEnEdicionId, setZonaEnEdicionId] = useState<string | null>(null);
  const [wizardImportacionAbierto, setWizardImportacionAbierto] = useState(false);
  /** Ids de las tarifas cuya cobertura completa está desplegada. */
  const [coberturasAbiertas, setCoberturasAbiertas] = useState<ReadonlySet<string>>(new Set());

  // No hay moneda por tarifa: los importes están en la moneda principal de la
  // empresa. Un código inválido haría explotar a Intl, de ahí el respaldo.
  const formatearImporte = useMemo(() => {
    try {
      const formato = new Intl.NumberFormat("es-PE", {
        style: "currency",
        currency: moneda,
        currencyDisplay: "narrowSymbol",
      });
      return (valor: number) => formato.format(valor);
    } catch {
      return (valor: number) => `${moneda} ${valor.toFixed(2)}`;
    }
  }, [moneda]);

  const totalColumnas = 5 + (puedeVerCostos ? 2 : 0);

  const alternarCobertura = useCallback((tarifaId: string) => {
    setCoberturasAbiertas((prev) => {
      const siguiente = new Set(prev);
      if (!siguiente.delete(tarifaId)) siguiente.add(tarifaId);
      return siguiente;
    });
  }, []);

  const zonasFiltradas = useMemo(
    () => (busqueda ? zonas.filter((z) => z.nombre.toLowerCase().includes(busqueda.toLowerCase())) : zonas),
    [zonas, busqueda],
  );

  const tarifasVisibles = useMemo(
    () => (busqueda ? tarifas.filter((t) => zonasFiltradas.some((z) => z.id === t.zonaEntrega.id)) : tarifas),
    [tarifas, zonasFiltradas, busqueda],
  );

  // 023-transportistas-por-pais — una zona recién creada no tiene fila
  // propia (la tabla lista tarifas, no zonas): sin esto, "Agregar zona" deja
  // la zona invisible hasta que se le agregue una tarifa. Se muestran acá
  // aparte, con un atajo directo para agregarle la primera tarifa.
  const zonaEnEdicion = useMemo(
    () => zonas.find((z) => z.id === zonaEnEdicionId) ?? null,
    [zonas, zonaEnEdicionId],
  );

  const tarifasDeLaZonaEnEdicion = useMemo(
    () =>
      tarifas
        .filter((t) => t.zonaEntrega.id === zonaEnEdicionId)
        .map((t) => ({
          id: t.id,
          servicioTransportistaId: t.servicioTransportista.id,
          costoInterno: t.costoInterno,
          precioCliente: t.precioCliente,
          tiempoMinimoDias: t.tiempoMinimoDias,
          tiempoMaximoDias: t.tiempoMaximoDias,
        })),
    [tarifas, zonaEnEdicionId],
  );

  const zonasSinTarifa = useMemo(() => {
    const idsConTarifa = new Set(tarifas.map((t) => t.zonaEntrega.id));
    return zonasFiltradas.filter((z) => !idsConTarifa.has(z.id));
  }, [zonasFiltradas, tarifas]);

  function abrirNuevaTarifa() {
    setTarifaEnEdicion(undefined);
    setZonaPreseleccionadaId(undefined);
    setDialogTarifaAbierto(true);
  }

  function abrirNuevaTarifaParaZona(zonaId: string) {
    setTarifaEnEdicion(undefined);
    setZonaPreseleccionadaId(zonaId);
    setDialogTarifaAbierto(true);
  }

  function handleEliminarZona(id: string) {
    startTransition(async () => {
      const resultado = await eliminarZonaEntrega(id);
      if (!resultado.exito) toast.error(resultado.error);
      else {
        toast.success("Zona eliminada");
        setZonas((prev) => prev.filter((z) => z.id !== id));
      }
    });
  }

  function abrirEdicion(tarifa: TarifaFila) {
    setZonaPreseleccionadaId(undefined);
    setTarifaEnEdicion({
      id: tarifa.id,
      zonaEntregaId: tarifa.zonaEntrega.id,
      servicioTransportistaId: tarifa.servicioTransportista.id,
      costoInterno: tarifa.costoInterno,
      precioCliente: tarifa.precioCliente,
      tiempoMinimoDias: tarifa.tiempoMinimoDias,
      tiempoMaximoDias: tarifa.tiempoMaximoDias,
    });
    setDialogTarifaAbierto(true);
  }

  function handleDuplicar(id: string) {
    startTransition(async () => {
      const resultado = await duplicarTarifa(id);
      if (!resultado.exito) toast.error(resultado.error);
      else toast.success("Tarifa duplicada — edítala para ajustar zona o servicio");
    });
  }

  function handleToggle(id: string) {
    startTransition(async () => {
      const resultado = await toggleTarifa(id);
      if (!resultado.exito) toast.error(resultado.error);
    });
  }

  function handleEliminar(id: string) {
    startTransition(async () => {
      const resultado = await eliminarTarifa(id);
      if (!resultado.exito) toast.error(resultado.error);
      else toast.success("Tarifa eliminada");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {puedeVerCostos && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-xl">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <div className="rounded-xl bg-primary-subtle p-2.5">
              <Coins aria-hidden className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Costo promedio</p>
              <p className="text-2xl font-semibold tabular-nums text-foreground">{formatearImporte(promedio.costoPromedio)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <div className="rounded-xl bg-primary-subtle p-2.5">
              <Percent aria-hidden className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Margen promedio</p>
              <p className="text-2xl font-semibold tabular-nums text-foreground">{formatearImporte(promedio.margenPromedio)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar zona..."
            aria-label="Buscar zona"
            className="h-10 pl-9"
          />
        </div>
        {puedeModificar && (
          <div className="flex flex-wrap items-center gap-2">
            {puedeAgregar ? (
              <>
                <DialogZonaEntrega paisId={paisId!} paisLabel={paisLabel!} onCreada={(z) => setZonas((prev) => [...prev, z])} />
                <Button type="button" className="h-10 gap-1.5" onClick={abrirNuevaTarifa} disabled={zonas.length === 0}>
                  <Plus className="h-4 w-4" />
                  Agregar tarifa
                </Button>
                <Button type="button" variant="outline" className="h-10 gap-1.5" onClick={() => setWizardImportacionAbierto(true)}>
                  <Upload className="h-4 w-4" />
                  Importar destinos
                </Button>
                <BotonExportarDestinos transportistaId={transportistaId} deshabilitado={tarifas.length === 0} />
              </>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-2">
                    <Button type="button" variant="outline" className="h-10 gap-1.5" disabled>
                      <Plus className="h-4 w-4" />
                      Agregar zona
                    </Button>
                    <Button type="button" className="h-10 gap-1.5" disabled>
                      <Plus className="h-4 w-4" />
                      Agregar tarifa
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-xs">
                    Completa el país del transportista para configurar zonas
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}
      </div>

      {zonasSinTarifa.length > 0 && (
        <div className="rounded-xl border border-dashed border-border p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <MapPinPlus className="h-3.5 w-3.5" />
            {zonasSinTarifa.length === 1 ? "Zona sin tarifa" : "Zonas sin tarifa"} — agrégales una tarifa para que aparezcan en la tabla
          </p>
          {zonasSinTarifa.map((z) => (
            <div key={z.id} className="flex items-center justify-between gap-2 rounded-lg bg-card px-3 py-2">
              <span className="text-sm font-medium text-foreground">{z.nombre}</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setZonaAliasSeleccionada({ id: z.id, nombre: z.nombre })}
                  aria-label="Administrar alias de este destino"
                  title="Alias"
                >
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                {puedeModificar && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setZonaEnEdicionId(z.id)}
                      aria-label={`Editar la zona ${z.nombre}`}
                      title="Editar zona"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => abrirNuevaTarifaParaZona(z.id)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Agregar tarifa
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={isPending}
                      onClick={() => handleEliminarZona(z.id)}
                      aria-label="Eliminar zona"
                      title="Eliminar zona"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* `min-w` + scroll horizontal: en pantallas angostas las columnas se
          desplazan en bloque en vez de aplastar nombres e importes. */}
      <div className="min-w-0 overflow-x-auto rounded-xl border border-border">
        <Table className="min-w-[56rem]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-12 px-4 text-sm">Zona</TableHead>
              {/* `w-full` reparte a esta columna todo el ancho que sobra: es
                  la única de contenido variable y la que antes se cortaba. */}
              <TableHead className="h-12 w-full px-4 text-sm">Cobertura</TableHead>
              <TableHead className="h-12 px-4 text-sm">Servicio</TableHead>
              {puedeVerCostos && <TableHead className="h-12 px-4 text-right text-sm">Costo</TableHead>}
              <TableHead className="h-12 px-4 text-right text-sm">Precio cliente</TableHead>
              {puedeVerCostos && <TableHead className="h-12 px-4 text-right text-sm">Margen</TableHead>}
              <TableHead className="h-12 px-4 text-right text-sm">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tarifasVisibles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={totalColumnas} className="py-10 text-center text-sm text-muted-foreground">
                  Sin tarifas configuradas
                </TableCell>
              </TableRow>
            ) : (
              tarifasVisibles.map((t) => {
                const abierta = coberturasAbiertas.has(t.id);
                const visibles = abierta ? t.cobertura : t.cobertura.slice(0, MAX_ETIQUETAS_COBERTURA);
                const ocultas = t.cobertura.length - visibles.length;
                const entrega =
                  t.tiempoMinimoDias != null || t.tiempoMaximoDias != null
                    ? `${t.tiempoMinimoDias ?? "?"}-${t.tiempoMaximoDias ?? "?"} días`
                    : null;
                return (
                  <TableRow key={t.id} className={cn("align-middle", !t.activa && "opacity-60")}>
                    <TableCell className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium text-foreground">{t.zonaEntrega.nombre}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => setZonaAliasSeleccionada({ id: t.zonaEntrega.id, nombre: t.zonaEntrega.nombre })}
                          aria-label={`Administrar alias de ${t.zonaEntrega.nombre}`}
                          title="Alias"
                        >
                          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                      {!t.activa && (
                        <Badge variant="outline" className="mt-1">Inactiva</Badge>
                      )}
                    </TableCell>

                    <TableCell className="px-4 py-4 whitespace-normal">
                      {t.cobertura.length === 0 ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        <div id={`cobertura-${t.id}`} className="flex flex-wrap items-center gap-1.5">
                          {visibles.map((u) => (
                            <Badge key={u.etiqueta} variant="secondary" title={u.detalle} className="h-6 px-2">
                              {u.etiqueta}
                            </Badge>
                          ))}
                          {ocultas > 0 && (
                            <Badge
                              render={<button type="button" onClick={() => alternarCobertura(t.id)} />}
                              className="h-6 cursor-pointer px-2"
                              aria-expanded={abierta}
                              aria-controls={`cobertura-${t.id}`}
                            >
                              + {ocultas} más
                            </Badge>
                          )}
                          {t.cobertura.length > MAX_ETIQUETAS_COBERTURA && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => alternarCobertura(t.id)}
                              aria-expanded={abierta}
                              aria-controls={`cobertura-${t.id}`}
                              aria-label={
                                abierta
                                  ? `Ocultar la cobertura completa de ${t.zonaEntrega.nombre}`
                                  : `Ver las ${t.cobertura.length} ubicaciones de ${t.zonaEntrega.nombre}`
                              }
                            >
                              <ChevronDown
                                aria-hidden
                                className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", abierta && "rotate-180")}
                              />
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="px-4 py-4">
                      <span className="text-sm text-foreground">{t.servicioTransportista.nombre}</span>
                      {entrega && <p className="text-xs text-muted-foreground">{entrega}</p>}
                    </TableCell>

                    {puedeVerCostos && (
                      <TableCell className="px-4 py-4 text-right text-sm tabular-nums text-muted-foreground">
                        {formatearImporte(t.costoInterno)}
                      </TableCell>
                    )}
                    <TableCell className="px-4 py-4 text-right text-sm font-medium tabular-nums text-foreground">
                      {formatearImporte(t.precioCliente)}
                    </TableCell>
                    {puedeVerCostos && (
                      <TableCell
                        className={cn(
                          "px-4 py-4 text-right text-sm font-medium tabular-nums",
                          t.margen < 0 ? "text-danger" : "text-primary",
                        )}
                      >
                        {formatearImporte(t.margen)}
                      </TableCell>
                    )}

                    <TableCell className="px-4 py-4 text-right">
                      {/* Una sola acción primaria (editar) más un menú con el
                          resto, en vez de cuatro iconos por fila. */}
                      {puedeModificar && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={isPending}
                            onClick={() => setZonaEnEdicionId(t.zonaEntrega.id)}
                            aria-label={`Editar la zona ${t.zonaEntrega.nombre} y sus tarifas`}
                            title="Editar zona y tarifas"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className="inline-flex size-8 items-center justify-center rounded-lg outline-none transition-all hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                              aria-label={`Más acciones para la tarifa de ${t.zonaEntrega.nombre}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => abrirEdicion(t)}>
                                <Tag className="mr-2 h-4 w-4" />Editar solo esta tarifa
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicar(t.id)}>
                                <Copy className="mr-2 h-4 w-4" />Duplicar tarifa
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggle(t.id)}>
                                <Power className="mr-2 h-4 w-4" />{t.activa ? "Desactivar" : "Activar"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={t.usada}
                                onClick={() => handleEliminar(t.id)}
                                title={t.usada ? "Ya fue usada — solo puede desactivarse" : undefined}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />Eliminar tarifa
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <DialogTarifa
        transportistaId={transportistaId}
        zonas={zonas}
        servicios={servicios}
        tarifaExistente={tarifaEnEdicion}
        zonaPreseleccionadaId={zonaPreseleccionadaId}
        abierto={dialogTarifaAbierto}
        onOpenChange={setDialogTarifaAbierto}
        onGuardada={() => {}}
      />

      {zonaEnEdicion && paisId && paisLabel && (
        <DialogEditarZona
          zona={zonaEnEdicion}
          tarifas={tarifasDeLaZonaEnEdicion}
          servicios={servicios}
          paisId={paisId}
          paisLabel={paisLabel}
          moneda={moneda}
          abierto={zonaEnEdicionId != null}
          onOpenChange={(abierto) => {
            if (!abierto) setZonaEnEdicionId(null);
          }}
          onAgregarTarifa={(zonaId) => {
            setZonaEnEdicionId(null);
            abrirNuevaTarifaParaZona(zonaId);
          }}
        />
      )}

      {zonaAliasSeleccionada && (
        <DialogAliasUbicacion
          zonaEntregaId={zonaAliasSeleccionada.id}
          zonaNombre={zonaAliasSeleccionada.nombre}
          abierto={zonaAliasSeleccionada != null}
          onOpenChange={(abierto) => {
            if (!abierto) setZonaAliasSeleccionada(null);
          }}
        />
      )}

      {paisId && (
        <WizardImportacionDestinos
          transportistaId={transportistaId}
          paisId={paisId}
          abierto={wizardImportacionAbierto}
          onOpenChange={setWizardImportacionAbierto}
          onImportado={() => {
            // 024-alias-ubicaciones-transportistas — el listado de zonas/tarifas
            // se refresca por revalidatePath (Server Component); acá solo se
            // notifica el éxito, el usuario cierra el wizard cuando quiera ver
            // el resultado reflejado.
          }}
        />
      )}
    </div>
  );
}
