-- CreateEnum
CREATE TYPE "ClasificacionConversacion" AS ENUM ('NINGUNA', 'POSTVENTA', 'SOPORTE', 'COMERCIAL');

-- AlterTable
ALTER TABLE "Conversacion" ADD COLUMN     "clasificacion" "ClasificacionConversacion" NOT NULL DEFAULT 'NINGUNA',
ADD COLUMN     "clasificadoEn" TIMESTAMP(3),
ADD COLUMN     "clasificadoPorId" TEXT,
ADD COLUMN     "oportunidadGanadaRelId" TEXT;

-- CreateIndex
CREATE INDEX "Conversacion_clasificacion_idx" ON "Conversacion"("clasificacion");

-- AddForeignKey
ALTER TABLE "Conversacion" ADD CONSTRAINT "Conversacion_oportunidadGanadaRelId_fkey" FOREIGN KEY ("oportunidadGanadaRelId") REFERENCES "Oportunidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;
