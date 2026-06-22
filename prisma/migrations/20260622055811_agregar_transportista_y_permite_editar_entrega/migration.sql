/*
  Warnings:

  - You are about to drop the `JobEmail` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `JobMensaje` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `JobSistema` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "TipoTransportista" AS ENUM ('COURIER_EXTERNO', 'MENSAJERO_PROPIO', 'RETIRO_TIENDA', 'DIGITAL', 'INSTALACION_SERVICIO');

-- CreateEnum
CREATE TYPE "MetodoEntrega" AS ENUM ('COURIER_EXTERNO', 'MENSAJERO_PROPIO', 'RETIRO_TIENDA', 'DIGITAL', 'INSTALACION_SERVICIO');

-- CreateEnum
CREATE TYPE "EstadoEntrega" AS ENUM ('PENDIENTE', 'PREPARANDO', 'EN_CAMINO', 'ENTREGADO', 'FALLIDO', 'CANCELADO', 'DEVUELTO');

-- DropForeignKey
ALTER TABLE "JobEmail" DROP CONSTRAINT "JobEmail_instanciaId_fkey";

-- DropForeignKey
ALTER TABLE "JobMensaje" DROP CONSTRAINT "JobMensaje_instanciaId_fkey";

-- DropForeignKey
ALTER TABLE "JobSistema" DROP CONSTRAINT "JobSistema_instanciaId_fkey";

-- AlterTable
ALTER TABLE "FlujoVentaEtapa" ADD COLUMN     "permiteEditarEntrega" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "JobEmail";

-- DropTable
DROP TABLE "JobMensaje";

-- DropTable
DROP TABLE "JobSistema";

-- DropEnum
DROP TYPE "EstadoJobEmail";

-- DropEnum
DROP TYPE "EstadoJobMensaje";

-- DropEnum
DROP TYPE "EstadoJobSistema";

-- DropEnum
DROP TYPE "TipoJobEmail";

-- DropEnum
DROP TYPE "TipoJobMensaje";

-- DropEnum
DROP TYPE "TipoJobSistema";

-- CreateTable
CREATE TABLE "Transportista" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoTransportista" NOT NULL DEFAULT 'COURIER_EXTERNO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "instanciaId" TEXT,

    CONSTRAINT "Transportista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntregaPedido" (
    "id" TEXT NOT NULL,
    "metodoEntrega" "MetodoEntrega" NOT NULL DEFAULT 'COURIER_EXTERNO',
    "estadoEntrega" "EstadoEntrega" NOT NULL DEFAULT 'PENDIENTE',
    "numeroGuia" TEXT,
    "urlSeguimiento" TEXT,
    "fechaEstimada" TIMESTAMP(3),
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "transportistaId" TEXT,

    CONSTRAINT "EntregaPedido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Transportista_instanciaId_idx" ON "Transportista"("instanciaId");

-- CreateIndex
CREATE UNIQUE INDEX "EntregaPedido_pedidoId_key" ON "EntregaPedido"("pedidoId");

-- CreateIndex
CREATE INDEX "EntregaPedido_pedidoId_idx" ON "EntregaPedido"("pedidoId");

-- AddForeignKey
ALTER TABLE "Transportista" ADD CONSTRAINT "Transportista_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaPedido" ADD CONSTRAINT "EntregaPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaPedido" ADD CONSTRAINT "EntregaPedido_transportistaId_fkey" FOREIGN KEY ("transportistaId") REFERENCES "Transportista"("id") ON DELETE SET NULL ON UPDATE CASCADE;
