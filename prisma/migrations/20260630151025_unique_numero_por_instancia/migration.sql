-- DropIndex
DROP INDEX "Cotizacion_numero_key";

-- DropIndex
DROP INDEX "Pedido_numero_key";

-- CreateIndex
CREATE UNIQUE INDEX "Cotizacion_instanciaId_numero_key" ON "Cotizacion"("instanciaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_instanciaId_numero_key" ON "Pedido"("instanciaId", "numero");
