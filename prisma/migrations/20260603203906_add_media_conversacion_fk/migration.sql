-- AlterTable
ALTER TABLE "MediaArchivo" ADD COLUMN     "contactoId" TEXT;

-- AlterTable
ALTER TABLE "MensajeConversacion" ADD COLUMN     "mediaArchivoId" TEXT;

-- CreateIndex
CREATE INDEX "MediaArchivo_contactoId_idx" ON "MediaArchivo"("contactoId");

-- AddForeignKey
ALTER TABLE "MediaArchivo" ADD CONSTRAINT "MediaArchivo_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "Contacto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensajeConversacion" ADD CONSTRAINT "MensajeConversacion_mediaArchivoId_fkey" FOREIGN KEY ("mediaArchivoId") REFERENCES "MediaArchivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
