-- CreateEnum
CREATE TYPE "ModoCoberturaDelivery" AS ENUM ('TODOS_LADOS_CON_EXCEPCIONES', 'SOLO_ZONAS_EVALUADAS');

-- CreateEnum
CREATE TYPE "ModoGeografico" AS ENUM ('UN_SOLO_PAIS', 'MULTIPAIS');

-- AlterTable
ALTER TABLE "ConfiguracionEmpresa" ADD COLUMN     "modoGeografico" "ModoGeografico" NOT NULL DEFAULT 'MULTIPAIS',
ADD COLUMN     "paisOperacionId" TEXT;

-- AlterTable
ALTER TABLE "EntregaCotizacion" ADD COLUMN     "ciudad" TEXT,
ADD COLUMN     "estadoProvinciaId" TEXT,
ADD COLUMN     "paisId" TEXT;

-- AlterTable
ALTER TABLE "EntregaPedido" ADD COLUMN     "ciudad" TEXT,
ADD COLUMN     "estadoProvinciaId" TEXT,
ADD COLUMN     "paisId" TEXT;

-- AlterTable
ALTER TABLE "MetodoEntregaConfig" ADD COLUMN     "modoCobertura" "ModoCoberturaDelivery" NOT NULL DEFAULT 'SOLO_ZONAS_EVALUADAS';

-- AlterTable
ALTER TABLE "ZonaCoberturaMetodo" ADD COLUMN     "esExcepcion" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Pais" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "codigoAlpha3" TEXT,
    "nombre" TEXT NOT NULL,
    "indicativoTelefonico" TEXT,
    "banderaEmoji" TEXT,

    CONSTRAINT "Pais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstadoProvincia" (
    "id" TEXT NOT NULL,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "paisId" TEXT NOT NULL,

    CONSTRAINT "EstadoProvincia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportistaCoberturaGeografica" (
    "id" TEXT NOT NULL,
    "costoEnvio" DECIMAL(65,30) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "transportistaId" TEXT NOT NULL,
    "paisId" TEXT NOT NULL,
    "estadoProvinciaId" TEXT NOT NULL,

    CONSTRAINT "TransportistaCoberturaGeografica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pais_codigo_key" ON "Pais"("codigo");

-- CreateIndex
CREATE INDEX "Pais_nombre_idx" ON "Pais"("nombre");

-- CreateIndex
CREATE INDEX "EstadoProvincia_paisId_idx" ON "EstadoProvincia"("paisId");

-- CreateIndex
CREATE UNIQUE INDEX "EstadoProvincia_paisId_nombre_key" ON "EstadoProvincia"("paisId", "nombre");

-- CreateIndex
CREATE INDEX "TransportistaCoberturaGeografica_transportistaId_idx" ON "TransportistaCoberturaGeografica"("transportistaId");

-- CreateIndex
CREATE UNIQUE INDEX "TransportistaCoberturaGeografica_transportistaId_estadoProv_key" ON "TransportistaCoberturaGeografica"("transportistaId", "estadoProvinciaId");

-- CreateIndex
CREATE INDEX "EntregaCotizacion_estadoProvinciaId_idx" ON "EntregaCotizacion"("estadoProvinciaId");

-- CreateIndex
CREATE INDEX "EntregaPedido_estadoProvinciaId_idx" ON "EntregaPedido"("estadoProvinciaId");

-- AddForeignKey
ALTER TABLE "EntregaCotizacion" ADD CONSTRAINT "EntregaCotizacion_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "Pais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaCotizacion" ADD CONSTRAINT "EntregaCotizacion_estadoProvinciaId_fkey" FOREIGN KEY ("estadoProvinciaId") REFERENCES "EstadoProvincia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaPedido" ADD CONSTRAINT "EntregaPedido_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "Pais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaPedido" ADD CONSTRAINT "EntregaPedido_estadoProvinciaId_fkey" FOREIGN KEY ("estadoProvinciaId") REFERENCES "EstadoProvincia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfiguracionEmpresa" ADD CONSTRAINT "ConfiguracionEmpresa_paisOperacionId_fkey" FOREIGN KEY ("paisOperacionId") REFERENCES "Pais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstadoProvincia" ADD CONSTRAINT "EstadoProvincia_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "Pais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportistaCoberturaGeografica" ADD CONSTRAINT "TransportistaCoberturaGeografica_transportistaId_fkey" FOREIGN KEY ("transportistaId") REFERENCES "Transportista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportistaCoberturaGeografica" ADD CONSTRAINT "TransportistaCoberturaGeografica_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "Pais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportistaCoberturaGeografica" ADD CONSTRAINT "TransportistaCoberturaGeografica_estadoProvinciaId_fkey" FOREIGN KEY ("estadoProvinciaId") REFERENCES "EstadoProvincia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
