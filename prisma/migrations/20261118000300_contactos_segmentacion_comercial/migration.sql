-- CreateEnum
CREATE TYPE "NivelInteres" AS ENUM ('ALTO', 'MEDIO', 'BAJO', 'SIN_EVALUAR');

-- CreateEnum
CREATE TYPE "OrigenClasificacion" AS ENUM ('MANUAL', 'REGLA', 'IA');

-- CreateEnum
CREATE TYPE "DimensionClasificacion" AS ENUM ('INTERES', 'PREFERENCIA_CONTACTO');

-- DropIndex
DROP INDEX "ContactoIdentificadorCanal_contactoId_idx";

-- AlterTable
ALTER TABLE "Contacto" ADD COLUMN     "esperandoRespuestaDesde" TIMESTAMP(3),
ADD COLUMN     "nivelInteres" "NivelInteres" NOT NULL DEFAULT 'SIN_EVALUAR',
ADD COLUMN     "nivelInteresActualizadoEn" TIMESTAMP(3),
ADD COLUMN     "nivelInteresFijado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nivelInteresOrigen" "OrigenClasificacion",
ADD COLUMN     "noContactarDesde" TIMESTAMP(3),
ADD COLUMN     "noContactarOrigen" "OrigenClasificacion",
ADD COLUMN     "noContactarPorId" TEXT,
ADD COLUMN     "ultimaInteraccionEn" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ConfiguracionEmpresa" ADD COLUMN     "diasSeguimientoInactivo" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "diasSeguimientoPendiente" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "diasSeguimientoRecuperar" INTEGER NOT NULL DEFAULT 7;

-- CreateTable
CREATE TABLE "ContactoClasificacionHistorial" (
    "id" TEXT NOT NULL,
    "dimension" "DimensionClasificacion" NOT NULL,
    "valorAnterior" TEXT,
    "valorNuevo" TEXT NOT NULL,
    "fijado" BOOLEAN NOT NULL DEFAULT false,
    "origen" "OrigenClasificacion" NOT NULL,
    "usuarioInstanciaId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactoId" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "ContactoClasificacionHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactoClasificacionHistorial_contactoId_creadoEn_idx" ON "ContactoClasificacionHistorial"("contactoId", "creadoEn");

-- CreateIndex
CREATE INDEX "ContactoClasificacionHistorial_instanciaId_idx" ON "ContactoClasificacionHistorial"("instanciaId");

-- CreateIndex
CREATE INDEX "Contacto_instanciaId_ultimaInteraccionEn_idx" ON "Contacto"("instanciaId", "ultimaInteraccionEn");

-- CreateIndex
CREATE INDEX "Contacto_instanciaId_nivelInteres_idx" ON "Contacto"("instanciaId", "nivelInteres");

-- CreateIndex
CREATE INDEX "Contacto_instanciaId_esperandoRespuestaDesde_idx" ON "Contacto"("instanciaId", "esperandoRespuestaDesde");

-- CreateIndex
CREATE INDEX "Contacto_instanciaId_noContactarDesde_idx" ON "Contacto"("instanciaId", "noContactarDesde");

-- CreateIndex
CREATE INDEX "OportunidadContacto_contactoId_idx" ON "OportunidadContacto"("contactoId");

-- CreateIndex
CREATE INDEX "Actividad_contactoId_completada_fecha_idx" ON "Actividad"("contactoId", "completada", "fecha");

-- CreateIndex
CREATE INDEX "Cotizacion_contactoId_idx" ON "Cotizacion"("contactoId");

-- CreateIndex
CREATE INDEX "Pedido_contactoId_idx" ON "Pedido"("contactoId");

-- CreateIndex
CREATE INDEX "ContactoIdentificadorCanal_contactoId_canal_idx" ON "ContactoIdentificadorCanal"("contactoId", "canal");

-- AddForeignKey
ALTER TABLE "ContactoClasificacionHistorial" ADD CONSTRAINT "ContactoClasificacionHistorial_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "Contacto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactoClasificacionHistorial" ADD CONSTRAINT "ContactoClasificacionHistorial_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

