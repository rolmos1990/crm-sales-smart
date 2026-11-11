import { z } from "zod";
import { CATALOGO_NODOS } from "./definicion/catalogo-nodos";
import type { DefinicionWorkflow } from "./definicion/schema";

export const DatosWorkflowSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(80, "Máximo 80 caracteres"),
  descripcion: z.string().trim().max(300, "Máximo 300 caracteres").optional().or(z.literal("")),
});
export type DatosWorkflow = z.infer<typeof DatosWorkflowSchema>;

export const AsignarWorkflowEtapaSchema = z.object({
  pipelineId: z.string().min(1),
  stageId: z.string().min(1),
  // null = quitar el Workflow de la etapa.
  workflowId: z.string().min(1).nullable(),
});

/** Punto de partida de un Workflow nuevo: Inicio → Fin, ya publicable. */
export function definicionInicial(): DefinicionWorkflow {
  return {
    version: 1,
    nodos: [
      { id: "inicio", tipo: "INICIO", posicion: { x: 0, y: 0 }, config: CATALOGO_NODOS.INICIO.configInicial() },
      { id: "fin", tipo: "FIN", posicion: { x: 0, y: 220 }, config: CATALOGO_NODOS.FIN.configInicial() },
    ],
    conexiones: [{ id: "inicio-fin", origen: "inicio", salida: "siguiente", destino: "fin" }],
  };
}
