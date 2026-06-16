-- DropIndex
DROP INDEX "FlujoVentaEtapa_flujoVentaId_orden_key";

-- AlterTable
ALTER TABLE "FlujoVentaEtapa" ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "FlujoVentaEtapa_flujoVentaId_orden_idx" ON "FlujoVentaEtapa"("flujoVentaId", "orden");

-- CreateIndex
CREATE INDEX "FlujoVentaEtapa_parentId_idx" ON "FlujoVentaEtapa"("parentId");

-- AddForeignKey
ALTER TABLE "FlujoVentaEtapa" ADD CONSTRAINT "FlujoVentaEtapa_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FlujoVentaEtapa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
