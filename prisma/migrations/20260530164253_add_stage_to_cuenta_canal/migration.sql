-- AlterTable
ALTER TABLE "CuentaCanal" ADD COLUMN     "stageId" TEXT;

-- CreateIndex
CREATE INDEX "CuentaCanal_stageId_idx" ON "CuentaCanal"("stageId");

-- AddForeignKey
ALTER TABLE "CuentaCanal" ADD CONSTRAINT "CuentaCanal_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
