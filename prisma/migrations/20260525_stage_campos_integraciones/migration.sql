-- CreateEnum
CREATE TYPE "EstadoIntegracion" AS ENUM ('INSTALADA', 'ACTIVA', 'INACTIVA', 'ERROR');

-- AlterTable: Add stageId to CampoPersonalizado
ALTER TABLE "CampoPersonalizado" ADD COLUMN "stageId" TEXT;

-- AlterTable: Add integraciones relation index (table created below)
-- (no column changes needed in Instancia)

-- AddForeignKey
ALTER TABLE "CampoPersonalizado" ADD CONSTRAINT "CampoPersonalizado_stageId_fkey"
  FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "CampoPersonalizado_stageId_idx" ON "CampoPersonalizado"("stageId");

-- CreateTable
CREATE TABLE "IntegracionInstancia" (
  "id"            TEXT NOT NULL,
  "clave"         TEXT NOT NULL,
  "estado"        "EstadoIntegracion" NOT NULL DEFAULT 'INSTALADA',
  "configuracion" JSONB,
  "metadata"      JSONB,
  "creadoEn"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3) NOT NULL,
  "instanciaId"   TEXT NOT NULL,

  CONSTRAINT "IntegracionInstancia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegracionInstancia_instanciaId_clave_key"
  ON "IntegracionInstancia"("instanciaId", "clave");

CREATE INDEX "IntegracionInstancia_instanciaId_idx" ON "IntegracionInstancia"("instanciaId");
CREATE INDEX "IntegracionInstancia_clave_idx" ON "IntegracionInstancia"("clave");

-- AddForeignKey
ALTER TABLE "IntegracionInstancia" ADD CONSTRAINT "IntegracionInstancia_instanciaId_fkey"
  FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add bloqueado to CampoPersonalizado
ALTER TABLE "CampoPersonalizado" ADD COLUMN "bloqueado" BOOLEAN NOT NULL DEFAULT false;
