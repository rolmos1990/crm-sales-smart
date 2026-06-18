-- CreateEnum
CREATE TYPE "TipoJobEmail" AS ENUM ('BIENVENIDA', 'NOTIFICACION');

-- CreateEnum
CREATE TYPE "EstadoJobEmail" AS ENUM ('PENDIENTE', 'PROCESANDO', 'COMPLETADO', 'FALLIDO');

-- CreateTable
CREATE TABLE "JobEmail" (
    "id" TEXT NOT NULL,
    "tipo" "TipoJobEmail" NOT NULL,
    "estado" "EstadoJobEmail" NOT NULL DEFAULT 'PENDIENTE',
    "payload" JSONB NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "maxIntentos" INTEGER NOT NULL DEFAULT 3,
    "error" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "procesadoEn" TIMESTAMP(3),
    "instanciaId" TEXT,

    CONSTRAINT "JobEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobEmail_estado_creadoEn_idx" ON "JobEmail"("estado", "creadoEn");

-- CreateIndex
CREATE INDEX "JobEmail_instanciaId_idx" ON "JobEmail"("instanciaId");

-- AddForeignKey
ALTER TABLE "JobEmail" ADD CONSTRAINT "JobEmail_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
