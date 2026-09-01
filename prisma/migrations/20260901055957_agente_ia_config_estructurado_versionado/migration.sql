-- CreateEnum
CREATE TYPE "EstadoVersionAgenteIA" AS ENUM ('BORRADOR', 'PUBLICADA');

-- AlterTable
ALTER TABLE "AgenteIAConfig" ADD COLUMN     "comportamientosProhibidos" JSONB,
ADD COLUMN     "condicionesTransferenciaHumano" JSONB,
ADD COLUMN     "estiloRecomendacion" TEXT,
ADD COLUMN     "frasesPreferidas" JSONB,
ADD COLUMN     "frasesProhibidas" JSONB,
ADD COLUMN     "idiomaPrincipal" TEXT,
ADD COLUMN     "idiomasPermitidos" JSONB,
ADD COLUMN     "intensidadComercial" TEXT,
ADD COLUMN     "longitudRespuesta" TEXT,
ADD COLUMN     "nombreAgente" TEXT,
ADD COLUMN     "proactividad" TEXT,
ADD COLUMN     "reglasPersonalizadas" JSONB,
ADD COLUMN     "rol" TEXT;

-- AlterTable
ALTER TABLE "UsoIA" ADD COLUMN     "agenteIAConfigVersionId" TEXT;

-- CreateTable
CREATE TABLE "AgenteIAConfigVersion" (
    "id" TEXT NOT NULL,
    "numero" INTEGER,
    "estado" "EstadoVersionAgenteIA" NOT NULL,
    "contenido" JSONB NOT NULL,
    "publicadaEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "agenteIAConfigId" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,
    "creadaPorUsuarioId" TEXT,

    CONSTRAINT "AgenteIAConfigVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgenteIAConfigVersion_agenteIAConfigId_estado_idx" ON "AgenteIAConfigVersion"("agenteIAConfigId", "estado");

-- CreateIndex
CREATE INDEX "AgenteIAConfigVersion_instanciaId_idx" ON "AgenteIAConfigVersion"("instanciaId");

-- CreateIndex
CREATE UNIQUE INDEX "AgenteIAConfigVersion_agenteIAConfigId_numero_key" ON "AgenteIAConfigVersion"("agenteIAConfigId", "numero");

-- CreateIndex
CREATE INDEX "UsoIA_agenteIAConfigVersionId_idx" ON "UsoIA"("agenteIAConfigVersionId");

-- AddForeignKey
ALTER TABLE "AgenteIAConfigVersion" ADD CONSTRAINT "AgenteIAConfigVersion_agenteIAConfigId_fkey" FOREIGN KEY ("agenteIAConfigId") REFERENCES "AgenteIAConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgenteIAConfigVersion" ADD CONSTRAINT "AgenteIAConfigVersion_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgenteIAConfigVersion" ADD CONSTRAINT "AgenteIAConfigVersion_creadaPorUsuarioId_fkey" FOREIGN KEY ("creadaPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsoIA" ADD CONSTRAINT "UsoIA_agenteIAConfigVersionId_fkey" FOREIGN KEY ("agenteIAConfigVersionId") REFERENCES "AgenteIAConfigVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
