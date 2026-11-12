-- CreateTable
CREATE TABLE "EtiquetaProducto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "EtiquetaProducto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoEtiqueta" (
    "productoId" TEXT NOT NULL,
    "etiquetaId" TEXT NOT NULL,

    CONSTRAINT "ProductoEtiqueta_pkey" PRIMARY KEY ("productoId","etiquetaId")
);

-- CreateIndex
CREATE UNIQUE INDEX "EtiquetaProducto_instanciaId_nombre_key" ON "EtiquetaProducto"("instanciaId", "nombre");

-- CreateIndex
CREATE INDEX "ProductoEtiqueta_etiquetaId_idx" ON "ProductoEtiqueta"("etiquetaId");

-- AddForeignKey
ALTER TABLE "EtiquetaProducto" ADD CONSTRAINT "EtiquetaProducto_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoEtiqueta" ADD CONSTRAINT "ProductoEtiqueta_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoEtiqueta" ADD CONSTRAINT "ProductoEtiqueta_etiquetaId_fkey" FOREIGN KEY ("etiquetaId") REFERENCES "EtiquetaProducto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
