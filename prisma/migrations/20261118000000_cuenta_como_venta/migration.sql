-- 038-cuenta-como-venta — parte ADITIVA (pasos 1 a 4 de data-model.md).
--
-- La parte destructiva (DROP de Pedido.fechaExpiracion) vive en la migración
-- 20261118000100_eliminar_fecha_expiracion_pedido, y entre las dos debe
-- correr scripts/depurar-reglas-fecha-expiracion.ts. Ese orden no es
-- negociable: al desaparecer el campo del catálogo de Reglas de validación,
-- una regla que lo use resuelve `undefined` y pasa a bloquear silenciosamente
-- el avance de los pedidos (ver research.md Decisión 6).

-- Paso 1 — Flag de etapa.
-- Los pedidos en una etapa marcada cuentan en "Total ventas". Se lee siempre
-- en vivo; nunca se copia al Pedido.
ALTER TABLE "FlujoVentaEtapa"
  ADD COLUMN "cuentaComoVenta" BOOLEAN NOT NULL DEFAULT false;

-- Paso 2 — Backfill de configuración.
-- Misma definición con la que hoy se calcula la tarjeta "Entregados", así que
-- cada cuenta arranca coherente con lo que ya veía y lo ajusta después.
-- Idempotente.
UPDATE "FlujoVentaEtapa"
   SET "cuentaComoVenta" = true
 WHERE "esFinal" = true
   AND "esCancelacion" = false;

-- Paso 3 — Fecha de venta, con su índice.
ALTER TABLE "Pedido"
  ADD COLUMN "fechaVenta" TIMESTAMP(3);

CREATE INDEX "Pedido_instanciaId_fechaVenta_idx"
  ON "Pedido" ("instanciaId", "fechaVenta");

-- Paso 4 — Backfill: a los pedidos que YA cuentan como venta se les pone la
-- fecha de entrega estimada.
--
-- Decisión de negocio explícita: no se reconstruye desde PedidoHistorialEtapa.
-- El histórico queda fechado con la entrega estimada y de acá en adelante la
-- fecha se sella sola, según la configuración de "Cuenta como Venta".
--
-- Se limita a los pedidos cuya etapa actual cuenta como venta —es decir, los
-- ya cerrados— y NO se tocan los abiertos. El motivo importa: `fechaVenta` se
-- sella una sola vez y después no se reescribe, así que sellar hoy un pedido
-- pendiente con su entrega ESTIMADA lo dejaría para siempre con una fecha que
-- nunca fue una venta (y que incluso puede estar en el futuro). Dejándolos en
-- NULL, reciben su fecha real al cruzar a una etapa que cuenta.
--
-- COALESCE a fechaPedido: un pedido cerrado sin entrega estimada quedaría en
-- NULL y desaparecería de cualquier total filtrado por fecha, sin ningún
-- aviso. La fecha de creación es la aproximación disponible.
--
-- El `IS NULL` del WHERE lo hace idempotente.
UPDATE "Pedido" p
   SET "fechaVenta" = COALESCE(p."fechaEntrega", p."fechaPedido")
  FROM "FlujoVentaEtapa" e
 WHERE e."id" = p."flujoVentaEtapaId"
   AND e."cuentaComoVenta" = true
   AND p."fechaVenta" IS NULL;

-- Instancias sin Flujo de Venta dinámico: los KPIs caen al enum legacy
-- (estado = 'ENTREGADO'), así que sus pedidos también necesitan fecha.
UPDATE "Pedido" p
   SET "fechaVenta" = COALESCE(p."fechaEntrega", p."fechaPedido")
 WHERE p."flujoVentaEtapaId" IS NULL
   AND p."estado" = 'ENTREGADO'
   AND p."fechaVenta" IS NULL;
