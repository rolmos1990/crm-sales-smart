-- Preparación de pedidos: modo de detalle de las tarjetas pendientes.
--
-- Aditiva y segura para datos existentes: el default `true` deja a todas las
-- instancias con el tablero tal como lo veían (detalle siempre desplegado).
ALTER TABLE "FlujoPreparacion" ADD COLUMN "detalleSiempreVisible" BOOLEAN NOT NULL DEFAULT true;
