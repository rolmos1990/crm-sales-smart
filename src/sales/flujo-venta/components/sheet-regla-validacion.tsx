"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Info, Loader2, FlaskConical, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Combobox } from "@/shared/ui/combobox";
import { cn } from "@/lib/utils";
import {
  crearRegla, actualizarRegla,
  buscarPedidosParaPruebaAction, probarReglaConPedidoAction,
} from "../actions";
import { construirArbolDesdeRegla } from "../reglas/evaluador";
import type { FlujoVentaRegla, FlujoVentaEtapa } from "../types";
import type { CondicionEvaluada, GroupNode } from "../reglas/tipos";
import { ConstructorCondiciones, arbolVacio, type CampoReglaCliente } from "./constructor-condiciones";
import { generarResumenNatural } from "./resumen-regla";

interface SheetReglaValidacionProps {
  etapa: FlujoVentaEtapa;
  regla: FlujoVentaRegla | null;
  campos: CampoReglaCliente[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onGuardado: () => void;
}

type ResultadoPrueba = { cumple: boolean; condiciones: CondicionEvaluada[] } | null;

export function SheetReglaValidacion({ etapa, regla, campos, open, onOpenChange, onGuardado }: SheetReglaValidacionProps) {
  const modoEdicion = !!regla;

  const [nombre, setNombre] = useState(regla?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(regla?.descripcion ?? "");
  const [prioridad, setPrioridad] = useState(regla?.prioridad ?? 0);
  const [activo, setActivo] = useState(regla?.activo ?? true);
  const [arbol, setArbol] = useState<GroupNode>(() =>
    regla ? (construirArbolDesdeRegla(regla) as GroupNode) : arbolVacio()
  );
  const [mensajeFallo, setMensajeFallo] = useState(regla?.mensajeFallo ?? "");
  const [mostrarPendientes, setMostrarPendientes] = useState(regla?.mostrarPendientes ?? true);

  const [pedidoPruebaId, setPedidoPruebaId] = useState("");
  const [probando, setProbando] = useState(false);
  const [resultadoPrueba, setResultadoPrueba] = useState<ResultadoPrueba>(null);

  const [guardando, startGuardando] = useTransition();

  const resumen = generarResumenNatural(arbol, campos, etapa.nombre);

  const guardar = (estadoDestino: "BORRADOR" | "PUBLICADA") => {
    if (!nombre.trim()) { toast.error("Ponle un nombre a la regla"); return; }
    if (arbol.children.length === 0) { toast.error("Agrega al menos una condición"); return; }

    startGuardando(async () => {
      const datos = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        activo,
        estado: estadoDestino,
        prioridad,
        etapaDestinoId: etapa.id,
        arbolCondiciones: arbol,
        mensajeFallo: mensajeFallo.trim(),
        mostrarPendientes,
      };
      const resultado = modoEdicion
        ? await actualizarRegla(regla.id, datos)
        : await crearRegla(datos);

      if (resultado.exito) {
        toast.success(estadoDestino === "BORRADOR" ? "Borrador guardado" : (modoEdicion ? "Regla actualizada" : "Regla publicada"));
        onOpenChange(false);
        onGuardado();
      } else {
        toast.error(resultado.error);
      }
    });
  };

  const probar = async () => {
    if (!pedidoPruebaId) return;
    setProbando(true);
    setResultadoPrueba(null);
    try {
      const resultado = await probarReglaConPedidoAction(pedidoPruebaId, etapa.id, arbol);
      if (resultado.exito) {
        setResultadoPrueba({ cumple: resultado.datos.cumple, condiciones: resultado.datos.condiciones });
      } else {
        toast.error(resultado.error);
      }
    } finally {
      setProbando(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 data-[side=right]:sm:max-w-4xl bg-white dark:bg-stone-950 border-l border-stone-200 dark:border-white/10 shadow-2xl"
        showCloseButton={false}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{modoEdicion ? `Editar regla — ${etapa.nombre}` : `Nueva regla para el estado ${etapa.nombre}`}</SheetTitle>
        </SheetHeader>

        {/* ── Header ─────────────────────────────────────────── */}
            <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-stone-100 dark:border-white/5 bg-white/95 dark:bg-stone-950/95 backdrop-blur px-6 py-4 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: etapa.color ?? "#818cf8" }} />
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                    {modoEdicion ? `Editar regla — ${etapa.nombre}` : `Nueva regla para el estado ${etapa.nombre}`}
                  </h2>
                  <p className="text-xs text-stone-400 dark:text-stone-500">Define qué debe cumplir un pedido para obtener este estado</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={guardando}>Cancelar</Button>
                <Button variant="outline" size="sm" onClick={() => guardar("BORRADOR")} disabled={guardando} className="gap-1.5">
                  {guardando && <Loader2 className="h-3 w-3 animate-spin" />} Guardar borrador
                </Button>
                <Button
                  size="sm" onClick={() => guardar("PUBLICADA")} disabled={guardando}
                  className="gap-1.5 bg-lime-500/90 text-stone-950 hover:bg-lime-400 shadow-sm transition-all hover:scale-[1.02]"
                >
                  {guardando && <Loader2 className="h-3 w-3 animate-spin" />} {modoEdicion ? "Guardar regla" : "Crear regla"}
                </Button>
              </div>
            </div>

            {/* ── Cuerpo ─────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col lg:flex-row gap-6 p-6">
                {/* Columna principal */}
                <div className="flex-1 min-w-0 space-y-5">
                  <div className="flex items-start gap-2.5 rounded-xl border border-lime-500/20 dark:border-lime-400/15 bg-lime-500/5 dark:bg-lime-400/5 px-4 py-3">
                    <Info className="h-4 w-4 text-lime-600 dark:text-lime-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-stone-600 dark:text-stone-300">
                      Se evaluará antes de asignar el estado <strong>{etapa.nombre}</strong>, sin importar el estado anterior.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Label className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5 block">Nombre de la regla</Label>
                      <Input
                        autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)}
                        placeholder="Ej: Confirmar pago del pedido"
                        className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5 block">
                        Prioridad <span className="normal-case font-normal text-stone-400">(menor se evalúa primero)</span>
                      </Label>
                      <Input
                        type="number" min={0} max={999} value={prioridad}
                        onChange={(e) => setPrioridad(Number(e.target.value))}
                        className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2.5 h-9">
                        <Switch checked={activo} onCheckedChange={setActivo} />
                        <span className="text-sm text-stone-600 dark:text-stone-300">Regla activa</span>
                      </label>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5 block">Descripción (opcional)</Label>
                      <Textarea
                        rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
                        placeholder="Para qué sirve esta regla..."
                        className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl resize-none"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2 block">Condiciones requeridas</Label>
                    <ConstructorCondiciones value={arbol} campos={campos} onChange={setArbol} />
                  </div>

                  <div className="h-px bg-stone-100 dark:bg-white/8" />

                  <div className="space-y-3">
                    <Label className="text-xs font-medium text-stone-500 uppercase tracking-wide block">Si no se cumple</Label>
                    <p className="text-xs text-stone-400 dark:text-stone-500">No permitir asignar el estado — es el único comportamiento disponible: una regla activa es un requisito obligatorio.</p>
                    <div>
                      <Label className="text-xs font-medium text-stone-500 mb-1.5 block">Mensaje para el usuario</Label>
                      <Textarea
                        rows={2} maxLength={200} value={mensajeFallo} onChange={(e) => setMensajeFallo(e.target.value)}
                        placeholder={`No se puede asignar el estado ${etapa.nombre}. Completa los requisitos pendientes.`}
                        className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl resize-none"
                      />
                      <p className="text-[10px] text-stone-400 text-right mt-1">{mensajeFallo.length}/200</p>
                    </div>
                    <label className="flex items-center gap-2.5">
                      <Switch checked={mostrarPendientes} onCheckedChange={setMostrarPendientes} />
                      <span className="text-sm text-stone-600 dark:text-stone-300">Mostrar requisitos pendientes</span>
                    </label>
                  </div>
                </div>

                {/* Columna lateral — resumen + prueba */}
                <div className="w-full lg:w-[300px] flex-shrink-0 space-y-4">
                  <div className="rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/[0.03] p-4 space-y-2">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 dark:text-stone-200">
                      <Info className="h-3.5 w-3.5 text-stone-400" /> Resumen de la regla
                    </p>
                    <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">{resumen}</p>
                  </div>

                  <div className="rounded-xl border border-stone-200 dark:border-white/10 p-4 space-y-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 dark:text-stone-200">
                      <FlaskConical className="h-3.5 w-3.5 text-stone-400" /> Probar con un pedido
                    </p>
                    <Combobox
                      opciones={[]}
                      valor={pedidoPruebaId}
                      onChange={(v) => { setPedidoPruebaId(v); setResultadoPrueba(null); }}
                      placeholder="Buscar pedido..."
                      placeholderBusqueda="Número, contacto..."
                      onBuscar={buscarPedidosParaPruebaAction}
                    />
                    <Button
                      type="button" size="sm" variant="outline" disabled={!pedidoPruebaId || probando}
                      onClick={probar} className="w-full gap-1.5"
                    >
                      {probando ? <Loader2 className="h-3 w-3 animate-spin" /> : <FlaskConical className="h-3 w-3" />}
                      Evaluar
                    </Button>

                    {resultadoPrueba && (
                      <div className="space-y-2 pt-1">
                        <div className={cn(
                          "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold",
                          resultadoPrueba.cumple
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "bg-red-500/10 text-red-700 dark:text-red-400"
                        )}>
                          {resultadoPrueba.cumple ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                          {resultadoPrueba.cumple ? "Cumple la regla" : "No cumple la regla"}
                        </div>
                        <div className="space-y-1">
                          {resultadoPrueba.condiciones.map((c, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-[11px]">
                              {c.cumple
                                ? <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                                : <XCircle className="h-3 w-3 text-red-500 shrink-0 mt-0.5" />}
                              <span className="text-stone-500 dark:text-stone-400">
                                <span className="text-stone-700 dark:text-stone-300 font-medium">{c.fieldLabel}</span>
                                {" — actual: "}{String(c.valorActual ?? "—")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
      </SheetContent>
    </Sheet>
  );
}
