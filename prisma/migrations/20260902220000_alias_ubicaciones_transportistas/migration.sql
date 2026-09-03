-- 024-alias-ubicaciones-transportistas
-- Columnas nullable (research.md Decisión 3, mismo patrón de transición
-- segura que Transportista.paisId en 023): se backfillean con
-- scripts/backfill-normalizar-ubicaciones.ts y se endurecen a NOT NULL en
-- una migración de seguimiento una vez confirmado el backfill en producción.

-- CreateEnum
CREATE TYPE "CampoUbicacion" AS ENUM ('PROVINCIA_ESTADO', 'DISTRITO_CIUDAD', 'CORREGIMIENTO', 'SECTOR_O_CODIGO_POSTAL');

-- AlterTable
ALTER TABLE "ZonaEntregaUbicacion" ADD COLUMN     "nombreNormalizado" TEXT,
ADD COLUMN     "nombreVisible" TEXT;

-- CreateTable
CREATE TABLE "AliasUbicacion" (
    "id" TEXT NOT NULL,
    "zonaEntregaUbicacionId" TEXT NOT NULL,
    "campo" "CampoUbicacion" NOT NULL,
    "valor" TEXT NOT NULL,
    "valorNormalizado" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AliasUbicacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ZonaEntregaUbicacion_nombreNormalizado_idx" ON "ZonaEntregaUbicacion"("nombreNormalizado");

-- CreateIndex
CREATE INDEX "AliasUbicacion_zonaEntregaUbicacionId_idx" ON "AliasUbicacion"("zonaEntregaUbicacionId");

-- CreateIndex
CREATE INDEX "AliasUbicacion_instanciaId_valorNormalizado_idx" ON "AliasUbicacion"("instanciaId", "valorNormalizado");

-- CreateIndex
CREATE UNIQUE INDEX "AliasUbicacion_instanciaId_campo_valorNormalizado_key" ON "AliasUbicacion"("instanciaId", "campo", "valorNormalizado");

-- AddForeignKey
ALTER TABLE "AliasUbicacion" ADD CONSTRAINT "AliasUbicacion_zonaEntregaUbicacionId_fkey" FOREIGN KEY ("zonaEntregaUbicacionId") REFERENCES "ZonaEntregaUbicacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AliasUbicacion" ADD CONSTRAINT "AliasUbicacion_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
