-- Simplifica Producto a 3 tipos (Fisico/Servicio/Digital), que determinan
-- qué bloque de cumplimiento usa una Cotización/Pedido. Todos los
-- productos existentes migran a FISICO (comportamiento actual del
-- sistema), vía el DEFAULT del ADD COLUMN NOT NULL — sin UPDATE aparte.

-- CreateEnum
CREATE TYPE "TipoProducto" AS ENUM ('FISICO', 'SERVICIO', 'DIGITAL');
CREATE TYPE "ModalidadServicio" AS ENUM ('EN_ESTABLECIMIENTO', 'A_DOMICILIO', 'REMOTO', 'OTRO');
CREATE TYPE "MetodoEntregaDigital" AS ENUM ('EMAIL', 'LINK', 'DESCARGA', 'ACCESO', 'LICENCIA', 'MANUAL', 'OTRO');

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN "tipo" "TipoProducto" NOT NULL DEFAULT 'FISICO';
ALTER TABLE "Cotizacion" ADD COLUMN "tipoCumplimiento" "TipoProducto" NOT NULL DEFAULT 'FISICO';
ALTER TABLE "Pedido" ADD COLUMN "tipoCumplimiento" "TipoProducto" NOT NULL DEFAULT 'FISICO';

-- CreateTable
CREATE TABLE "ServicioCotizacion" (
    "id" TEXT NOT NULL,
    "modalidad" "ModalidadServicio",
    "fecha" TIMESTAMP(3),
    "hora" TEXT,
    "duracion" TEXT,
    "ubicacion" TEXT,
    "direccion" TEXT,
    "responsable" TEXT,
    "instrucciones" TEXT,
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "cotizacionId" TEXT NOT NULL,

    CONSTRAINT "ServicioCotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicioPedido" (
    "id" TEXT NOT NULL,
    "modalidad" "ModalidadServicio",
    "fecha" TIMESTAMP(3),
    "hora" TEXT,
    "duracion" TEXT,
    "ubicacion" TEXT,
    "direccion" TEXT,
    "responsable" TEXT,
    "instrucciones" TEXT,
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "pedidoId" TEXT NOT NULL,

    CONSTRAINT "ServicioPedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntregaDigitalCotizacion" (
    "id" TEXT NOT NULL,
    "metodo" "MetodoEntregaDigital",
    "email" TEXT,
    "url" TEXT,
    "archivo" TEXT,
    "codigo" TEXT,
    "usuarioAcceso" TEXT,
    "fechaEntrega" TIMESTAMP(3),
    "fechaExpiracion" TIMESTAMP(3),
    "instrucciones" TEXT,
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "cotizacionId" TEXT NOT NULL,

    CONSTRAINT "EntregaDigitalCotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntregaDigitalPedido" (
    "id" TEXT NOT NULL,
    "metodo" "MetodoEntregaDigital",
    "email" TEXT,
    "url" TEXT,
    "archivo" TEXT,
    "codigo" TEXT,
    "usuarioAcceso" TEXT,
    "fechaEntrega" TIMESTAMP(3),
    "fechaExpiracion" TIMESTAMP(3),
    "instrucciones" TEXT,
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "pedidoId" TEXT NOT NULL,

    CONSTRAINT "EntregaDigitalPedido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServicioCotizacion_cotizacionId_key" ON "ServicioCotizacion"("cotizacionId");
CREATE INDEX "ServicioCotizacion_cotizacionId_idx" ON "ServicioCotizacion"("cotizacionId");

CREATE UNIQUE INDEX "ServicioPedido_pedidoId_key" ON "ServicioPedido"("pedidoId");
CREATE INDEX "ServicioPedido_pedidoId_idx" ON "ServicioPedido"("pedidoId");

CREATE UNIQUE INDEX "EntregaDigitalCotizacion_cotizacionId_key" ON "EntregaDigitalCotizacion"("cotizacionId");
CREATE INDEX "EntregaDigitalCotizacion_cotizacionId_idx" ON "EntregaDigitalCotizacion"("cotizacionId");

CREATE UNIQUE INDEX "EntregaDigitalPedido_pedidoId_key" ON "EntregaDigitalPedido"("pedidoId");
CREATE INDEX "EntregaDigitalPedido_pedidoId_idx" ON "EntregaDigitalPedido"("pedidoId");

-- AddForeignKey
ALTER TABLE "ServicioCotizacion" ADD CONSTRAINT "ServicioCotizacion_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServicioPedido" ADD CONSTRAINT "ServicioPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntregaDigitalCotizacion" ADD CONSTRAINT "EntregaDigitalCotizacion_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntregaDigitalPedido" ADD CONSTRAINT "EntregaDigitalPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;
