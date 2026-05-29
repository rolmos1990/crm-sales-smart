-- AlterTable
ALTER TABLE "Oportunidad" ADD COLUMN     "nuevoMensaje" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ultimaInteraccionEn" TIMESTAMP(3);
