import { z } from "zod";
import { CategoriaIntencionAutonomia, NivelAutonomia } from "@/generated/prisma/enums";

const CondicionesConfianzaSchema = z
  .object({
    confianzaMinimaClasificacion: z.number().min(0).max(1).optional(),
    requiereAusenciaSenalClienteMolestoEnPerfil: z.boolean().optional(),
  })
  .nullable()
  .optional();

export const AutonomiaIntencionConfigItemSchema = z.object({
  categoria: z.enum(CategoriaIntencionAutonomia),
  nivel: z.enum(NivelAutonomia),
  condicionesConfianza: CondicionesConfianzaSchema,
});

export const GuardarAutonomiaIntencionConfigSchema = z.object({
  agenteIAConfigId: z.string().min(1),
  filas: z.array(AutonomiaIntencionConfigItemSchema),
});
export type GuardarAutonomiaIntencionConfigInput = z.infer<typeof GuardarAutonomiaIntencionConfigSchema>;

export const EditarYEnviarRespuestaPendienteSchema = z.object({
  id: z.string().min(1),
  textoEditado: z.string().min(1),
});
