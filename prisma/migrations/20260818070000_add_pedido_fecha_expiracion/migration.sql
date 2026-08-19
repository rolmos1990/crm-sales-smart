-- Fecha límite configurable por el usuario para tener en cuenta el pedido
-- (deadline) — usada por las métricas "Pendientes"/"Expirados" del listado.
ALTER TABLE "Pedido" ADD COLUMN "fechaExpiracion" TIMESTAMP(3);
