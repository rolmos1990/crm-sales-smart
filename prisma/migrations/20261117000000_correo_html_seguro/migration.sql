-- 035-correo-html-seguro — migración aditiva.
--
-- Solo crea una tabla y un enum nuevos: ninguna tabla existente cambia y no
-- hay backfill (los correos previos a 035 no tienen HTML guardado y se siguen
-- viendo en texto). Diff generado con `prisma migrate diff` y revisado: sin DROP.
--
-- Reversión: DROP TABLE "MensajeCorreo"; DROP TYPE "EstadoHtmlCorreo";
-- No se pierde nada del resto del sistema: el texto de cada correo sigue en
-- MensajeConversacion.contenido.

-- CreateEnum
CREATE TYPE "EstadoHtmlCorreo" AS ENUM ('SIN_HTML', 'DISPONIBLE', 'NO_DISPONIBLE');

-- CreateTable
CREATE TABLE "MensajeCorreo" (
    "id" TEXT NOT NULL,
    "mensajeId" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,
    "estadoHtml" "EstadoHtmlCorreo" NOT NULL DEFAULT 'SIN_HTML',
    "motivoHtml" TEXT,
    "htmlLimpio" TEXT,
    "versionPolitica" INTEGER NOT NULL DEFAULT 1,
    "tieneImagenesExternas" BOOLEAN NOT NULL DEFAULT false,
    "imagenesExternas" JSONB NOT NULL DEFAULT '[]',
    "adjuntos" JSONB NOT NULL DEFAULT '[]',
    "de" JSONB,
    "para" JSONB NOT NULL DEFAULT '[]',
    "paraTotal" INTEGER NOT NULL DEFAULT 0,
    "cc" JSONB NOT NULL DEFAULT '[]',
    "ccTotal" INTEGER NOT NULL DEFAULT 0,
    "asunto" TEXT,
    "fechaEnvio" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MensajeCorreo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MensajeCorreo_mensajeId_key" ON "MensajeCorreo"("mensajeId");

-- CreateIndex
CREATE INDEX "MensajeCorreo_instanciaId_idx" ON "MensajeCorreo"("instanciaId");

-- AddForeignKey
ALTER TABLE "MensajeCorreo" ADD CONSTRAINT "MensajeCorreo_mensajeId_fkey" FOREIGN KEY ("mensajeId") REFERENCES "MensajeConversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensajeCorreo" ADD CONSTRAINT "MensajeCorreo_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

