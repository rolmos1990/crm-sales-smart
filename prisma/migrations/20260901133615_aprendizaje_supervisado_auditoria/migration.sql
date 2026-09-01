-- AlterTable
ALTER TABLE "RespuestaPendienteRevision" ADD COLUMN     "confianza" DOUBLE PRECISION,
ADD COLUMN     "ejemplosUtilizadosIds" JSONB,
ADD COLUMN     "estrategiaUtilizadaId" TEXT,
ADD COLUMN     "herramientasEjecutadas" JSONB,
ADD COLUMN     "motivoTransferencia" TEXT,
ADD COLUMN     "productoIdentificadoId" TEXT,
ADD COLUMN     "usoIAId" TEXT;

-- CreateTable
CREATE TABLE "EvaluacionRespuestaIA" (
    "id" TEXT NOT NULL,
    "calificacion" TEXT NOT NULL,
    "comentario" TEXT,
    "evaluadoPorUsuarioId" TEXT,
    "evaluadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "instanciaId" TEXT NOT NULL,
    "respuestaId" TEXT NOT NULL,

    CONSTRAINT "EvaluacionRespuestaIA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvaluacionRespuestaIA_instanciaId_idx" ON "EvaluacionRespuestaIA"("instanciaId");

-- CreateIndex
CREATE INDEX "EvaluacionRespuestaIA_respuestaId_idx" ON "EvaluacionRespuestaIA"("respuestaId");

-- AddForeignKey
ALTER TABLE "RespuestaPendienteRevision" ADD CONSTRAINT "RespuestaPendienteRevision_productoIdentificadoId_fkey" FOREIGN KEY ("productoIdentificadoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RespuestaPendienteRevision" ADD CONSTRAINT "RespuestaPendienteRevision_usoIAId_fkey" FOREIGN KEY ("usoIAId") REFERENCES "UsoIA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluacionRespuestaIA" ADD CONSTRAINT "EvaluacionRespuestaIA_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluacionRespuestaIA" ADD CONSTRAINT "EvaluacionRespuestaIA_respuestaId_fkey" FOREIGN KEY ("respuestaId") REFERENCES "RespuestaPendienteRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
