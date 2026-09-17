-- CreateEnum
CREATE TYPE "AgrupacionPreparacion" AS ENUM ('POR_PEDIDO', 'POR_PRODUCTO');

-- CreateEnum
CREATE TYPE "RangoPreparacion" AS ENUM ('HOY', 'MANANA', 'SEMANA', 'PERSONALIZADO');

-- AlterTable
ALTER TABLE "PedidoLinea" ADD COLUMN     "cantidadPreparada" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "preparadaEn" TIMESTAMP(3),
ADD COLUMN     "preparadaPorId" TEXT;

-- CreateTable
CREATE TABLE "FlujoPreparacion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL DEFAULT 'Preparación',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "agrupacionDefecto" "AgrupacionPreparacion" NOT NULL DEFAULT 'POR_PEDIDO',
    "rangoDefecto" "RangoPreparacion" NOT NULL DEFAULT 'HOY',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "FlujoPreparacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlujoPreparacionEntrada" (
    "id" TEXT NOT NULL,
    "flujoPreparacionId" TEXT NOT NULL,
    "flujoVentaEtapaId" TEXT NOT NULL,

    CONSTRAINT "FlujoPreparacionEntrada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstadoPreparacion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "esInicial" BOOLEAN NOT NULL DEFAULT false,
    "marcaInicio" BOOLEAN NOT NULL DEFAULT false,
    "esFinal" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "flujoPreparacionId" TEXT NOT NULL,

    CONSTRAINT "EstadoPreparacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreparacionPedido" (
    "id" TEXT NOT NULL,
    "iniciadaEn" TIMESTAMP(3),
    "completadaEn" TIMESTAMP(3),
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "estadoId" TEXT NOT NULL,
    "asignadaAId" TEXT,

    CONSTRAINT "PreparacionPedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreparacionHistorial" (
    "id" TEXT NOT NULL,
    "estadoNombre" TEXT NOT NULL,
    "estadoAnteriorNombre" TEXT,
    "tipo" "TipoMovimientoEtapa" NOT NULL DEFAULT 'MANUAL',
    "usuarioId" TEXT,
    "usuarioNombre" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "preparacionId" TEXT NOT NULL,
    "estadoId" TEXT NOT NULL,

    CONSTRAINT "PreparacionHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FlujoPreparacion_instanciaId_idx" ON "FlujoPreparacion"("instanciaId");

-- CreateIndex
CREATE UNIQUE INDEX "FlujoPreparacion_instanciaId_key" ON "FlujoPreparacion"("instanciaId");

-- CreateIndex
CREATE INDEX "FlujoPreparacionEntrada_flujoPreparacionId_idx" ON "FlujoPreparacionEntrada"("flujoPreparacionId");

-- CreateIndex
CREATE UNIQUE INDEX "FlujoPreparacionEntrada_flujoPreparacionId_flujoVentaEtapaI_key" ON "FlujoPreparacionEntrada"("flujoPreparacionId", "flujoVentaEtapaId");

-- CreateIndex
CREATE INDEX "EstadoPreparacion_flujoPreparacionId_orden_idx" ON "EstadoPreparacion"("flujoPreparacionId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "PreparacionPedido_pedidoId_key" ON "PreparacionPedido"("pedidoId");

-- CreateIndex
CREATE INDEX "PreparacionPedido_estadoId_idx" ON "PreparacionPedido"("estadoId");

-- CreateIndex
CREATE INDEX "PreparacionPedido_completadaEn_idx" ON "PreparacionPedido"("completadaEn");

-- CreateIndex
CREATE INDEX "PreparacionHistorial_preparacionId_idx" ON "PreparacionHistorial"("preparacionId");

-- CreateIndex
CREATE INDEX "PreparacionHistorial_creadoEn_idx" ON "PreparacionHistorial"("creadoEn");

-- AddForeignKey
ALTER TABLE "PedidoLinea" ADD CONSTRAINT "PedidoLinea_preparadaPorId_fkey" FOREIGN KEY ("preparadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlujoPreparacion" ADD CONSTRAINT "FlujoPreparacion_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlujoPreparacionEntrada" ADD CONSTRAINT "FlujoPreparacionEntrada_flujoPreparacionId_fkey" FOREIGN KEY ("flujoPreparacionId") REFERENCES "FlujoPreparacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlujoPreparacionEntrada" ADD CONSTRAINT "FlujoPreparacionEntrada_flujoVentaEtapaId_fkey" FOREIGN KEY ("flujoVentaEtapaId") REFERENCES "FlujoVentaEtapa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstadoPreparacion" ADD CONSTRAINT "EstadoPreparacion_flujoPreparacionId_fkey" FOREIGN KEY ("flujoPreparacionId") REFERENCES "FlujoPreparacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreparacionPedido" ADD CONSTRAINT "PreparacionPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreparacionPedido" ADD CONSTRAINT "PreparacionPedido_estadoId_fkey" FOREIGN KEY ("estadoId") REFERENCES "EstadoPreparacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreparacionPedido" ADD CONSTRAINT "PreparacionPedido_asignadaAId_fkey" FOREIGN KEY ("asignadaAId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreparacionHistorial" ADD CONSTRAINT "PreparacionHistorial_preparacionId_fkey" FOREIGN KEY ("preparacionId") REFERENCES "PreparacionPedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreparacionHistorial" ADD CONSTRAINT "PreparacionHistorial_estadoId_fkey" FOREIGN KEY ("estadoId") REFERENCES "EstadoPreparacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

