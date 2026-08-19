-- Espejo de EntregaPedido para Cotizacion: permite capturar la info de
-- entrega ya en la cotización y trasladarla al Pedido cuando se aprueba.
CREATE TABLE "EntregaCotizacion" (
    "id" TEXT NOT NULL,
    "metodoEntrega" "MetodoEntrega" NOT NULL DEFAULT 'COURIER_EXTERNO',
    "estadoEntrega" "EstadoEntrega" NOT NULL DEFAULT 'PENDIENTE',
    "numeroGuia" TEXT,
    "urlSeguimiento" TEXT,
    "fechaEstimada" TIMESTAMP(3),
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "cotizacionId" TEXT NOT NULL,
    "transportistaId" TEXT,

    CONSTRAINT "EntregaCotizacion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EntregaCotizacion_cotizacionId_key" ON "EntregaCotizacion"("cotizacionId");
CREATE INDEX "EntregaCotizacion_cotizacionId_idx" ON "EntregaCotizacion"("cotizacionId");

ALTER TABLE "EntregaCotizacion" ADD CONSTRAINT "EntregaCotizacion_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntregaCotizacion" ADD CONSTRAINT "EntregaCotizacion_transportistaId_fkey" FOREIGN KEY ("transportistaId") REFERENCES "Transportista"("id") ON DELETE SET NULL ON UPDATE CASCADE;
