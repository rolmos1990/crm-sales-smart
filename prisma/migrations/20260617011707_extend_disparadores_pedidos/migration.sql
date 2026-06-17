-- AlterTable
ALTER TABLE "Disparador" ADD COLUMN     "flujoVentaEtapaId" TEXT,
ADD COLUMN     "flujoVentaId" TEXT,
ALTER COLUMN "stageId" DROP NOT NULL,
ALTER COLUMN "pipelineId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "DisparadorJob" ADD COLUMN     "flujoVentaEtapaId" TEXT,
ADD COLUMN     "flujoVentaId" TEXT,
ADD COLUMN     "pedidoId" TEXT,
ALTER COLUMN "oportunidadId" DROP NOT NULL,
ALTER COLUMN "stageId" DROP NOT NULL,
ALTER COLUMN "pipelineId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Disparador_flujoVentaEtapaId_activo_idx" ON "Disparador"("flujoVentaEtapaId", "activo");

-- CreateIndex
CREATE INDEX "Disparador_flujoVentaId_idx" ON "Disparador"("flujoVentaId");

-- CreateIndex
CREATE INDEX "DisparadorJob_pedidoId_flujoVentaEtapaId_idx" ON "DisparadorJob"("pedidoId", "flujoVentaEtapaId");

-- AddForeignKey
ALTER TABLE "Disparador" ADD CONSTRAINT "Disparador_flujoVentaEtapaId_fkey" FOREIGN KEY ("flujoVentaEtapaId") REFERENCES "FlujoVentaEtapa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disparador" ADD CONSTRAINT "Disparador_flujoVentaId_fkey" FOREIGN KEY ("flujoVentaId") REFERENCES "FlujoVenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisparadorJob" ADD CONSTRAINT "DisparadorJob_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;
