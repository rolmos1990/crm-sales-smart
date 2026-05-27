-- CreateEnum
CREATE TYPE "EstadoMedia" AS ENUM ('PENDIENTE', 'PROCESANDO', 'LISTO', 'ERROR');

-- CreateTable
CREATE TABLE "MediaArchivo" (
    "id" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "entidadTipo" TEXT,
    "entidadId" TEXT,
    "nombreOriginal" TEXT NOT NULL,
    "mimeOriginal" TEXT NOT NULL,
    "pesoOriginal" INTEGER NOT NULL,
    "anchoOriginal" INTEGER,
    "altoOriginal" INTEGER,
    "mimeOptimizado" TEXT NOT NULL DEFAULT 'image/webp',
    "pesoOptimizado" INTEGER,
    "ancho" INTEGER,
    "alto" INTEGER,
    "keyOptimizado" TEXT NOT NULL,
    "keyThumbnail" TEXT,
    "keyOriginal" TEXT,
    "urlOptimizada" TEXT NOT NULL,
    "urlThumbnail" TEXT,
    "urlOriginal" TEXT,
    "hash" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL DEFAULT 'local',
    "canalOrigen" TEXT,
    "estadoProcesado" "EstadoMedia" NOT NULL DEFAULT 'LISTO',
    "errorMensaje" TEXT,
    "creadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaArchivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaArchivo_instanciaId_idx" ON "MediaArchivo"("instanciaId");

-- CreateIndex
CREATE INDEX "MediaArchivo_instanciaId_modulo_idx" ON "MediaArchivo"("instanciaId", "modulo");

-- CreateIndex
CREATE INDEX "MediaArchivo_entidadTipo_entidadId_idx" ON "MediaArchivo"("entidadTipo", "entidadId");

-- CreateIndex
CREATE INDEX "MediaArchivo_hash_idx" ON "MediaArchivo"("hash");

-- CreateIndex
CREATE INDEX "MediaArchivo_estadoProcesado_idx" ON "MediaArchivo"("estadoProcesado");

-- CreateIndex
CREATE UNIQUE INDEX "MediaArchivo_instanciaId_hash_key" ON "MediaArchivo"("instanciaId", "hash");

-- AddForeignKey
ALTER TABLE "MediaArchivo" ADD CONSTRAINT "MediaArchivo_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
