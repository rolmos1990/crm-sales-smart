"use client";

import { useState } from "react";
import {
  Plus, Trash2, Copy, ChevronUp, ChevronDown, ChevronsUpDown, Check, X as XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { cn } from "@/lib/utils";
import type { ConditionNode, GroupNode, OperadorCondicion } from "../reglas/tipos";

// ── Tipos ────────────────────────────────────────────────────────────────

export type CampoReglaCliente = {
  key: string;
  label: string;
  category: string;
  dataType: "TEXTO" | "NUMERO" | "MONEDA" | "LISTA" | "FECHA" | "BOOLEANO" | "COLECCION" | "ARCHIVO";
  allowedOperators: OperadorCondicion[];
  allowedValues?: { valor: string; etiqueta: string }[];
  isCustomField?: boolean;
};

export const ETIQUETA_OPERADOR: Record<OperadorCondicion, string> = {
  IGUAL: "es igual a", DIFERENTE: "es diferente de",
  MAYOR_QUE: "es mayor que", MENOR_QUE: "es menor que",
  CONTIENE: "contiene", ES_VERDADERO: "es verdadero", ES_FALSO: "es falso",
  NO_CONTIENE: "no contiene", ESTA_VACIO: "está vacío", NO_ESTA_VACIO: "no está vacío",
  EMPIEZA_CON: "empieza con", TERMINA_CON: "termina con",
  MAYOR_IGUAL: "es mayor o igual", MENOR_IGUAL: "es menor o igual", ENTRE: "está entre",
  ESTA_EN: "está en", NO_ESTA_EN: "no está en",
  ANTES_DE: "es antes de", DESPUES_DE: "es después de", ENTRE_FECHAS: "está entre",
  ESTA_VENCIDA: "está vencida", ES_HOY: "es hoy", PROXIMOS_N_DIAS: "es en los próximos (días)",
  CONTIENE_ALGUNO: "contiene alguno de", CONTIENE_TODOS: "contiene todos",
  NO_CONTIENE_COLECCION: "no contiene", COLECCION_VACIA: "está vacía", COLECCION_NO_VACIA: "no está vacía",
  CANTIDAD_IGUAL: "cantidad igual a", CANTIDAD_MAYOR: "cantidad mayor que", CANTIDAD_MENOR: "cantidad menor que",
  ADJUNTO: "está adjunto", NO_ADJUNTO: "no está adjunto",
};

/** Operadores que no necesitan ningún valor de comparación. */
export const OPERADORES_SIN_VALOR = new Set<OperadorCondicion>([
  "ES_VERDADERO", "ES_FALSO", "ESTA_VACIO", "NO_ESTA_VACIO",
  "ESTA_VENCIDA", "ES_HOY", "COLECCION_VACIA", "COLECCION_NO_VACIA", "ADJUNTO", "NO_ADJUNTO",
]);

const nodoCondicionVacio = (campo?: CampoReglaCliente): ConditionNode => ({
  type: "condition",
  fieldKey: campo?.key ?? "",
  operator: campo?.allowedOperators[0] ?? "IGUAL",
  value: "",
  comparisonFieldKey: null,
});

// ── Selector de campo — agrupado por categoría, con búsqueda ───────────────

function SelectorCampo({
  campos, valor, onChange,
}: {
  campos: CampoReglaCliente[];
  valor: string;
  onChange: (campo: CampoReglaCliente) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const seleccionado = campos.find((c) => c.key === valor);
  const categorias = [...new Set(campos.map((c) => c.category))];

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger className="flex h-8 min-w-[170px] items-center justify-between gap-1.5 rounded-lg border border-stone-200 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 text-xs text-stone-700 dark:text-stone-200">
        <span className="truncate">{seleccionado ? seleccionado.label : "Campo..."}</span>
        <ChevronsUpDown className="h-3 w-3 shrink-0 text-stone-400" />
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar campo..." />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            {categorias.map((categoria) => (
              <CommandGroup key={categoria} heading={categoria}>
                {campos.filter((c) => c.category === categoria).map((campo) => (
                  <CommandItem
                    key={campo.key}
                    value={`${campo.category} ${campo.label}`}
                    onSelect={() => { onChange(campo); setAbierto(false); }}
                  >
                    <Check className={cn("mr-2 h-3.5 w-3.5", valor === campo.key ? "opacity-100" : "opacity-0")} />
                    {campo.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Valor de la condición — tipado según el campo elegido ──────────────────

function EditorValor({
  campo, nodo, campos, onChange,
}: {
  campo: CampoReglaCliente | undefined;
  nodo: ConditionNode;
  campos: CampoReglaCliente[];
  onChange: (cambios: Partial<ConditionNode>) => void;
}) {
  const [compararConCampo, setCompararConCampo] = useState(!!nodo.comparisonFieldKey);

  if (!campo || OPERADORES_SIN_VALOR.has(nodo.operator)) return null;

  const permiteCompararConCampo = campo.dataType !== "COLECCION" && campo.dataType !== "ARCHIVO"
    && !["ENTRE", "ENTRE_FECHAS", "ESTA_EN", "NO_ESTA_EN"].includes(nodo.operator);

  if (compararConCampo && permiteCompararConCampo) {
    const candidatos = campos.filter((c) => c.dataType === campo.dataType && c.key !== campo.key);
    return (
      <div className="flex items-center gap-1.5 flex-1 min-w-[170px]">
        <SelectorCampo
          campos={candidatos}
          valor={nodo.comparisonFieldKey ?? ""}
          onChange={(c) => onChange({ comparisonFieldKey: c.key, value: null })}
        />
        <button
          type="button"
          title="Comparar contra un valor fijo en vez de otro campo"
          onClick={() => { setCompararConCampo(false); onChange({ comparisonFieldKey: null }); }}
          className="h-6 w-6 shrink-0 flex items-center justify-center rounded-md text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/8"
        >
          <XIcon className="h-3 w-3" />
        </button>
      </div>
    );
  }

  const valorSimple = Array.isArray(nodo.value) ? (nodo.value[0] ?? "") : (nodo.value ?? "");
  const arreglo = Array.isArray(nodo.value) ? nodo.value : [];

  const campoValor = (() => {
    switch (campo.dataType) {
      case "FECHA": {
        if (nodo.operator === "ENTRE_FECHAS") {
          return (
            <div className="flex items-center gap-1.5 flex-1">
              <SmartDatePicker
                value={arreglo[0] ? new Date(arreglo[0]) : undefined}
                onChange={(d) => onChange({ value: [d.toISOString().slice(0, 10), arreglo[1] ?? ""] })}
                presets={[]} placeholder="Desde" className="gap-0"
              />
              <span className="text-stone-400 text-xs">–</span>
              <SmartDatePicker
                value={arreglo[1] ? new Date(arreglo[1]) : undefined}
                onChange={(d) => onChange({ value: [arreglo[0] ?? "", d.toISOString().slice(0, 10)] })}
                presets={[]} placeholder="Hasta" className="gap-0"
              />
            </div>
          );
        }
        if (nodo.operator === "PROXIMOS_N_DIAS") {
          return (
            <Input
              type="number" min={0} className="h-8 text-xs flex-1 min-w-[80px]"
              placeholder="Días" value={valorSimple}
              onChange={(e) => onChange({ value: e.target.value })}
            />
          );
        }
        return (
          <SmartDatePicker
            value={valorSimple ? new Date(valorSimple) : undefined}
            onChange={(d) => onChange({ value: d.toISOString().slice(0, 10) })}
            presets={[]} placeholder="Fecha" className="gap-0 flex-1"
          />
        );
      }
      case "NUMERO":
      case "MONEDA": {
        if (nodo.operator === "ENTRE") {
          return (
            <div className="flex items-center gap-1.5 flex-1">
              <Input
                type="number" className="h-8 text-xs" placeholder="Mín"
                value={arreglo[0] ?? ""} onChange={(e) => onChange({ value: [e.target.value, arreglo[1] ?? ""] })}
              />
              <span className="text-stone-400 text-xs">–</span>
              <Input
                type="number" className="h-8 text-xs" placeholder="Máx"
                value={arreglo[1] ?? ""} onChange={(e) => onChange({ value: [arreglo[0] ?? "", e.target.value] })}
              />
            </div>
          );
        }
        return (
          <Input
            type="number" className="h-8 text-xs flex-1 min-w-[90px]" placeholder="Valor"
            value={valorSimple} onChange={(e) => onChange({ value: e.target.value })}
          />
        );
      }
      case "LISTA": {
        const enModoLista = nodo.operator === "ESTA_EN" || nodo.operator === "NO_ESTA_EN";
        if (campo.allowedValues && !enModoLista) {
          return (
            <Select value={valorSimple} onValueChange={(v) => onChange({ value: v })}>
              <SelectTrigger className="h-8 text-xs flex-1 min-w-[130px]"><SelectValue placeholder="Valor..." /></SelectTrigger>
              <SelectContent>
                {campo.allowedValues.map((o) => <SelectItem key={o.valor} value={o.valor}>{o.etiqueta}</SelectItem>)}
              </SelectContent>
            </Select>
          );
        }
        return (
          <Input
            className="h-8 text-xs flex-1 min-w-[130px]"
            placeholder={enModoLista ? "Valores separados por coma" : "Valor..."}
            value={enModoLista ? arreglo.join(", ") : valorSimple}
            onChange={(e) => onChange({ value: enModoLista ? e.target.value.split(",").map((v) => v.trim()).filter(Boolean) : e.target.value })}
          />
        );
      }
      case "COLECCION": {
        if (nodo.operator.startsWith("CANTIDAD")) {
          return (
            <Input
              type="number" min={0} className="h-8 text-xs flex-1 min-w-[80px]" placeholder="Cantidad"
              value={valorSimple} onChange={(e) => onChange({ value: e.target.value })}
            />
          );
        }
        return (
          <Input
            className="h-8 text-xs flex-1 min-w-[150px]" placeholder="Valores separados por coma"
            value={arreglo.join(", ")}
            onChange={(e) => onChange({ value: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })}
          />
        );
      }
      default:
        return (
          <Input
            className="h-8 text-xs flex-1 min-w-[130px]" placeholder="Valor..."
            value={valorSimple} onChange={(e) => onChange({ value: e.target.value })}
          />
        );
    }
  })();

  return (
    <div className="flex items-center gap-1.5 flex-1">
      {campoValor}
      {permiteCompararConCampo && (
        <button
          type="button"
          title="Comparar contra otro campo"
          onClick={() => setCompararConCampo(true)}
          className="h-6 w-6 shrink-0 flex items-center justify-center rounded-md text-stone-400 hover:text-lime-600 dark:hover:text-lime-400 hover:bg-stone-100 dark:hover:bg-white/8"
        >
          <ChevronsUpDown className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ── Una fila de condición ───────────────────────────────────────────────────

function FilaCondicion({
  nodo, campos, onChange, onEliminar, onDuplicar, onSubir, onBajar, primero, ultimo,
}: {
  nodo: ConditionNode;
  campos: CampoReglaCliente[];
  onChange: (nodo: ConditionNode) => void;
  onEliminar: () => void;
  onDuplicar: () => void;
  onSubir?: () => void;
  onBajar?: () => void;
  primero: boolean;
  ultimo: boolean;
}) {
  const campo = campos.find((c) => c.key === nodo.fieldKey);
  const operadores = campo?.allowedOperators ?? [];

  return (
    <div className="flex items-start gap-1.5 rounded-lg border border-stone-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-2.5 py-2">
      <div className="flex flex-col shrink-0">
        <button type="button" disabled={primero} onClick={onSubir} className="h-4 w-4 flex items-center justify-center text-stone-300 dark:text-white/20 hover:text-stone-600 dark:hover:text-white/60 disabled:opacity-30 disabled:pointer-events-none">
          <ChevronUp className="h-3 w-3" />
        </button>
        <button type="button" disabled={ultimo} onClick={onBajar} className="h-4 w-4 flex items-center justify-center text-stone-300 dark:text-white/20 hover:text-stone-600 dark:hover:text-white/60 disabled:opacity-30 disabled:pointer-events-none">
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        <SelectorCampo
          campos={campos}
          valor={nodo.fieldKey}
          onChange={(c) => onChange({ ...nodo, fieldKey: c.key, operator: c.allowedOperators[0], value: "", comparisonFieldKey: null })}
        />

        <Select
          value={nodo.operator}
          onValueChange={(v) => onChange({ ...nodo, operator: v as OperadorCondicion, value: "" })}
        >
          <SelectTrigger className="h-8 text-xs min-w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {operadores.map((op) => <SelectItem key={op} value={op} className="text-xs">{ETIQUETA_OPERADOR[op]}</SelectItem>)}
          </SelectContent>
        </Select>

        <EditorValor
          campo={campo}
          nodo={nodo}
          campos={campos}
          onChange={(cambios) => onChange({ ...nodo, ...cambios })}
        />
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        <button type="button" title="Duplicar" onClick={onDuplicar} className="h-6 w-6 flex items-center justify-center rounded-md text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/8">
          <Copy className="h-3 w-3" />
        </button>
        <button type="button" title="Eliminar" onClick={onEliminar} className="h-6 w-6 flex items-center justify-center rounded-md text-stone-400 hover:text-red-500 hover:bg-red-500/8">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ── Un grupo (raíz o anidado, máximo 2 niveles) ────────────────────────────

function GrupoCondiciones({
  grupo, campos, onChange, esRaiz, onEliminarGrupo,
}: {
  grupo: GroupNode;
  campos: CampoReglaCliente[];
  onChange: (grupo: GroupNode) => void;
  esRaiz: boolean;
  /** Solo aplica a grupos anidados (no la raíz, que siempre existe). */
  onEliminarGrupo?: () => void;
}) {
  const actualizarHijo = (idx: number, hijo: ConditionNode | GroupNode) => {
    const children = [...grupo.children];
    children[idx] = hijo;
    onChange({ ...grupo, children });
  };

  const eliminarHijo = (idx: number) => {
    onChange({ ...grupo, children: grupo.children.filter((_, i) => i !== idx) });
  };

  const duplicarHijo = (idx: number) => {
    const children = [...grupo.children];
    children.splice(idx + 1, 0, structuredClone(children[idx]));
    onChange({ ...grupo, children });
  };

  const moverHijo = (idx: number, delta: number) => {
    const nuevoIdx = idx + delta;
    if (nuevoIdx < 0 || nuevoIdx >= grupo.children.length) return;
    const children = [...grupo.children];
    [children[idx], children[nuevoIdx]] = [children[nuevoIdx], children[idx]];
    onChange({ ...grupo, children });
  };

  const agregarCondicion = () => {
    onChange({ ...grupo, children: [...grupo.children, nodoCondicionVacio(campos[0])] });
  };

  const agregarGrupo = () => {
    onChange({
      ...grupo,
      children: [...grupo.children, { type: "group", logicalOperator: "AND", children: [nodoCondicionVacio(campos[0])] }],
    });
  };

  return (
    <div className={cn("space-y-2", !esRaiz && "rounded-xl border border-dashed border-stone-300 dark:border-white/15 bg-stone-50/60 dark:bg-white/[0.02] p-2.5")}>
      <div className="flex items-center gap-2">
        <Select value={grupo.logicalOperator} onValueChange={(v) => onChange({ ...grupo, logicalOperator: v as "AND" | "OR" })}>
          <SelectTrigger className="h-7 w-[210px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND" className="text-xs">Cumplir todas (Y)</SelectItem>
            <SelectItem value="OR" className="text-xs">Cumplir cualquiera (O)</SelectItem>
          </SelectContent>
        </Select>
        {!esRaiz && (
          <>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">Grupo</span>
            <button type="button" title="Eliminar grupo" onClick={onEliminarGrupo} className="ml-auto h-6 w-6 flex items-center justify-center rounded-md text-stone-400 hover:text-red-500 hover:bg-red-500/8">
              <Trash2 className="h-3 w-3" />
            </button>
          </>
        )}
      </div>

      <div className="space-y-1.5">
        {grupo.children.map((hijo, idx) =>
          hijo.type === "condition" ? (
            <FilaCondicion
              key={idx}
              nodo={hijo}
              campos={campos}
              onChange={(n) => actualizarHijo(idx, n)}
              onEliminar={() => eliminarHijo(idx)}
              onDuplicar={() => duplicarHijo(idx)}
              onSubir={() => moverHijo(idx, -1)}
              onBajar={() => moverHijo(idx, 1)}
              primero={idx === 0}
              ultimo={idx === grupo.children.length - 1}
            />
          ) : (
            <GrupoCondiciones
              key={idx}
              grupo={hijo}
              campos={campos}
              onChange={(g) => actualizarHijo(idx, g)}
              esRaiz={false}
              onEliminarGrupo={() => eliminarHijo(idx)}
            />
          )
        )}
        {grupo.children.length === 0 && (
          <p className="text-[11px] text-stone-400 dark:text-stone-600 italic py-1">Sin condiciones todavía.</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={agregarCondicion} className="h-7 text-xs gap-1">
          <Plus className="h-3 w-3" /> Agregar condición
        </Button>
        {esRaiz && (
          <Button type="button" variant="outline" size="sm" onClick={agregarGrupo} className="h-7 text-xs gap-1">
            <Plus className="h-3 w-3" /> Agregar grupo
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Export ───────────────────────────────────────────────────────────────

export function ConstructorCondiciones({
  value, campos, onChange,
}: {
  value: GroupNode;
  campos: CampoReglaCliente[];
  onChange: (grupo: GroupNode) => void;
}) {
  return <GrupoCondiciones grupo={value} campos={campos} onChange={onChange} esRaiz />;
}

export const arbolVacio = (): GroupNode => ({ type: "group", logicalOperator: "AND", children: [] });
