"use client";

import { useState, useEffect, useTransition } from "react";
import { ChevronRight, Plus, AlertCircle, Check, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { crearCampoPersonalizadoAction } from "../actions";
import { obtenerCamposEntidad } from "../utils/campos-entidad";
import type {
  EntidadImportable,
  MapeoColumna,
  CampoPersonalizadoResumen,
  AccionColumna,
} from "../types";

const TIPOS_CAMPO = [
  { valor: "TEXTO", etiqueta: "Texto" },
  { valor: "TEXTO_LARGO", etiqueta: "Texto largo" },
  { valor: "NUMERO", etiqueta: "Número" },
  { valor: "DECIMAL", etiqueta: "Decimal" },
  { valor: "FECHA", etiqueta: "Fecha" },
  { valor: "BOOLEANO", etiqueta: "Booleano" },
  { valor: "EMAIL", etiqueta: "Email" },
  { valor: "TELEFONO", etiqueta: "Teléfono" },
  { valor: "URL", etiqueta: "URL" },
] as const;

type EstrategiaContacto = "email" | "telefono" | "email_o_telefono";

interface PasoMapeoProps {
  entidad: EntidadImportable;
  encabezados: string[];
  camposPersonalizados: CampoPersonalizadoResumen[];
  mapeoInicial: MapeoColumna[];
  onConfirmar: (mapeos: MapeoColumna[], estrategiaContacto: EstrategiaContacto) => void;
  onAtras: () => void;
}

function autoDetectarCampo(
  columna: string,
  camposStd: ReturnType<typeof obtenerCamposEntidad>,
): string | undefined {
  const col = columna.toLowerCase().trim();
  for (const campo of camposStd) {
    if (
      col === campo.clave.toLowerCase() ||
      col === campo.etiqueta.toLowerCase() ||
      col.includes(campo.clave.toLowerCase()) ||
      campo.clave.toLowerCase().includes(col)
    ) {
      return campo.clave;
    }
  }
  return undefined;
}

export function PasoMapeo({
  entidad,
  encabezados,
  camposPersonalizados: camposCustomInitial,
  mapeoInicial,
  onConfirmar,
  onAtras,
}: PasoMapeoProps) {
  const camposStd = obtenerCamposEntidad(entidad);
  const [camposCustom, setCamposCustom] = useState<CampoPersonalizadoResumen[]>(camposCustomInitial);
  const [mapeos, setMapeos] = useState<MapeoColumna[]>(() => {
    if (mapeoInicial.length > 0) return mapeoInicial;
    return encabezados.map((col) => {
      const auto = autoDetectarCampo(col, camposStd);
      return {
        columnaArchivo: col,
        accion: (auto ? "mapear" : "ignorar") as AccionColumna,
        campoDestino: auto,
      };
    });
  });

  const [estrategiaContacto, setEstrategiaContacto] = useState<EstrategiaContacto>("email_o_telefono");
  const [dialogColumna, setDialogColumna] = useState<string | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formTipo, setFormTipo] = useState("TEXTO");
  const [formRequerido, setFormRequerido] = useState(false);
  const [errorDialog, setErrorDialog] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (dialogColumna) {
      setFormNombre(dialogColumna);
      setFormTipo("TEXTO");
      setFormRequerido(false);
      setErrorDialog(null);
    }
  }, [dialogColumna]);

  const setAccion = (columna: string, accion: AccionColumna, destino?: string) => {
    setMapeos((prev) =>
      prev.map((m) =>
        m.columnaArchivo === columna
          ? { ...m, accion, campoDestino: destino }
          : m,
      ),
    );
  };

  const getValorSelect = (mapeo: MapeoColumna): string => {
    if (mapeo.accion === "ignorar") return "ignorar";
    if (mapeo.accion === "crear") return `__creado__${mapeo.campoDestino}`;
    return mapeo.campoDestino ?? "ignorar";
  };

  const handleSelectChange = (columna: string, valor: string) => {
    if (valor === "ignorar") {
      setAccion(columna, "ignorar");
    } else if (valor === "__crear__") {
      setDialogColumna(columna);
    } else if (valor.startsWith("__creado__")) {
      const clave = valor.replace("__creado__", "");
      const existente = mapeos.find((m) => m.columnaArchivo === columna);
      setMapeos((prev) =>
        prev.map((m) =>
          m.columnaArchivo === columna
            ? { ...m, accion: "crear", campoDestino: clave, campoCreadoId: existente?.campoCreadoId }
            : m,
        ),
      );
    } else {
      setAccion(columna, "mapear", valor);
    }
  };

  const crearCampo = () => {
    const columnaActual = dialogColumna;
    if (!columnaActual || !formNombre.trim()) return;

    startTransition(async () => {
      const resultado = await crearCampoPersonalizadoAction(entidad, {
        nombre: formNombre.trim(),
        tipo: formTipo,
        requerido: formRequerido,
      });

      if (!resultado.exito) {
        setErrorDialog(resultado.error);
        return;
      }

      const nuevoCampo: CampoPersonalizadoResumen = {
        id: resultado.campo.id,
        nombre: resultado.campo.nombre,
        clave: resultado.campo.clave,
        tipo: resultado.campo.tipo,
      };

      setCamposCustom((prev) => [...prev, nuevoCampo]);

      setMapeos((prev) =>
        prev.map((m) =>
          m.columnaArchivo === columnaActual
            ? {
                ...m,
                accion: "crear",
                campoDestino: resultado.campo.clave,
                campoCreadoId: resultado.campo.id,
              }
            : m,
        ),
      );

      setDialogColumna(null);
    });
  };

  const camposRequeridos = camposStd.filter((c) => c.requerido);
  const mapeosActivos = mapeos.filter(
    (m) => m.accion !== "ignorar" && m.campoDestino,
  );
  const camposRequeridosMapeados = camposRequeridos.filter((c) =>
    mapeosActivos.some((m) => m.campoDestino === c.clave),
  );
  const todosRequeridosMapeados =
    camposRequeridos.length === camposRequeridosMapeados.length;

  const tieneContactoMapeado =
    entidad === "OPORTUNIDAD" &&
    mapeosActivos.some(
      (m) => m.campoDestino === "contactoEmail" || m.campoDestino === "contactoTelefono",
    );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-stone-50">
          Mapea las columnas de tu archivo
        </h2>
        <p className="text-sm text-stone-400 mt-1">
          Relaciona cada columna del archivo con un campo del CRM.
        </p>
      </div>

      {camposRequeridos.length > 0 && (
        <div
          className={cn(
            "flex items-start gap-3 rounded-xl border p-3 text-sm",
            todosRequeridosMapeados
              ? "border-lime-500/20 bg-lime-500/5 text-lime-400"
              : "border-amber-500/20 bg-amber-500/5 text-amber-400",
          )}
        >
          {todosRequeridosMapeados ? (
            <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          )}
          <span>
            {todosRequeridosMapeados
              ? "Todos los campos obligatorios están mapeados."
              : `Campos obligatorios: ${camposRequeridos
                  .filter(
                    (c) =>
                      !mapeosActivos.some((m) => m.campoDestino === c.clave),
                  )
                  .map((c) => c.etiqueta)
                  .join(", ")}`}
          </span>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/4 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-0 px-4 py-2.5 border-b border-white/8 text-xs uppercase tracking-wide text-stone-500 font-medium">
          <span>Columna del archivo</span>
          <span />
          <span>Campo en CRM</span>
        </div>

        <div className="divide-y divide-white/5">
          {mapeos.map((mapeo) => {
            const esMapeada =
              mapeo.accion !== "ignorar" && Boolean(mapeo.campoDestino);
            const esCreada = mapeo.accion === "crear";

            return (
              <div
                key={mapeo.columnaArchivo}
                className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center px-4 py-3"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-stone-200 text-sm font-medium truncate">
                    {mapeo.columnaArchivo}
                  </span>
                </div>

                <div className="flex items-center justify-center w-6">
                  <ChevronRight
                    className={cn(
                      "w-4 h-4",
                      esMapeada ? "text-lime-500" : "text-stone-600",
                    )}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={getValorSelect(mapeo)}
                    onValueChange={(v) =>
                      v && handleSelectChange(mapeo.columnaArchivo, v)
                    }
                  >
                    <SelectTrigger
                      className={cn(
                        "h-8 text-xs border-white/15 bg-white/5 flex-1",
                        esCreada && "border-lime-500/30 text-lime-300",
                        !esMapeada && "text-stone-500",
                      )}
                    >
                      <SelectValue placeholder="No importar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ignorar" className="text-xs text-stone-400">
                        No importar
                      </SelectItem>

                      {camposStd.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="text-xs text-stone-500">
                            Campos estándar
                          </SelectLabel>
                          {camposStd.map((campo) => (
                            <SelectItem
                              key={campo.clave}
                              value={campo.clave}
                              className="text-xs"
                            >
                              {campo.etiqueta}
                              {campo.requerido && (
                                <span className="ml-1 text-amber-400">*</span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}

                      {camposCustom.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="text-xs text-stone-500">
                            Campos personalizados
                          </SelectLabel>
                          {camposCustom.map((campo) => (
                            <SelectItem
                              key={campo.id}
                              value={campo.clave}
                              className="text-xs"
                            >
                              {campo.nombre}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}

                      {entidad !== "ACTIVIDAD" && (
                        <SelectGroup>
                          <SelectItem
                            value="__crear__"
                            className="text-xs text-lime-400"
                          >
                            <Plus className="w-3 h-3 mr-1 inline" />
                            Crear nuevo campo
                          </SelectItem>
                        </SelectGroup>
                      )}

                      {mapeo.accion === "crear" && mapeo.campoDestino && (
                        <SelectItem
                          value={`__creado__${mapeo.campoDestino}`}
                          className="text-xs text-lime-300"
                        >
                          ✓ {camposCustom.find(c => c.clave === mapeo.campoDestino)?.nombre ?? mapeo.campoDestino}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {tieneContactoMapeado && (
        <div className="rounded-xl border border-lime-500/20 bg-lime-500/5 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-lime-400 flex-shrink-0" />
            <p className="text-stone-200 text-sm font-medium">Vincular contacto</p>
          </div>
          <p className="text-stone-400 text-xs">
            ¿Cómo buscar el contacto en el CRM? Si no existe, se creará automáticamente.
          </p>
          <div className="flex flex-col gap-2">
            {(
              [
                { valor: "email_o_telefono", etiqueta: "Email o Teléfono", desc: "Busca por email primero, luego por teléfono (recomendado)" },
                { valor: "email", etiqueta: "Solo Email", desc: "Relaciona únicamente usando el email del contacto" },
                { valor: "telefono", etiqueta: "Solo Teléfono", desc: "Relaciona únicamente usando el teléfono del contacto" },
              ] as const
            ).map(({ valor, etiqueta, desc }) => (
              <label
                key={valor}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all",
                  estrategiaContacto === valor
                    ? "border-lime-500/40 bg-lime-500/8"
                    : "border-white/8 bg-white/4 hover:border-white/15",
                )}
              >
                <input
                  type="radio"
                  name="estrategia-contacto"
                  value={valor}
                  checked={estrategiaContacto === valor}
                  onChange={() => setEstrategiaContacto(valor)}
                  className="mt-0.5 accent-lime-400"
                />
                <div>
                  <p className={cn("text-sm font-medium", estrategiaContacto === valor ? "text-lime-300" : "text-stone-300")}>
                    {etiqueta}
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          onClick={onAtras}
          className="text-stone-400 hover:text-stone-200"
        >
          ← Volver
        </Button>
        <Button
          onClick={() => onConfirmar(mapeos, estrategiaContacto)}
          disabled={!todosRequeridosMapeados}
          className="bg-lime-500/90 text-stone-950 rounded-xl hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          Validar datos <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      <Dialog open={dialogColumna !== null} onOpenChange={(open) => !open && setDialogColumna(null)}>
        <DialogContent className="bg-stone-950/95 border-white/10 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-stone-100">Crear nuevo campo</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-stone-300 text-sm">Nombre del campo</Label>
              <Input
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                placeholder="Ej: Notas adicionales"
                className="border-white/15 bg-white/5 text-stone-200"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-stone-300 text-sm">Tipo de campo</Label>
              <Select value={formTipo} onValueChange={(v) => setFormTipo(v ?? "TEXTO")}>
                <SelectTrigger className="border-white/15 bg-white/5 text-stone-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_CAMPO.map((t) => (
                    <SelectItem key={t.valor} value={t.valor}>
                      {t.etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-stone-300 text-sm">Obligatorio</Label>
              <Switch
                checked={formRequerido}
                onCheckedChange={setFormRequerido}
              />
            </div>

            {errorDialog && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/8 p-3 text-sm text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {errorDialog}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogColumna(null)}
              className="text-stone-400"
            >
              Cancelar
            </Button>
            <Button
              onClick={crearCampo}
              disabled={!formNombre.trim() || isPending}
              className="bg-lime-500/90 text-stone-950 rounded-xl hover:bg-lime-400"
            >
              {isPending ? "Creando..." : "Crear campo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
