-- Nombre de quien recibe el envío, en la entrega de cotizaciones y pedidos.
--
-- Distinto del `destinatario` de Cotizacion.metadata, que es el cliente al
-- que va dirigida la cotización: quien recibe en la puerta puede ser otra
-- persona. Nullable porque casi siempre reciben el comprador y no tiene
-- sentido obligar a llenarlo.

ALTER TABLE "EntregaCotizacion" ADD COLUMN "nombreDestinatario" TEXT;
ALTER TABLE "EntregaPedido"     ADD COLUMN "nombreDestinatario" TEXT;
