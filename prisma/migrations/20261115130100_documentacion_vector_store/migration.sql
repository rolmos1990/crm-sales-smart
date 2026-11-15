-- 033-documentacion-vector-store-openai
--
-- Los documentos que el negocio sube para su agente dejan de resumirse con IA
-- e inyectarse en cada prompt, y pasan a indexarse integros en un vector store
-- de OpenAI, consultables bajo demanda.
--
-- Un vector store POR INSTANCIA (Instancia.vectorStoreDocumentacionId): el
-- indice de un comercio no contiene bytes de otro, y el techo de 10.000
-- archivos por store pasa a ser por cuenta en vez de para toda la plataforma.
-- El store se crea solo la primera vez que la cuenta sube un documento.
--
-- Migracion 100% aditiva. En particular NO se toca AgenteIAConfig."documentosFaq":
-- queda deprecada pero intacta, porque es lo unico que le permite a una cuenta
-- ver que tenia cargado con el mecanismo anterior ("Requiere resubir").
-- Rollback: DROP TABLE "DocumentoAgenteIA"; DROP TYPE "EstadoDocumentoAgenteIA";

-- CreateEnum
CREATE TYPE "EstadoDocumentoAgenteIA" AS ENUM ('INDEXANDO', 'LISTO', 'ERROR');

-- CreateTable
CREATE TABLE "DocumentoAgenteIA" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "pesoBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "openaiFileId" TEXT,
    "vectorStoreFileId" TEXT,
    "vectorStoreId" TEXT,
    "estado" "EstadoDocumentoAgenteIA" NOT NULL DEFAULT 'INDEXANDO',
    "errorIndexacion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "agenteIAConfigId" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "DocumentoAgenteIA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentoAgenteIA_agenteIAConfigId_estado_idx" ON "DocumentoAgenteIA"("agenteIAConfigId", "estado");

-- CreateIndex
CREATE INDEX "DocumentoAgenteIA_instanciaId_idx" ON "DocumentoAgenteIA"("instanciaId");

-- AddForeignKey
ALTER TABLE "DocumentoAgenteIA" ADD CONSTRAINT "DocumentoAgenteIA_agenteIAConfigId_fkey" FOREIGN KEY ("agenteIAConfigId") REFERENCES "AgenteIAConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoAgenteIA" ADD CONSTRAINT "DocumentoAgenteIA_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
-- Null hasta que la cuenta suba su primer documento. Aditiva y sin default:
-- ninguna fila existente cambia de comportamiento.
ALTER TABLE "Instancia" ADD COLUMN "vectorStoreDocumentacionId" TEXT;
