-- Índices para los filtros de fecha del listado de pedidos:
--   ?desde/?hasta               → Pedido.fechaPedido
--   ?entregaDesde/?entregaHasta → Pedido.fechaEntrega
--
-- Compuestos y con "instanciaId" primero porque todo `where` del módulo
-- arranca por la instancia, y los rangos son semiabiertos sobre la columna
-- cruda (nunca AT TIME ZONE / DATE_TRUNC — ver docs/fechas-y-zonas-horarias.md),
-- que es justo la forma que un B-tree puede aprovechar.
--
-- IF NOT EXISTS para que sea idempotente: si los índices ya se crearon a mano
-- con CREATE INDEX CONCURRENTLY (recomendado en una base con tráfico, porque
-- no toma lock de escritura), esta migración pasa sin hacer nada.

CREATE INDEX IF NOT EXISTS "Pedido_instanciaId_fechaPedido_idx" ON "Pedido"("instanciaId", "fechaPedido");

CREATE INDEX IF NOT EXISTS "Pedido_instanciaId_fechaEntrega_idx" ON "Pedido"("instanciaId", "fechaEntrega");
