-- Extend PedidoHistorialEtapa with richer tracking fields
ALTER TABLE "PedidoHistorialEtapa" ADD COLUMN "etapaAnteriorNombre" TEXT;
ALTER TABLE "PedidoHistorialEtapa" ADD COLUMN "origen" TEXT NOT NULL DEFAULT 'SISTEMA';
ALTER TABLE "PedidoHistorialEtapa" ADD COLUMN "referencia" TEXT;
ALTER TABLE "PedidoHistorialEtapa" ADD COLUMN "usuarioNombre" TEXT;

-- Backfill origen based on tipo for existing rows
UPDATE "PedidoHistorialEtapa"
SET "origen" = CASE
  WHEN "tipo" = 'MANUAL' THEN 'USUARIO'
  ELSE 'SISTEMA'
END;
