-- Workflows (B1) — ejecuciones y su historial de pasos. Aditiva.

-- CreateEnum
CREATE TYPE "EstadoEjecucionWorkflow" AS ENUM ('EJECUTANDO', 'ESPERANDO_RESPUESTA', 'ESPERANDO_TIMER', 'ESPERANDO_ACCION_EXTERNA', 'IA_ACTIVA', 'TRANSFERIDA_HUMANO', 'COMPLETADA', 'FALLIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoEsperaWorkflow" AS ENUM ('TIMER', 'RESPUESTA', 'IA', 'REVISION', 'REINTENTO');

-- AlterTable
ALTER TABLE "Conversacion" ADD COLUMN     "atencionEjecucionId" TEXT;

-- CreateTable
CREATE TABLE "WorkflowEjecucion" (
    "id" TEXT NOT NULL,
    "estado" "EstadoEjecucionWorkflow" NOT NULL DEFAULT 'EJECUTANDO',
    "nodoActualId" TEXT,
    "contexto" JSONB NOT NULL,
    "esperaTipo" "TipoEsperaWorkflow",
    "esperaDesde" TIMESTAMP(3),
    "esperaHasta" TIMESTAMP(3),
    "ultimoMensajeProcesadoId" TEXT,
    "intentosNodo" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" TIMESTAMP(3),
    "bloqueadoPor" TEXT,
    "claveIdempotencia" TEXT NOT NULL,
    "controlaConversacion" BOOLEAN NOT NULL DEFAULT false,
    "profundidad" INTEGER NOT NULL DEFAULT 0,
    "disparador" "TipoDisparadorWorkflow" NOT NULL,
    "stageId" TEXT,
    "resultado" TEXT,
    "error" TEXT,
    "motivoCancelacion" TEXT,
    "iniciadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,
    "finalizadaEn" TIMESTAMP(3),
    "workflowId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "oportunidadId" TEXT,
    "conversacionId" TEXT,
    "contactoId" TEXT,
    "ejecucionOrigenId" TEXT,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "WorkflowEjecucion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowEjecucionPaso" (
    "id" TEXT NOT NULL,
    "nodoId" TEXT NOT NULL,
    "tipoNodo" TEXT NOT NULL,
    "iteracion" INTEGER NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL,
    "salida" TEXT,
    "resultado" JSONB,
    "error" TEXT,
    "duracionMs" INTEGER,
    "ocurridoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ejecucionId" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "WorkflowEjecucionPaso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowEjecucion_claveIdempotencia_key" ON "WorkflowEjecucion"("claveIdempotencia");

-- CreateIndex
CREATE INDEX "WorkflowEjecucion_estado_esperaHasta_idx" ON "WorkflowEjecucion"("estado", "esperaHasta");

-- CreateIndex
CREATE INDEX "WorkflowEjecucion_estado_bloqueadoHasta_idx" ON "WorkflowEjecucion"("estado", "bloqueadoHasta");

-- CreateIndex
CREATE INDEX "WorkflowEjecucion_oportunidadId_estado_idx" ON "WorkflowEjecucion"("oportunidadId", "estado");

-- CreateIndex
CREATE INDEX "WorkflowEjecucion_conversacionId_estado_idx" ON "WorkflowEjecucion"("conversacionId", "estado");

-- CreateIndex
CREATE INDEX "WorkflowEjecucion_instanciaId_workflowId_iniciadaEn_idx" ON "WorkflowEjecucion"("instanciaId", "workflowId", "iniciadaEn");

-- CreateIndex
CREATE INDEX "WorkflowEjecucionPaso_ejecucionId_ocurridoEn_idx" ON "WorkflowEjecucionPaso"("ejecucionId", "ocurridoEn");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowEjecucionPaso_ejecucionId_nodoId_iteracion_key" ON "WorkflowEjecucionPaso"("ejecucionId", "nodoId", "iteracion");

-- AddForeignKey
ALTER TABLE "WorkflowEjecucion" ADD CONSTRAINT "WorkflowEjecucion_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEjecucion" ADD CONSTRAINT "WorkflowEjecucion_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "WorkflowVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEjecucion" ADD CONSTRAINT "WorkflowEjecucion_oportunidadId_fkey" FOREIGN KEY ("oportunidadId") REFERENCES "Oportunidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEjecucion" ADD CONSTRAINT "WorkflowEjecucion_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEjecucion" ADD CONSTRAINT "WorkflowEjecucion_ejecucionOrigenId_fkey" FOREIGN KEY ("ejecucionOrigenId") REFERENCES "WorkflowEjecucion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEjecucionPaso" ADD CONSTRAINT "WorkflowEjecucionPaso_ejecucionId_fkey" FOREIGN KEY ("ejecucionId") REFERENCES "WorkflowEjecucion"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Una sola ejecución activa que controle cada conversación a la vez (la que
-- envía mensajes). Las pausadas por un humano (TRANSFERIDA_HUMANO) no cuentan.
CREATE UNIQUE INDEX "WorkflowEjecucion_conv_control_uq"
  ON "WorkflowEjecucion" ("conversacionId")
  WHERE "controlaConversacion" = true
    AND "estado" IN ('EJECUTANDO', 'ESPERANDO_RESPUESTA', 'ESPERANDO_TIMER', 'ESPERANDO_ACCION_EXTERNA', 'IA_ACTIVA');
