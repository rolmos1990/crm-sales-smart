-- Datos extra del cliente que un transportista puede exigir para entregar.
-- requiereDireccionCompleta ya existia (se guardaba y se configuraba, pero no
-- se leia en ningun lado); requiereIdentificacion es nuevo y arranca en false
-- para no cambiarle el comportamiento a ningun transportista existente.
ALTER TABLE "CondicionesTransportista"
  ADD COLUMN "requiereIdentificacion" BOOLEAN NOT NULL DEFAULT false;

-- Nullable y sin default: toda entrega existente queda igual que antes. No
-- bloquean el guardado (el formulario solo avisa); si falta uno que el
-- transportista exige, aprobarCotizacion se niega a convertir en pedido.
ALTER TABLE "EntregaCotizacion"
  ADD COLUMN "direccionEntrega" TEXT,
  ADD COLUMN "identificacion"   TEXT;

ALTER TABLE "EntregaPedido"
  ADD COLUMN "direccionEntrega" TEXT,
  ADD COLUMN "identificacion"   TEXT;
