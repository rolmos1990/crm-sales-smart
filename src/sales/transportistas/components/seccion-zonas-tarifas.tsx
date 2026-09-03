"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, MapPinPlus, Pencil, Plus, Power, Search, Tag, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { duplicarTarifa, eliminarTarifa, toggleTarifa } from "../tarifas/actions";
import { eliminarZonaEntrega } from "../zonas/actions";
import { WizardImportacionDestinos } from "../importacion-destinos/components/wizard-importacion-destinos";
import { DialogAliasUbicacion } from "./dialog-alias-ubicacion";
import { DialogTarifa, type TarifaExistente } from "./dialog-tarifa";
import { DialogZonaEntrega } from "./dialog-zona-entrega";

interface TarifaFila {
  id: string;
  zonaEntrega: { id: string; nombre: string };
  // 023-transportistas-por-pais — provincia/estado real de catálogo (FR-007)
  ubicacion: string;
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
  zonasIniciales: { id: string; nombre: string }[];
  servicios: { id: string; nombre: string }[];
  tarifas: TarifaFila[];
  promedio: { costoPromedio: number; margenPromedio: number; cantidad: number };
  puedeVerCostos: boolean;
  puedeModificar: boolean;
}

// 022-transportistas-zonas-tarifas — pestaña "Zonas y tarifas" (FR-014 a
// FR-022). Costo/margen se ocultan por completo cuando el usuario no tiene
// el permiso "transportistas-costos" (US5, Fase 7 — no implementado en esta
// pasada; se deja el flag `puedeVerCostos` cableado para esa historia).
export function SeccionZonasTarifas({
  transportistaId, pais, paisId, zonasIniciales, servicios, tarifas, promedio, puedeVerCostos, puedeModificar,
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
  const [wizardImportacionAbierto, setWizardImportacionAbierto] = useState(false);

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
        <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Costo promedio</p>
            <p className="text-lg font-semibold text-foreground">{promedio.costoPromedio.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Margen promedio</p>
            <p className="text-lg font-semibold text-foreground">{promedio.margenPromedio.toFixed(2)}</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap justify-between">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar zona..."
            className="pl-8"
          />
        </div>
        {puedeModificar && (
          <div className="flex items-center gap-2">
            {puedeAgregar ? (
              <>
                <DialogZonaEntrega paisId={paisId!} paisLabel={paisLabel!} onCreada={(z) => setZonas((prev) => [...prev, z])} />
                <Button type="button" size="sm" className="gap-1.5" onClick={abrirNuevaTarifa} disabled={zonas.length === 0}>
                  <Plus className="h-3.5 w-3.5" />
                  Agregar tarifa
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setWizardImportacionAbierto(true)}>
                  <Upload className="h-3.5 w-3.5" />
                  Importar destinos
                </Button>
              </>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled>
                      <Plus className="h-3.5 w-3.5" />
                      Agregar zona
                    </Button>
                    <Button type="button" size="sm" className="gap-1.5" disabled>
                      <Plus className="h-3.5 w-3.5" />
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

      <div className="rounded-xl border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zona</TableHead>
              <TableHead>Estado/Provincia</TableHead>
              <TableHead>Servicio</TableHead>
              {puedeVerCostos && <TableHead className="text-right">Costo</TableHead>}
              <TableHead className="text-right">Precio cliente</TableHead>
              {puedeVerCostos && <TableHead className="text-right">Margen</TableHead>}
              <TableHead>Entrega</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tarifasVisibles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                  Sin tarifas configuradas
                </TableCell>
              </TableRow>
            ) : (
              tarifasVisibles.map((t) => (
                <TableRow key={t.id} className={!t.activa ? "opacity-50" : undefined}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1">
                      <span>{t.zonaEntrega.nombre}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setZonaAliasSeleccionada({ id: t.zonaEntrega.id, nombre: t.zonaEntrega.nombre })}
                        aria-label="Administrar alias de este destino"
                        title="Alias"
                      >
                        <Tag className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{t.ubicacion}</TableCell>
                  <TableCell>{t.servicioTransportista.nombre}</TableCell>
                  {puedeVerCostos && <TableCell className="text-right tabular-nums">{t.costoInterno.toFixed(2)}</TableCell>}
                  <TableCell className="text-right tabular-nums">{t.precioCliente.toFixed(2)}</TableCell>
                  {puedeVerCostos && (
                    <TableCell className={`text-right tabular-nums ${t.margen < 0 ? "text-danger" : ""}`}>
                      {t.margen.toFixed(2)}
                    </TableCell>
                  )}
                  <TableCell className="text-muted-foreground text-sm">
                    {t.tiempoMinimoDias != null || t.tiempoMaximoDias != null
                      ? `${t.tiempoMinimoDias ?? "?"}-${t.tiempoMaximoDias ?? "?"} días`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.activa ? "default" : "outline"}>{t.activa ? "Activa" : "Inactiva"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {puedeModificar && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isPending} onClick={() => abrirEdicion(t)} aria-label="Editar tarifa">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isPending} onClick={() => handleDuplicar(t.id)} aria-label="Duplicar tarifa">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isPending} onClick={() => handleToggle(t.id)} aria-label={t.activa ? "Desactivar" : "Activar"}>
                          <Power className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={isPending || t.usada}
                          title={t.usada ? "Ya fue usada — solo puede desactivarse" : "Eliminar"}
                          onClick={() => handleEliminar(t.id)}
                          aria-label="Eliminar tarifa"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
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
