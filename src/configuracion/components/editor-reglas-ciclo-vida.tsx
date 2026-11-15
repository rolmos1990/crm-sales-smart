"use client";

import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  MAX_CUANDO_APLICA_ETAPA,
  MAX_REGLAS_ETAPA_CICLO_VIDA,
  type ReglaEtapaCicloVidaInput,
} from "@/configuracion/ia/agente-schema";

/**
 * Reglas de ciclo de vida: a qué etapa mover la oportunidad y ante qué
 * situación de la conversación. Las ejecuta la herramienta
 * `actualizar_etapa_oportunidad`.
 *
 * La etapa se elige de un desplegable con las etapas reales del negocio, no se
 * escribe: un nombre inventado hace que la herramienta no mueva nada, y eso
 * recién se descubre en una conversación real con un cliente.
 */
export function EditorReglasCicloVida({
  valores,
  etapasDisponibles,
  cargandoEtapas,
  onChange,
}: {
  valores: ReglaEtapaCicloVidaInput[];
  etapasDisponibles: string[];
  cargandoEtapas: boolean;
  onChange: (nuevas: ReglaEtapaCicloVidaInput[]) => void;
}) {
  const actualizar = (id: string, cambios: Partial<ReglaEtapaCicloVidaInput>) =>
    onChange(valores.map((r) => (r.id === id ? { ...r, ...cambios } : r)));

  const agregar = () =>
    onChange([
      ...valores,
      { id: crypto.randomUUID(), etapa: etapasDisponibles[0] ?? "", cuandoAplica: "" },
    ]);

  if (cargandoEtapas) {
    return <p className="text-xs text-stone-500">Cargando las etapas del pipeline…</p>;
  }

  if (etapasDisponibles.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-xs text-stone-500">
        Todavía no hay etapas configuradas en el pipeline. Creálas en CRM → Pipeline y volvé acá.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {valores.length === 0 && (
        <p className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-xs text-stone-500">
          Sin reglas. Ejemplo: cuando el cliente escribe por primera vez → mover a{" "}
          <span className="text-stone-400">{etapasDisponibles[0]}</span>.
        </p>
      )}

      {valores.map((regla) => (
        <TarjetaRegla
          key={regla.id}
          regla={regla}
          etapasDisponibles={etapasDisponibles}
          onCambiar={(cambios) => actualizar(regla.id, cambios)}
          onEliminar={() => onChange(valores.filter((r) => r.id !== regla.id))}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={agregar}
        disabled={valores.length >= MAX_REGLAS_ETAPA_CICLO_VIDA}
        className="w-full gap-1.5 border-white/10 text-stone-300 hover:bg-white/10"
      >
        <Plus className="h-4 w-4" />
        Agregar regla
        <span className="text-stone-500">
          ({valores.length}/{MAX_REGLAS_ETAPA_CICLO_VIDA})
        </span>
      </Button>
    </div>
  );
}

function TarjetaRegla({
  regla,
  etapasDisponibles,
  onCambiar,
  onEliminar,
}: {
  regla: ReglaEtapaCicloVidaInput;
  etapasDisponibles: string[];
  onCambiar: (cambios: Partial<ReglaEtapaCicloVidaInput>) => void;
  onEliminar: () => void;
}) {
  // Una etapa renombrada o borrada deja reglas apuntando a un nombre que ya no
  // existe. En vez de dejarlas mudas, se avisa: la herramienta no va a poder
  // moverlas y nadie se enteraría hasta la próxima conversación.
  const etapaHuerfana = regla.etapa.length > 0 && !etapasDisponibles.includes(regla.etapa);
  const opciones = etapaHuerfana ? [regla.etapa, ...etapasDisponibles] : etapasDisponibles;

  return (
    <div className="space-y-2.5 rounded-xl border border-white/10 bg-white/3 p-3">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-xs text-stone-400">Mover a</span>
        <Select
          // docs/selects.md — el nombre de la etapa es a la vez valor y
          // etiqueta, pero el mapa se pasa igual: si el set cambia, el trigger
          // sigue resolviendo sin depender de que el popup ya se haya abierto.
          items={Object.fromEntries(opciones.map((e) => [e, e]))}
          value={regla.etapa || null}
          onValueChange={(v) => v && onCambiar({ etapa: v })}
        >
          <SelectTrigger
            className={cn(
              "h-8 w-56 border-white/10 bg-white/5 text-sm text-stone-200",
              etapaHuerfana && "border-amber-500/40 text-amber-300",
            )}
          >
            <SelectValue placeholder="Elegí una etapa" />
          </SelectTrigger>
          <SelectContent>
            {opciones.map((etapa) => (
              <SelectItem key={etapa} value={etapa}>
                {etapa}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={onEliminar}
          aria-label="Eliminar regla"
          className="ml-auto rounded-md p-1.5 text-stone-500 transition-colors hover:bg-white/5 hover:text-stone-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {etapaHuerfana && (
        <p className="flex items-center gap-1.5 text-[11px] text-amber-400">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          Esta etapa ya no existe en el pipeline. El agente no va a poder mover la oportunidad hasta que
          elijas una de la lista.
        </p>
      )}

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-stone-400">Cuándo mover</p>
          <span className="text-[11px] tabular-nums text-stone-500">
            {regla.cuandoAplica.length}/{MAX_CUANDO_APLICA_ETAPA}
          </span>
        </div>
        <Input
          value={regla.cuandoAplica}
          maxLength={MAX_CUANDO_APLICA_ETAPA}
          onChange={(e) => onCambiar({ cuandoAplica: e.target.value })}
          placeholder="el cliente escribe por primera vez"
          className="border-white/10 bg-white/5 text-sm text-stone-50 placeholder:text-stone-500"
        />
      </div>
    </div>
  );
}
