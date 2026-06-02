"use client";

import { Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { CampoPersonalizadoPipeline } from "@/crm/pipeline/types";
import { cn } from "@/lib/utils";

interface CamposDinamicosProps {
  campos: CampoPersonalizadoPipeline[];
  stageId: string | null;
  valores: Record<string, unknown>;
  onChange: (clave: string, valor: unknown) => void;
  disabled?: boolean;
}

export function CamposDinamicos({ campos, stageId, valores, onChange, disabled }: CamposDinamicosProps) {
  const camposVisibles = campos.filter((c) =>
    c.activo && (stageId === null || c.visibleEn.length === 0 || c.visibleEn.includes(stageId))
  );

  if (camposVisibles.length === 0) return null;

  return (
    <div className="space-y-4">
      {camposVisibles.map((campo) => {
        const esBloqueado = stageId !== null && campo.bloqueadoEn.includes(stageId);
        const esRequerido = stageId !== null && campo.requeridoEn.includes(stageId);
        return (
          <CampoInput
            key={campo.id}
            campo={campo}
            valor={valores[campo.clave]}
            onChange={(v) => onChange(campo.clave, v)}
            disabled={disabled || esBloqueado}
            requerido={esRequerido}
            bloqueado={esBloqueado}
          />
        );
      })}
    </div>
  );
}

/** Valida que todos los campos requeridos en el stage actual tengan valor */
export function validarCamposRequeridos(
  campos: CampoPersonalizadoPipeline[],
  stageId: string | null,
  valores: Record<string, unknown>,
): string[] {
  if (!stageId) return [];
  return campos
    .filter((c) => c.activo && c.requeridoEn.includes(stageId))
    .filter((c) => {
      const v = valores[c.clave];
      if (v === null || v === undefined || v === "") return true;
      if (Array.isArray(v) && v.length === 0) return true;
      return false;
    })
    .map((c) => c.nombre);
}

function CampoInput({
  campo,
  valor,
  onChange,
  disabled,
  requerido,
  bloqueado,
}: {
  campo: CampoPersonalizadoPipeline;
  valor: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
  requerido?: boolean;
  bloqueado?: boolean;
}) {
  const labelClasses = "text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500";
  const inputClasses = "bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl h-9";

  const label = (
    <div className="flex items-center gap-1.5">
      <span className={labelClasses}>{campo.nombre}</span>
      {requerido && <span className="text-red-400 text-xs">*</span>}
      {bloqueado && (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-orange-500 dark:text-orange-400">
          <Lock className="h-2.5 w-2.5" />
          Solo lectura
        </span>
      )}
    </div>
  );

  switch (campo.tipo) {
    case "TEXTO":
    case "EMAIL":
    case "TELEFONO":
    case "URL":
      return (
        <div className="space-y-1.5">
          {label}
          <Input
            type={
              campo.tipo === "EMAIL" ? "email" :
              campo.tipo === "TELEFONO" ? "tel" :
              campo.tipo === "URL" ? "url" : "text"
            }
            className={inputClasses}
            value={typeof valor === "string" ? valor : ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={campo.descripcion ?? ""}
          />
        </div>
      );

    case "TEXTO_LARGO":
      return (
        <div className="space-y-1.5">
          {label}
          <Textarea
            className="resize-none bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl text-sm"
            rows={3}
            value={typeof valor === "string" ? valor : ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={campo.descripcion ?? ""}
          />
        </div>
      );

    case "NUMERO":
    case "DECIMAL":
      return (
        <div className="space-y-1.5">
          {label}
          <Input
            type="number"
            step={campo.tipo === "DECIMAL" ? "0.01" : "1"}
            className={inputClasses}
            value={valor != null ? String(valor) : ""}
            onChange={(e) => onChange(e.target.valueAsNumber)}
            disabled={disabled}
            placeholder={campo.descripcion ?? ""}
          />
        </div>
      );

    case "FECHA":
      return (
        <div className="space-y-1.5">
          {label}
          <Input
            type="date"
            className={inputClasses}
            value={typeof valor === "string" ? valor : ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        </div>
      );

    case "BOOLEANO":
      return (
        <div className="flex items-center justify-between rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 px-3 py-2.5">
          <Label className={cn(labelClasses, "cursor-pointer")}>{campo.nombre}</Label>
          <Switch
            checked={!!valor}
            onCheckedChange={onChange}
            disabled={disabled}
          />
        </div>
      );

    case "SELECT": {
      const opciones = campo.opciones ?? [];
      const seleccionado = typeof valor === "string" ? valor : "";
      return (
        <div className="space-y-1.5">
          {label}
          <Select
            value={seleccionado}
            onValueChange={onChange}
            disabled={disabled}
          >
            <SelectTrigger className={inputClasses}>
              {seleccionado
                ? <span>{seleccionado}</span>
                : <SelectValue placeholder="Seleccionar..." />}
            </SelectTrigger>
            <SelectContent>
              {opciones.map((op) => (
                <SelectItem key={op} value={op}>{op}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    case "MULTISELECT": {
      const opciones = campo.opciones ?? [];
      const seleccionados: string[] = Array.isArray(valor) ? (valor as string[]) : [];
      const toggle = (op: string) => {
        const next = seleccionados.includes(op)
          ? seleccionados.filter((v) => v !== op)
          : [...seleccionados, op];
        onChange(next);
      };
      return (
        <div className="space-y-1.5">
          {label}
          <div className="rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 p-3 space-y-2">
            {opciones.map((op) => (
              <div key={op} className="flex items-center gap-2">
                <Checkbox
                  id={`${campo.clave}-${op}`}
                  checked={seleccionados.includes(op)}
                  onCheckedChange={() => toggle(op)}
                  disabled={disabled}
                />
                <Label
                  htmlFor={`${campo.clave}-${op}`}
                  className="text-sm text-stone-700 dark:text-stone-300 cursor-pointer"
                >
                  {op}
                </Label>
              </div>
            ))}
            {opciones.length === 0 && (
              <p className="text-xs text-stone-400 dark:text-stone-600">Sin opciones configuradas</p>
            )}
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}
