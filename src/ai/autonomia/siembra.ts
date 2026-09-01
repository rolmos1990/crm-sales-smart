import { prisma } from "@/shared/db/prisma";
import { CLASIFICACION_INICIAL } from "./clasificacion-inicial";
import type { CategoriaIntencionAutonomia } from "@/generated/prisma/enums";

/**
 * Siembra las 16 filas de AutonomiaIntencionConfig con la clasificación
 * inicial del pedido (research.md Decisión 1), idempotente por
 * [agenteIAConfigId, categoria] — mismo patrón de siembra por-entidad que
 * `crearPipelineDefault` (src/shared/inicializacion/pipeline-default.ts).
 *
 * Se invoca solo cuando `AgenteIAConfig` se crea por primera vez (ver
 * guardarAgenteIA en src/configuracion/ia/agente-actions.ts) — un agente que
 * ya existía antes de esta spec NO se siembra automáticamente, conservando
 * el criterio de "sin filas = comportamiento anterior" (data-model.md).
 *
 * NOTA de implementación (016): el plan original (tasks.md T003) proponía
 * extender `prisma/seed.ts`, pero ese archivo es un fixture de desarrollo
 * destructivo, no el mecanismo real de onboarding — se sigue el patrón ya
 * establecido en el proyecto (ver memoria de la spec 011) de sembrar en el
 * punto de creación real de la entidad dueña.
 */
export async function sembrarAutonomiaDefault(instanciaId: string, agenteIAConfigId: string): Promise<void> {
  await prisma.autonomiaIntencionConfig.createMany({
    data: (Object.entries(CLASIFICACION_INICIAL) as Array<[CategoriaIntencionAutonomia, (typeof CLASIFICACION_INICIAL)[CategoriaIntencionAutonomia]]>).map(
      ([categoria, nivel]) => ({ instanciaId, agenteIAConfigId, categoria, nivel }),
    ),
    skipDuplicates: true,
  });
}
