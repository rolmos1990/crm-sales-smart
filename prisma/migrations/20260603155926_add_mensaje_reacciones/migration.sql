-- CreateEnum
CREATE TYPE "TipoReaccion" AS ENUM ('CANAL', 'INTERNA');

-- CreateTable
CREATE TABLE "MensajeReaccion" (
    "id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "tipo" "TipoReaccion" NOT NULL DEFAULT 'INTERNA',
    "nombreUsuario" TEXT,
    "canal" TEXT,
    "idExterno" TEXT,
    "mensajeId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "contactoId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MensajeReaccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MensajeReaccion_mensajeId_idx" ON "MensajeReaccion"("mensajeId");

-- CreateIndex
CREATE UNIQUE INDEX "MensajeReaccion_mensajeId_usuarioId_emoji_key" ON "MensajeReaccion"("mensajeId", "usuarioId", "emoji");

-- CreateIndex
CREATE UNIQUE INDEX "MensajeReaccion_mensajeId_contactoId_emoji_key" ON "MensajeReaccion"("mensajeId", "contactoId", "emoji");

-- AddForeignKey
ALTER TABLE "MensajeReaccion" ADD CONSTRAINT "MensajeReaccion_mensajeId_fkey" FOREIGN KEY ("mensajeId") REFERENCES "MensajeConversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
