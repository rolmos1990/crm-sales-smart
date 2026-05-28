-- CreateEnum
CREATE TYPE "TipoJobMensaje" AS ENUM ('ENVIAR_MENSAJE', 'PROCESAR_ENTRANTE');

-- CreateEnum
CREATE TYPE "EstadoJobMensaje" AS ENUM ('PENDIENTE', 'PROCESANDO', 'COMPLETADO', 'FALLIDO');

-- CreateTable
CREATE TABLE "JobMensaje" (
    "id" TEXT NOT NULL,
    "tipo" "TipoJobMensaje" NOT NULL,
    "estado" "EstadoJobMensaje" NOT NULL DEFAULT 'PENDIENTE',
    "payload" JSONB NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "maxIntentos" INTEGER NOT NULL DEFAULT 3,
    "error" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "procesadoEn" TIMESTAMP(3),
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "JobMensaje_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobMensaje_estado_creadoEn_idx" ON "JobMensaje"("estado", "creadoEn");

-- CreateIndex
CREATE INDEX "JobMensaje_instanciaId_idx" ON "JobMensaje"("instanciaId");

-- AddForeignKey
ALTER TABLE "JobMensaje" ADD CONSTRAINT "JobMensaje_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
