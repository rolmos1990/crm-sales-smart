-- AlterTable
ALTER TABLE "CuentaCanal" ADD COLUMN     "stageIdRespuestaAutomatica" TEXT;

-- AddForeignKey
ALTER TABLE "CuentaCanal" ADD CONSTRAINT "CuentaCanal_stageIdRespuestaAutomatica_fkey" FOREIGN KEY ("stageIdRespuestaAutomatica") REFERENCES "PipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
