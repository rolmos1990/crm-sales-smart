-- AddColumn permiteEditarPedido to FlujoVentaEtapa
ALTER TABLE "FlujoVentaEtapa" ADD COLUMN "permiteEditarPedido" BOOLEAN NOT NULL DEFAULT true;

-- Set false for existing final and cancellation stages
UPDATE "FlujoVentaEtapa"
SET "permiteEditarPedido" = false
WHERE "esFinal" = true OR "esCancelacion" = true;

-- CreateTable PedidoHistorial
CREATE TABLE "PedidoHistorial" (
    "id" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "valorAnterior" JSONB,
    "valorNuevo" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pedidoId" TEXT NOT NULL,
    "usuarioId" TEXT,

    CONSTRAINT "PedidoHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PedidoHistorial_pedidoId_idx" ON "PedidoHistorial"("pedidoId");

-- AddForeignKey
ALTER TABLE "PedidoHistorial" ADD CONSTRAINT "PedidoHistorial_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;
