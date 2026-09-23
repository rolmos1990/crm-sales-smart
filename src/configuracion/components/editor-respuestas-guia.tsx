"use client";

import { useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  INTENCIONES_RESPUESTA_GUIA,
  MAX_RESPUESTAS_GUIA,
  type RespuestaGuiaInput,
} from "@/configuracion/ia/agente-schema";

const MARCADORES = ["{nombreCliente}", "{producto}", "{precio}", "{moneda}"] as const;
const MAX_FORMATO = 1000;
const MAX_CUANDO = 200;

type Intencion = RespuestaGuiaInput["intencion"];

/**
 * 028-respuestas-guia-catalogo-ia — lista editable de formatos de respuesta
 * por intención. Estilo alineado al resto de la hoja del agente (fondo oscuro
 * fijo), no a los tokens claros/oscuros de la app.
 */
export function EditorRespuestasGuia({
  valores,
  onChange,
}: {
  valores: RespuestaGuiaInput[];
  onChange: (nuevos: RespuestaGuiaInput[]) => void;
}) {
  const actualizar = (id: string, cambios: Partial<RespuestaGuiaInput>) =>
    onChange(valores.map((r) => (r.id === id ? { ...r, ...cambios } : r)));

  const agregar = () =>
    onChange([
      ...valores,
      { id: crypto.randomUUID(), intencion: "PRECIO", cuandoAplica: "", formato: "", activa: true },
    ]);

  return (
    <div className="space-y-3">
      {valores.length === 0 && (
        <p className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-xs text-stone-500">
          Sin respuestas guía. Ejemplo: cuando el cliente pregunta el precio sin nombrar producto → &quot;¡Hola
          {" {nombreCliente}"}! Te comparto nuestros precios… ¿Cuál te interesa?&quot;
        </p>
      )}

      {valores.map((respuesta) => (
        <TarjetaRespuestaGuia
          key={respuesta.id}
          respuesta={respuesta}
          onCambiar={(cambios) => actualizar(respuesta.id, cambios)}
          onEliminar={() => onChange(valores.filter((r) => r.id !== respuesta.id))}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={agregar}
        disabled={valores.length >= MAX_RESPUESTAS_GUIA}
        className="w-full gap-1.5 border-white/10 text-stone-300 hover:bg-white/10"
      >
        <Plus className="h-4 w-4" />
        Agregar respuesta guía
        <span className="text-stone-500">
          ({valores.length}/{MAX_RESPUESTAS_GUIA})
        </span>
      </Button>
    </div>
  );
}

function TarjetaRespuestaGuia({
  respuesta,
  onCambiar,
  onEliminar,
}: {
  respuesta: RespuestaGuiaInput;
  onCambiar: (cambios: Partial<RespuestaGuiaInput>) => void;
  onEliminar: () => void;
}) {
  const formatoRef = useRef<HTMLTextAreaElement>(null);

  // Inserta el marcador donde está el cursor, no al final: el formato suele
  // escribirse de corrido y el marcador va en medio de la frase.
  const insertarMarcador = (marcador: string) => {
    const el = formatoRef.current;
    const inicio = el?.selectionStart ?? respuesta.formato.length;
    const fin = el?.selectionEnd ?? respuesta.formato.length;
    const nuevo = (respuesta.formato.slice(0, inicio) + marcador + respuesta.formato.slice(fin)).slice(0, MAX_FORMATO);
    onCambiar({ formato: nuevo });
    requestAnimationFrame(() => {
      el?.focus();
      const pos = inicio + marcador.length;
      el?.setSelectionRange(pos, pos);
    });
  };

  return (
    <div
      className={cn(
        "space-y-2.5 rounded-xl border p-3 transition-colors",
        respuesta.activa ? "border-white/10 bg-white/3" : "border-white/5 bg-transparent opacity-70",
      )}
    >
      <div className="flex items-center gap-2">
        <Select
          items={INTENCIONES_RESPUESTA_GUIA}
          value={respuesta.intencion}
          onValueChange={(v) => v && onCambiar({ intencion: v as Intencion })}
        >
          <SelectTrigger className="h-8 w-40 border-white/10 bg-white/5 text-sm text-stone-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(INTENCIONES_RESPUESTA_GUIA).map(([valor, etiqueta]) => (
              <SelectItem key={valor} value={valor}>
                {etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="ml-auto flex items-center gap-2 text-xs text-stone-400">
          Activa
          <Switch checked={respuesta.activa} onCheckedChange={(v) => onCambiar({ activa: v })} />
        </label>
        <button
          type="button"
          onClick={onEliminar}
          aria-label="Eliminar respuesta guía"
          className="rounded-md p-1.5 text-stone-500 transition-colors hover:bg-white/5 hover:text-stone-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-stone-400">Cuándo aplica</p>
        <Input
          value={respuesta.cuandoAplica}
          maxLength={MAX_CUANDO}
          onChange={(e) => onCambiar({ cuandoAplica: e.target.value })}
          placeholder="el cliente pregunta el precio sin nombrar producto"
          className="border-white/10 bg-white/5 text-sm text-stone-50 placeholder:text-stone-500"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-stone-400">Formato de la respuesta</p>
          <span className="text-[11px] tabular-nums text-stone-500">
            {respuesta.formato.length}/{MAX_FORMATO}
          </span>
        </div>
        <Textarea
          ref={formatoRef}
          value={respuesta.formato}
          maxLength={MAX_FORMATO}
          rows={3}
          onChange={(e) => onCambiar({ formato: e.target.value })}
          placeholder="¡Hola {nombreCliente}! El {producto} está a {precio} {moneda}. ¿Te lo separo?"
          className="resize-y border-white/10 bg-white/5 text-sm text-stone-50 placeholder:text-stone-500"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-stone-500">Insertar:</span>
          {MARCADORES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => insertarMarcador(m)}
              className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-stone-300 transition-colors hover:bg-white/10"
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
