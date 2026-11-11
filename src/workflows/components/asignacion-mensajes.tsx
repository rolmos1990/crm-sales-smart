"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, MessageSquare } from "lucide-react";
import { asignarWorkflowMensajesAction } from "../actions";
import { SelectSimple } from "./editor/campos";

const NINGUNO = "__ninguno__";

/**
 * Workflow que atiende cada mensaje de una conversación sin automatización
 * activa (disparador "Mensaje recibido"). Útil para atender con IA desde el
 * primer mensaje a quien no entra por una etapa con Workflow (D3).
 */
export function AsignacionMensajes({
  workflowId,
  candidatos,
  puedeModificar,
}: {
  workflowId: string | null;
  candidatos: { id: string; nombre: string }[];
  puedeModificar: boolean;
}) {
  const [valor, setValor] = useState(workflowId ?? NINGUNO);
  const [guardando, startGuardar] = useTransition();

  const cambiar = (nuevo: string) => {
    const anterior = valor;
    setValor(nuevo);
    startGuardar(async () => {
      const r = await asignarWorkflowMensajesAction(nuevo === NINGUNO ? null : nuevo);
      if (!r.exito) {
        setValor(anterior);
        return void toast.error(r.error);
      }
      toast.success(nuevo === NINGUNO ? "Sin Workflow para mensajes nuevos" : "Workflow asignado a mensajes nuevos");
    });
  };

  return (
    <div data-slot="asignacion-mensajes" className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
      <MessageSquare className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">Mensajes sin atención</p>
        <p className="text-xs text-muted-foreground">
          Workflow que se inicia cuando llega un mensaje y la conversación no tiene ninguna automatización activa. Solo aparecen
          Workflows publicados cuyo Inicio acepta “Mensaje recibido”.
        </p>
      </div>
      <div className="flex items-center gap-2 sm:w-64">
        {guardando && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
        {puedeModificar ? (
          <SelectSimple
            valor={valor}
            opciones={[{ valor: NINGUNO, etiqueta: "Ninguno" }, ...candidatos.map((c) => ({ valor: c.id, etiqueta: c.nombre }))]}
            onChange={cambiar}
          />
        ) : (
          <span className="text-sm text-muted-foreground">{candidatos.find((c) => c.id === valor)?.nombre ?? "Ninguno"}</span>
        )}
      </div>
    </div>
  );
}
