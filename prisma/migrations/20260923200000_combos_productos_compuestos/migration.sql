-- 029-combos-productos-compuestos — aditiva. Productos existentes: esCombo=false,
-- ventaDirecta=true (mismo comportamiento). Líneas existentes: composicionCombo
-- NULL (consumen su propio producto, como siempre).

-- CreateEnum
CREATE TYPE "FiltroCatalogoVenta" AS ENUM ('TODOS', 'PRODUCTOS', 'COMBOS');

-- AlterTable
ALTER TABLE "ConfiguracionEmpresa" ADD COLUMN     "filtroProductosPedido" "FiltroCatalogoVenta" NOT NULL DEFAULT 'TODOS';

-- AlterTable
ALTER TABLE "PedidoLinea" ADD COLUMN     "composicionCombo" JSONB;

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "esCombo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ventaDirecta" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ProductoComponente" (
    "id" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "comboId" TEXT NOT NULL,
    "componenteId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductoComponente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductoComponente_componenteId_idx" ON "ProductoComponente"("componenteId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductoComponente_comboId_componenteId_key" ON "ProductoComponente"("comboId", "componenteId");

-- AddForeignKey
ALTER TABLE "ProductoComponente" ADD CONSTRAINT "ProductoComponente_comboId_fkey" FOREIGN KEY ("comboId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoComponente" ADD CONSTRAINT "ProductoComponente_componenteId_fkey" FOREIGN KEY ("componenteId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

