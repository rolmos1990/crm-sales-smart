-- Costo de envío: se suma al total (lo que paga el cliente) pero se excluye
-- a propósito de los KPIs "Total ventas" / "Total ventas · mes actual".
ALTER TABLE "Cotizacion" ADD COLUMN "costoEnvio" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "Pedido" ADD COLUMN "costoEnvio" DECIMAL(65,30) NOT NULL DEFAULT 0;
