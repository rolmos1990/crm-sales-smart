-- Workflows (A1) — tablas base del editor. Aditiva: no toca datos existentes;
-- workflowsHabilitado=false para todas las empresas (comportamiento actual).

-- CreateEnum
CREATE TYPE "EstadoWorkflow" AS ENUM ('BORRADOR', 'PUBLICADO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "TipoDisparadorWorkflow" AS ENUM ('ENTRADA_ETAPA', 'MENSAJE_RECIBIDO', 'CONVERSACION_CREADA', 'OPORTUNIDAD_CREADA', 'PEDIDO_CREADO', 'MANUAL');

-- AlterTable
ALTER TABLE "ConfiguracionEmpresa" ADD COLUMN     "workflowsHabilitado" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" "EstadoWorkflow" NOT NULL DEFAULT 'BORRADOR',
    "borrador" JSONB NOT NULL,
    "configuracion" JSONB,
    "versionPublicadaId" TEXT,
    "creadoPorId" TEXT,
    "actualizadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowVersion" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "definicion" JSONB NOT NULL,
    "publicadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicadaPorId" TEXT,
    "workflowId" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "WorkflowVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowAsignacion" (
    "id" TEXT NOT NULL,
    "disparador" "TipoDisparadorWorkflow" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "filtros" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workflowId" TEXT NOT NULL,
    "pipelineId" TEXT,
    "stageId" TEXT,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "WorkflowAsignacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_versionPublicadaId_key" ON "Workflow"("versionPublicadaId");

-- CreateIndex
CREATE INDEX "Workflow_instanciaId_estado_idx" ON "Workflow"("instanciaId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_instanciaId_nombre_key" ON "Workflow"("instanciaId", "nombre");

-- CreateIndex
CREATE INDEX "WorkflowVersion_instanciaId_idx" ON "WorkflowVersion"("instanciaId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowVersion_workflowId_numero_key" ON "WorkflowVersion"("workflowId", "numero");

-- CreateIndex
CREATE INDEX "WorkflowAsignacion_instanciaId_disparador_activo_idx" ON "WorkflowAsignacion"("instanciaId", "disparador", "activo");

-- CreateIndex
CREATE INDEX "WorkflowAsignacion_workflowId_idx" ON "WorkflowAsignacion"("workflowId");

-- CreateIndex
CREATE INDEX "WorkflowAsignacion_stageId_idx" ON "WorkflowAsignacion"("stageId");

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_versionPublicadaId_fkey" FOREIGN KEY ("versionPublicadaId") REFERENCES "WorkflowVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowVersion" ADD CONSTRAINT "WorkflowVersion_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowAsignacion" ADD CONSTRAINT "WorkflowAsignacion_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowAsignacion" ADD CONSTRAINT "WorkflowAsignacion_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowAsignacion" ADD CONSTRAINT "WorkflowAsignacion_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowAsignacion" ADD CONSTRAINT "WorkflowAsignacion_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Prisma no expresa índices parciales: una sola asignación activa de tipo
-- ENTRADA_ETAPA por etapa.
CREATE UNIQUE INDEX "WorkflowAsignacion_stage_activa_uq"
  ON "WorkflowAsignacion" ("stageId")
  WHERE "activo" = true AND "disparador" = 'ENTRADA_ETAPA';
