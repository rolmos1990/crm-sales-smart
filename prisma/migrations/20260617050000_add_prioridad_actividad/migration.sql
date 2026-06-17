-- CreateEnum
CREATE TYPE "PrioridadActividad" AS ENUM ('ALTA', 'MEDIA', 'BAJA');

-- AlterTable
ALTER TABLE "Actividad" ADD COLUMN "prioridad" "PrioridadActividad" NOT NULL DEFAULT 'MEDIA';
ALTER TABLE "Actividad" ADD COLUMN "pedidoId" TEXT;
ALTER TABLE "Actividad" ADD COLUMN "cotizacionId" TEXT;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Actividad_pedidoId_idx" ON "Actividad"("pedidoId");
CREATE INDEX "Actividad_cotizacionId_idx" ON "Actividad"("cotizacionId");
