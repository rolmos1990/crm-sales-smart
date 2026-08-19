-- La cotización aún no tiene número de guía ni URL de seguimiento reales —
-- esos se completan recién en el Pedido (ver EntregaPedido), al aprobar.
ALTER TABLE "EntregaCotizacion" DROP COLUMN "numeroGuia";
ALTER TABLE "EntregaCotizacion" DROP COLUMN "urlSeguimiento";
