"use client";

// 016-niveles-autonomia-automatizacion (Historia 1) — configurar el nivel de
// autonomía por categoría de intención para un agente. Guardar NO afecta
// ninguna RespuestaPendienteRevision ya existente (FR-013).

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldAlert, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { obtenerAutonomiaDeAgente, guardarAutonomiaIntencionConfig } from "@/ai/autonomia/actions";
import { CLASIFICACION_INICIAL } from "@/ai/autonomia/clasificacion-inicial";
import type { CategoriaIntencionAutonomia, NivelAutonomia } from "@/generated/prisma/enums";
import type { CondicionesConfianza } from "@/ai/autonomia/tipos";

const NIVELES: Record<NivelAutonomia, string> = {
  AUTO_REPLY_SAFE_INTENTS: "Enviar automáticamente",
  CONDITIONAL_AUTOMATION: "Automatización condicional",
  SUGGESTION_ONLY: "Solo sugerir (requiere aprobación)",
  HUMAN_ONLY: "Solo humano (no genera respuesta)",
};

// research.md Decisión 1 — clasificación inicial sugerida por el pedido,
// usada solo como valor por defecto en la UI mientras el agente no tenga
// ninguna fila guardada todavía (no se persiste hasta que se guarda).
const GRUPOS: Array<{
  titulo: string;
  descripcion: string;
  icono: typeof ShieldCheck;
  color: string;
  categorias: CategoriaIntencionAutonomia[];
}> = [
  {
    titulo: "Seguras",
    descripcion: "Se responden automáticamente sin revisión.",
    icono: ShieldCheck,
    color: "text-emerald-400",
    categorias: ["SALUDO", "CONSULTA_HORARIO", "PREGUNTA_FRECUENTE", "INFORMACION_GENERAL"],
  },
  {
    titulo: "Supervisadas",
    descripcion: "El agente redacta la respuesta, pero queda pendiente de aprobación humana.",
    icono: ShieldAlert,
    color: "text-amber-400",
    categorias: ["RECOMENDACION", "CONSULTA_PRECIO", "CONSULTA_DISPONIBILIDAD", "COSTO_ENVIO", "SOLICITUD_COTIZACION"],
  },
  {
    titulo: "Solo humano",
    descripcion: "Nunca se genera respuesta automática — siempre requiere intervención humana.",
    icono: ShieldOff,
    color: "text-red-400",
    categorias: [
      "RECLAMO",
      "SOLICITUD_REEMBOLSO",
      "DESCUENTO_ESPECIAL",
      "PROBLEMA_PAGO",
      "EXCEPCION_ENTREGA",
      "CLIENTE_MOLESTO",
      "COMPROMISO_NO_DEFINIDO",
    ],
  },
];

const ETIQUETAS_CATEGORIA: Record<CategoriaIntencionAutonomia, string> = {
  SALUDO: "Saludo",
  CONSULTA_HORARIO: "Consulta de horario",
  PREGUNTA_FRECUENTE: "Pregunta frecuente",
  INFORMACION_GENERAL: "Información general",
  RECOMENDACION: "Recomendación",
  CONSULTA_PRECIO: "Consulta de precio",
  CONSULTA_DISPONIBILIDAD: "Consulta de disponibilidad",
  COSTO_ENVIO: "Costo de envío",
  SOLICITUD_COTIZACION: "Solicitud de cotización",
  RECLAMO: "Reclamo",
  SOLICITUD_REEMBOLSO: "Solicitud de reembolso",
  DESCUENTO_ESPECIAL: "Descuento especial",
  PROBLEMA_PAGO: "Problema de pago",
  EXCEPCION_ENTREGA: "Excepción de entrega",
  CLIENTE_MOLESTO: "Cliente molesto",
  COMPROMISO_NO_DEFINIDO: "Compromiso no definido",
};

interface Fila {
  categoria: CategoriaIntencionAutonomia;
  nivel: NivelAutonomia;
  condicionesConfianza: CondicionesConfianza | null;
}

interface SeccionAutomatizacionProps {
  agenteIAConfigId: string;
}

export function SeccionAutomatizacion({ agenteIAConfigId }: SeccionAutomatizacionProps) {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    obtenerAutonomiaDeAgente(agenteIAConfigId).then((existentes) => {
      if (existentes.length > 0) {
        setFilas(
          existentes.map((f) => ({
            categoria: f.categoria,
            nivel: f.nivel,
            condicionesConfianza: (f.condicionesConfianza as CondicionesConfianza | null) ?? null,
          })),
        );
        return;
      }
      // Sin configuración todavía — se prellenan valores sugeridos (no se
      // guardan hasta que el usuario haga click en "Guardar cambios").
      const sugeridas: Fila[] = (Object.keys(CLASIFICACION_INICIAL) as CategoriaIntencionAutonomia[]).map((categoria) => ({
        categoria,
        nivel: CLASIFICACION_INICIAL[categoria],
        condicionesConfianza: null,
      }));
      setFilas(sugeridas);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agenteIAConfigId]);

  function actualizarNivel(categoria: CategoriaIntencionAutonomia, nivel: NivelAutonomia) {
    setFilas((prev) => prev?.map((f) => (f.categoria === categoria ? { ...f, nivel } : f)) ?? null);
  }

  function actualizarCondiciones(categoria: CategoriaIntencionAutonomia, condiciones: CondicionesConfianza) {
    setFilas((prev) => prev?.map((f) => (f.categoria === categoria ? { ...f, condicionesConfianza: condiciones } : f)) ?? null);
  }

  function handleGuardar() {
    if (!filas) return;
    startTransition(async () => {
      const resultado = await guardarAutonomiaIntencionConfig({ agenteIAConfigId, filas });
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Configuración de automatización guardada");
    });
  }

  if (!filas) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-stone-500 text-xs">
        Define qué categorías de mensajes el agente puede responder solo, cuáles requieren aprobación, y cuáles nunca se
        automatizan.
      </p>

      {GRUPOS.map((grupo) => (
        <div key={grupo.titulo} className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <grupo.icono className={`h-4 w-4 ${grupo.color}`} />
            <p className="text-stone-200 text-sm font-medium">{grupo.titulo}</p>
          </div>
          <p className="text-stone-500 text-xs -mt-1.5">{grupo.descripcion}</p>

          <ul className="flex flex-col gap-2">
            {grupo.categorias.map((categoria) => {
              const fila = filas.find((f) => f.categoria === categoria)!;
              return (
                <li key={categoria} className="rounded-xl border border-white/8 bg-white/3 p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-stone-300 text-sm">{ETIQUETAS_CATEGORIA[categoria]}</span>
                    <Select
                      items={NIVELES}
                      value={fila.nivel}
                      onValueChange={(v) => v && actualizarNivel(categoria, v as NivelAutonomia)}
                    >
                      <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(NIVELES) as NivelAutonomia[]).map((n) => (
                          <SelectItem key={n} value={n}>{NIVELES[n]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {fila.nivel === "CONDITIONAL_AUTOMATION" && (
                    <div className="flex flex-col gap-2 pl-1 pt-1 border-t border-white/5">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-stone-400 text-xs">Confianza mínima de clasificación (0–1)</label>
                        <Input
                          type="number"
                          min={0}
                          max={1}
                          step={0.05}
                          value={fila.condicionesConfianza?.confianzaMinimaClasificacion ?? ""}
                          onChange={(e) =>
                            actualizarCondiciones(categoria, {
                              ...fila.condicionesConfianza,
                              confianzaMinimaClasificacion: e.target.value === "" ? undefined : Number(e.target.value),
                            })
                          }
                          className="w-24 bg-white/5 border-white/10 text-stone-50"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-stone-400 text-xs">Exigir ausencia de señal de cliente molesto</label>
                        <Switch
                          checked={fila.condicionesConfianza?.requiereAusenciaSenalClienteMolestoEnPerfil ?? false}
                          onCheckedChange={(checked) =>
                            actualizarCondiciones(categoria, {
                              ...fila.condicionesConfianza,
                              requiereAusenciaSenalClienteMolestoEnPerfil: checked,
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <Button
        type="button"
        onClick={handleGuardar}
        disabled={isPending}
        className="self-end bg-lime-500/90 text-stone-950 hover:bg-lime-400 font-semibold"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar cambios"}
      </Button>
    </div>
  );
}
