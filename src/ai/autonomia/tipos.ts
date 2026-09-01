import type { CategoriaIntencionAutonomia, NivelAutonomia } from "@/generated/prisma/enums";

export type { CategoriaIntencionAutonomia, NivelAutonomia };

// Solo relevante cuando nivel = CONDITIONAL_AUTOMATION (research.md Decisión 4).
export interface CondicionesConfianza {
  confianzaMinimaClasificacion?: number;
  requiereAusenciaSenalClienteMolestoEnPerfil?: boolean;
}

export interface AutonomiaIntencionConfigItem {
  categoria: CategoriaIntencionAutonomia;
  nivel: NivelAutonomia;
  condicionesConfianza: CondicionesConfianza | null;
}

export interface CategoriaClasificada {
  categoria: CategoriaIntencionAutonomia;
  confianza: number;
}

export interface ClasificacionIntencion {
  categorias: CategoriaClasificada[];
}

export interface DecisionAutonomia {
  accion: "ENVIAR" | "PENDIENTE" | "NO_GENERAR";
  motivo: string;
  categoriaAplicada?: CategoriaIntencionAutonomia;
}

export const ESTADOS_RESPUESTA_PENDIENTE = [
  "PENDIENTE",
  "ENVIADA_TAL_CUAL",
  "EDITADA_Y_ENVIADA",
  "DESCARTADA",
] as const;
export type EstadoRespuestaPendiente = (typeof ESTADOS_RESPUESTA_PENDIENTE)[number];
