-- Fase 0.2 — historial de cambios de etapa de oportunidades. Aditiva: no
-- toca datos existentes (el historial empieza vacío).

-- CreateEnum
CREATE TYPE "OrigenMovimientoEtapa" AS ENUM ('USUARIO', 'WORKFLOW', 'DISPARADOR', 'IA', 'SISTEMA');

-- CreateTable
CREATE TABLE "OportunidadHistorialEtapa" (
    "id" TEXT NOT NULL,
    "stageAnteriorId" TEXT,
    "stageNuevoId" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "origen" "OrigenMovimientoEtapa" NOT NULL,
    "usuarioId" TEXT,
    "ejecucionWorkflowId" TEXT,
    "motivo" TEXT,
    "procesadoWorkflowEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "oportunidadId" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "OportunidadHistorialEtapa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OportunidadHistorialEtapa_oportunidadId_creadoEn_idx" ON "OportunidadHistorialEtapa"("oportunidadId", "creadoEn");

-- CreateIndex
CREATE INDEX "OportunidadHistorialEtapa_instanciaId_creadoEn_idx" ON "OportunidadHistorialEtapa"("instanciaId", "creadoEn");

-- CreateIndex
CREATE INDEX "OportunidadHistorialEtapa_procesadoWorkflowEn_idx" ON "OportunidadHistorialEtapa"("procesadoWorkflowEn");

-- AddForeignKey
ALTER TABLE "OportunidadHistorialEtapa" ADD CONSTRAINT "OportunidadHistorialEtapa_oportunidadId_fkey" FOREIGN KEY ("oportunidadId") REFERENCES "Oportunidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

