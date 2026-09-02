-- 023-transportistas-por-pais
-- Columna nullable (research.md Decisión 2): obligatoria por regla de
-- negocio para transportistas nuevos (ver schema.ts), pero un transportista
-- existente puede quedar sin país ("país pendiente") hasta completarse o
-- hasta que scripts/backfill-pais-transportista.ts lo infiera.
ALTER TABLE "Transportista" ADD COLUMN "paisId" TEXT;

CREATE INDEX "Transportista_paisId_idx" ON "Transportista"("paisId");

-- onDelete: Restrict — mismo criterio que ConfiguracionEmpresa.paisOperacionId
-- no se puede borrar del catálogo un país mientras algún transportista lo
-- tenga asignado.
ALTER TABLE "Transportista" ADD CONSTRAINT "Transportista_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "Pais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
