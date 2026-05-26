-- CreateEnum
CREATE TYPE "TipoAccionDisparador" AS ENUM ('CREAR_TAREA', 'CREAR_NOTA', 'WEBHOOK', 'ASIGNAR_USUARIO');

-- CreateEnum
CREATE TYPE "EstadoDisparadorJob" AS ENUM ('PENDIENTE', 'PROCESANDO', 'COMPLETADO', 'CANCELADO', 'FALLIDO');

-- CreateTable
CREATE TABLE "Disparador" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "delayMinutos" INTEGER,
    "tipo" "TipoAccionDisparador" NOT NULL,
    "config" JSONB NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "stageId" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,

    CONSTRAINT "Disparador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisparadorJob" (
    "id" TEXT NOT NULL,
    "estado" "EstadoDisparadorJob" NOT NULL DEFAULT 'PENDIENTE',
    "ejecutarEn" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "resultado" JSONB,
    "error" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "procesadoEn" TIMESTAMP(3),
    "disparadorId" TEXT NOT NULL,
    "oportunidadId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,

    CONSTRAINT "DisparadorJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Disparador_stageId_idx" ON "Disparador"("stageId");

-- CreateIndex
CREATE INDEX "Disparador_pipelineId_idx" ON "Disparador"("pipelineId");

-- CreateIndex
CREATE INDEX "DisparadorJob_estado_ejecutarEn_idx" ON "DisparadorJob"("estado", "ejecutarEn");

-- CreateIndex
CREATE INDEX "DisparadorJob_oportunidadId_stageId_idx" ON "DisparadorJob"("oportunidadId", "stageId");

-- CreateIndex
CREATE INDEX "DisparadorJob_disparadorId_idx" ON "DisparadorJob"("disparadorId");

-- AddForeignKey
ALTER TABLE "Disparador" ADD CONSTRAINT "Disparador_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disparador" ADD CONSTRAINT "Disparador_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisparadorJob" ADD CONSTRAINT "DisparadorJob_disparadorId_fkey" FOREIGN KEY ("disparadorId") REFERENCES "Disparador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisparadorJob" ADD CONSTRAINT "DisparadorJob_oportunidadId_fkey" FOREIGN KEY ("oportunidadId") REFERENCES "Oportunidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
