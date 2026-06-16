-- CreateEnum
CREATE TYPE "OperadorCondicion" AS ENUM ('IGUAL', 'DIFERENTE', 'MAYOR_QUE', 'MENOR_QUE', 'CONTIENE', 'ES_VERDADERO', 'ES_FALSO');

-- CreateEnum
CREATE TYPE "TipoMovimientoEtapa" AS ENUM ('MANUAL', 'AUTOMATICO');

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "flujoVentaEtapaId" TEXT,
ADD COLUMN     "flujoVentaId" TEXT;

-- CreateTable
CREATE TABLE "FlujoVenta" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "esDefault" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "instanciaId" TEXT,

    CONSTRAINT "FlujoVenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlujoVentaEtapa" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "color" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "esInicial" BOOLEAN NOT NULL DEFAULT false,
    "esFinal" BOOLEAN NOT NULL DEFAULT false,
    "esCancelacion" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "flujoVentaId" TEXT NOT NULL,

    CONSTRAINT "FlujoVentaEtapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlujoVentaRegla" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "prioridad" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "etapaDestinoId" TEXT NOT NULL,

    CONSTRAINT "FlujoVentaRegla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlujoVentaReglaCondicion" (
    "id" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "operador" "OperadorCondicion" NOT NULL,
    "valor" TEXT NOT NULL,
    "reglaId" TEXT NOT NULL,

    CONSTRAINT "FlujoVentaReglaCondicion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoHistorialEtapa" (
    "id" TEXT NOT NULL,
    "etapaNombre" TEXT NOT NULL,
    "tipo" "TipoMovimientoEtapa" NOT NULL,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pedidoId" TEXT NOT NULL,
    "etapaId" TEXT NOT NULL,
    "usuarioId" TEXT,

    CONSTRAINT "PedidoHistorialEtapa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FlujoVenta_instanciaId_idx" ON "FlujoVenta"("instanciaId");

-- CreateIndex
CREATE INDEX "FlujoVentaEtapa_flujoVentaId_idx" ON "FlujoVentaEtapa"("flujoVentaId");

-- CreateIndex
CREATE UNIQUE INDEX "FlujoVentaEtapa_flujoVentaId_orden_key" ON "FlujoVentaEtapa"("flujoVentaId", "orden");

-- CreateIndex
CREATE INDEX "FlujoVentaRegla_etapaDestinoId_idx" ON "FlujoVentaRegla"("etapaDestinoId");

-- CreateIndex
CREATE INDEX "FlujoVentaReglaCondicion_reglaId_idx" ON "FlujoVentaReglaCondicion"("reglaId");

-- CreateIndex
CREATE INDEX "PedidoHistorialEtapa_pedidoId_idx" ON "PedidoHistorialEtapa"("pedidoId");

-- CreateIndex
CREATE INDEX "PedidoHistorialEtapa_etapaId_idx" ON "PedidoHistorialEtapa"("etapaId");

-- CreateIndex
CREATE INDEX "Pedido_flujoVentaEtapaId_idx" ON "Pedido"("flujoVentaEtapaId");

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_flujoVentaId_fkey" FOREIGN KEY ("flujoVentaId") REFERENCES "FlujoVenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_flujoVentaEtapaId_fkey" FOREIGN KEY ("flujoVentaEtapaId") REFERENCES "FlujoVentaEtapa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlujoVenta" ADD CONSTRAINT "FlujoVenta_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlujoVentaEtapa" ADD CONSTRAINT "FlujoVentaEtapa_flujoVentaId_fkey" FOREIGN KEY ("flujoVentaId") REFERENCES "FlujoVenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlujoVentaRegla" ADD CONSTRAINT "FlujoVentaRegla_etapaDestinoId_fkey" FOREIGN KEY ("etapaDestinoId") REFERENCES "FlujoVentaEtapa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlujoVentaReglaCondicion" ADD CONSTRAINT "FlujoVentaReglaCondicion_reglaId_fkey" FOREIGN KEY ("reglaId") REFERENCES "FlujoVentaRegla"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoHistorialEtapa" ADD CONSTRAINT "PedidoHistorialEtapa_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoHistorialEtapa" ADD CONSTRAINT "PedidoHistorialEtapa_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "FlujoVentaEtapa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
