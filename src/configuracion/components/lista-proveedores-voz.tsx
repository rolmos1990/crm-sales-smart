"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Power, PlugZap, Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  toggleProveedorVoz,
  eliminarProveedorVoz,
  probarCredencialesVoz,
} from "@/configuracion/voz/actions";
import type { ConsumoVoz } from "@/configuracion/voz/queries";
import type { ProveedorVozConConsumo } from "@/configuracion/voz/fusion";
import { FormProveedorVoz, type ProveedorVozExistente } from "./form-proveedor-voz";

const ETIQUETA_PROVEEDOR: Record<string, string> = {
  ELEVENLABS: "ElevenLabs",
  OPENAI: "OpenAI",
  GROQ: "Groq",
  LOCAL: "Local",
};

export function ListaProveedoresVoz({
  proveedores,
  eliminados,
}: {
  proveedores: ProveedorVozConConsumo[];
  /** Consumo cuyo proveedor ya no existe. `null` ⇒ no se renderiza nada. */
  eliminados: ConsumoVoz | null;
}) {
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState<ProveedorVozExistente | null>(null);
  const [probandoId, setProbandoId] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  function refrescar() {
    window.location.reload();
  }

  function abrirNuevo() {
    setEditando(null);
    setFormAbierto(true);
  }

  function abrirEdicion(p: ProveedorVozConConsumo) {
    setEditando({
      id: p.id,
      alias: p.alias,
      proveedor: p.proveedor as ProveedorVozExistente["proveedor"],
      baseUrl: p.baseUrl,
      modelo: p.modelo,
      prioridad: p.prioridad,
      costoPorHora: p.costoPorHora,
      limiteMinutosDia: p.limiteMinutosDia,
      timeoutMs: p.timeoutMs,
      reintentosMax: p.reintentosMax,
    });
    setFormAbierto(true);
  }

  function alternar(p: ProveedorVozConConsumo) {
    iniciar(async () => {
      const r = await toggleProveedorVoz(p.id, !p.activo);
      if (!r.exito) {
        toast.error(r.error);
        return;
      }
      toast.success(p.activo ? "Proveedor desactivado" : "Proveedor activado");
      refrescar();
    });
  }

  function eliminar(p: ProveedorVozConConsumo) {
    iniciar(async () => {
      const r = await eliminarProveedorVoz(p.id);
      if (!r.exito) {
        toast.error(r.error);
        return;
      }
      toast.success("Proveedor eliminado");
      refrescar();
    });
  }

  async function probar(p: ProveedorVozConConsumo) {
    setProbandoId(p.id);
    try {
      const r = await probarCredencialesVoz(p.id);
      if (!r.exito) toast.error(r.error);
      else if (r.disponible) toast.success(`${p.alias}: la credencial funciona`);
      else toast.error(`${p.alias}: el servicio rechazó la credencial`);
    } finally {
      setProbandoId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">Proveedores de voz</h3>
          <p className="text-xs text-muted-foreground">
            El servicio que convierte las notas de voz en texto. Se cobra por minuto de audio.
          </p>
        </div>
        <Button size="sm" onClick={abrirNuevo}>
          <Plus className="mr-1.5 h-4 w-4" />
          Agregar
        </Button>
      </div>

      {proveedores.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Todavía no hay ningún proveedor de voz. Cargá uno para poder activar la transcripción.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {proveedores.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{p.alias}</span>
                  <Badge variant={p.activo ? "default" : "secondary"}>
                    {p.activo ? "Activo" : "Inactivo"}
                  </Badge>
                  {!p.tieneCredencial && (
                    <Badge variant="outline" className="gap-1 text-stage-amber-text">
                      <KeyRound className="h-3 w-3" />
                      Sin API key
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {ETIQUETA_PROVEEDOR[p.proveedor] ?? p.proveedor} · {p.modelo} · prioridad {p.prioridad}
                  {p.costoPorHora ? ` · ${Number(p.costoPorHora)}/hora` : " · sin tarifa cargada"}
                  {p.limiteMinutosDia ? ` · tope ${p.limiteMinutosDia} min/día` : ""}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {textoConsumo(p.consumoMes)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => probar(p)}
                  disabled={probandoId === p.id || !p.tieneCredencial}
                  aria-label="Probar credenciales"
                  title="Probar credenciales"
                >
                  {probandoId === p.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PlugZap className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => alternar(p)}
                  aria-label={p.activo ? "Desactivar" : "Activar"}
                  title={p.activo ? "Desactivar" : "Activar"}
                >
                  <Power className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => abrirEdicion(p)}
                  aria-label="Editar"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => eliminar(p)}
                  aria-label="Eliminar"
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {eliminados && (
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <span className="truncate text-sm font-medium text-muted-foreground">
                  Proveedor eliminado
                </span>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {textoConsumo(eliminados)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <FormProveedorVoz
        abierto={formAbierto}
        onOpenChange={setFormAbierto}
        existente={editando}
        onExito={refrescar}
      />
    </div>
  );
}

/**
 * El monto va sin símbolo de moneda, igual que la tarjeta de total y la tarifa
 * por hora de la fila de arriba.
 *
 * "Sin consumo" y "costo no estimado" son estados distintos a propósito: un
 * `0.00` en un proveedor sin tarifa se lee como "este servicio sale gratis".
 *
 * Dice "costo no estimado" y no "sin tarifa cargada" porque la línea de arriba
 * ya lo avisa con esas palabras; repetirlas deja la fila diciendo lo mismo dos
 * veces seguidas.
 */
function textoConsumo(c: ConsumoVoz): string {
  if (c.transcripciones === 0) return "Sin consumo este mes";

  const minutos = `${c.minutos} min este mes`;
  if (c.costo === null) return `${minutos} · costo no estimado`;

  const monto = c.costo.toFixed(2);
  return c.costoCobertura === "PARCIAL"
    ? `${minutos} · ${monto} (parte del mes sin tarifa)`
    : `${minutos} · ${monto}`;
}
