-- CreateEnum
CREATE TYPE "TipoJobSistema" AS ENUM ('INICIALIZAR_INSTANCIA');

-- CreateEnum
CREATE TYPE "EstadoJobSistema" AS ENUM ('PENDIENTE', 'PROCESANDO', 'COMPLETADO', 'FALLIDO');

-- CreateTable
CREATE TABLE "JobSistema" (
    "id" TEXT NOT NULL,
    "tipo" "TipoJobSistema" NOT NULL,
    "estado" "EstadoJobSistema" NOT NULL DEFAULT 'PENDIENTE',
    "payload" JSONB NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "maxIntentos" INTEGER NOT NULL DEFAULT 3,
    "error" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "procesadoEn" TIMESTAMP(3),
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "JobSistema_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobSistema_estado_creadoEn_idx" ON "JobSistema"("estado", "creadoEn");

-- CreateIndex
CREATE INDEX "JobSistema_instanciaId_idx" ON "JobSistema"("instanciaId");

-- AddForeignKey
ALTER TABLE "JobSistema" ADD CONSTRAINT "JobSistema_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
