-- CreateEnum
CREATE TYPE "OrigenPlaybook" AS ENUM ('PLANTILLA', 'PERSONALIZADA');

-- CreateTable
CREATE TABLE "PlaybookEstrategia" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "origen" "OrigenPlaybook" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "contenido" JSONB NOT NULL,
    "condiciones" JSONB NOT NULL,
    "prioridad" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "PlaybookEstrategia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentePlaybookAsignacion" (
    "id" TEXT NOT NULL,
    "prioridadEfectiva" INTEGER,
    "condicionesOverride" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agenteIAConfigId" TEXT NOT NULL,
    "playbookEstrategiaId" TEXT NOT NULL,

    CONSTRAINT "AgentePlaybookAsignacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeleccionEstrategiaLog" (
    "id" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "tipoRelacionUsado" TEXT,
    "intencionUsada" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "instanciaId" TEXT NOT NULL,
    "agenteIAConfigId" TEXT NOT NULL,
    "conversacionId" TEXT,
    "playbookEstrategiaIdSeleccionado" TEXT,

    CONSTRAINT "SeleccionEstrategiaLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlaybookEstrategia_instanciaId_activo_idx" ON "PlaybookEstrategia"("instanciaId", "activo");

-- CreateIndex
CREATE INDEX "AgentePlaybookAsignacion_agenteIAConfigId_idx" ON "AgentePlaybookAsignacion"("agenteIAConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentePlaybookAsignacion_agenteIAConfigId_playbookEstrategi_key" ON "AgentePlaybookAsignacion"("agenteIAConfigId", "playbookEstrategiaId");

-- CreateIndex
CREATE INDEX "SeleccionEstrategiaLog_instanciaId_creadoEn_idx" ON "SeleccionEstrategiaLog"("instanciaId", "creadoEn");

-- CreateIndex
CREATE INDEX "SeleccionEstrategiaLog_agenteIAConfigId_idx" ON "SeleccionEstrategiaLog"("agenteIAConfigId");

-- AddForeignKey
ALTER TABLE "PlaybookEstrategia" ADD CONSTRAINT "PlaybookEstrategia_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentePlaybookAsignacion" ADD CONSTRAINT "AgentePlaybookAsignacion_agenteIAConfigId_fkey" FOREIGN KEY ("agenteIAConfigId") REFERENCES "AgenteIAConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentePlaybookAsignacion" ADD CONSTRAINT "AgentePlaybookAsignacion_playbookEstrategiaId_fkey" FOREIGN KEY ("playbookEstrategiaId") REFERENCES "PlaybookEstrategia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeleccionEstrategiaLog" ADD CONSTRAINT "SeleccionEstrategiaLog_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeleccionEstrategiaLog" ADD CONSTRAINT "SeleccionEstrategiaLog_agenteIAConfigId_fkey" FOREIGN KEY ("agenteIAConfigId") REFERENCES "AgenteIAConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeleccionEstrategiaLog" ADD CONSTRAINT "SeleccionEstrategiaLog_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
