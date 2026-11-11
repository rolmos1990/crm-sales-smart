// A diferencia de EtapaCambiada (enum legado `etapa`), este evento describe el
// cambio de `stageId` del pipeline dinámico. Se publica en TODOS los caminos
// que mueven una oportunidad (Kanban, Inbox, disparadores, creación) — ver
// moverOportunidadAEtapa en src/crm/pipeline/mover-stage.ts.
export type OrigenMovimientoEtapaPayload = "USUARIO" | "WORKFLOW" | "DISPARADOR" | "IA" | "SISTEMA";

export interface OportunidadMovidaDeEtapaPayload {
  version: 1;
  instanciaId: string;
  oportunidadId: string;
  pipelineId: string;
  /** null cuando la oportunidad se crea directamente en la etapa. */
  stageAnteriorId: string | null;
  stageNuevoId: string;
  historialId: string;
  origen: OrigenMovimientoEtapaPayload;
  usuarioId: string | null;
}
