-- 030-variantes-producto — aditiva. Productos existentes: tieneVariantes=false
-- (mismo precio, SKU y stock). Líneas existentes: varianteId NULL.

-- AlterTable
ALTER TABLE "CotizacionLinea" ADD COLUMN     "varianteId" TEXT,
ADD COLUMN     "varianteNombre" TEXT;

-- AlterTable
ALTER TABLE "PedidoLinea" ADD COLUMN     "varianteId" TEXT,
ADD COLUMN     "varianteNombre" TEXT;

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "atributosVariantes" JSONB,
ADD COLUMN     "tieneVariantes" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProductoVariante" (
    "id" TEXT NOT NULL,
    "valores" JSONB NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "sku" TEXT,
    "precio" DECIMAL(65,30),
    "cantidadDisponible" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "productoId" TEXT NOT NULL,

    CONSTRAINT "ProductoVariante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductoVariante_productoId_idx" ON "ProductoVariante"("productoId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductoVariante_productoId_clave_key" ON "ProductoVariante"("productoId", "clave");

-- AddForeignKey
ALTER TABLE "ProductoVariante" ADD CONSTRAINT "ProductoVariante_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionLinea" ADD CONSTRAINT "CotizacionLinea_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "ProductoVariante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoLinea" ADD CONSTRAINT "PedidoLinea_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "ProductoVariante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

