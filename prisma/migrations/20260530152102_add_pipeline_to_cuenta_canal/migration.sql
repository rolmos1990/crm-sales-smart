-- AlterTable
ALTER TABLE "CuentaCanal" ADD COLUMN     "pipelineId" TEXT;

-- AddForeignKey
ALTER TABLE "CuentaCanal" ADD CONSTRAINT "CuentaCanal_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;
