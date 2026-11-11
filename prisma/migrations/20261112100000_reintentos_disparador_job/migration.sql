-- Fase 0.3 — reintentos y recuperación de jobs de disparadores. Aditiva:
-- intentos=0 y bloqueadoHasta=NULL para los jobs existentes.

-- AlterTable
ALTER TABLE "DisparadorJob" ADD COLUMN     "bloqueadoHasta" TIMESTAMP(3),
ADD COLUMN     "intentos" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "DisparadorJob_estado_bloqueadoHasta_idx" ON "DisparadorJob"("estado", "bloqueadoHasta");

