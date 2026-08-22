-- Reancla EntregaDigitalCotizacion/Pedido de "1 por documento completo" a
-- "1 por línea de producto" — así una Cotización/Pedido con varios
-- productos DIGITAL distintos (ej. Licencia + Curso + Ebook) puede tener
-- una entrega digital independiente por cada uno, en vez de una sola
-- configuración global. Agrega también ProductoEntregaDigital, la
-- plantilla de valores por defecto de un Producto DIGITAL que se copia
-- (snapshot, no referencia viva) a la línea al agregarlo — editar el
-- Producto después nunca cambia una Cotización/Pedido ya creada.

-- CreateTable
CREATE TABLE "ProductoEntregaDigital" (
    "id" TEXT NOT NULL,
    "metodo" "MetodoEntregaDigital",
    "url" TEXT,
    "archivo" TEXT,
    "codigo" TEXT,
    "usuarioAcceso" TEXT,
    "instrucciones" TEXT,
    "observaciones" TEXT,
    "requiereSeguimiento" BOOLEAN NOT NULL DEFAULT false,
    "tipoSeguimiento" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "productoId" TEXT NOT NULL,

    CONSTRAINT "ProductoEntregaDigital_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductoEntregaDigital_productoId_key" ON "ProductoEntregaDigital"("productoId");
CREATE INDEX "ProductoEntregaDigital_productoId_idx" ON "ProductoEntregaDigital"("productoId");

-- AddForeignKey
ALTER TABLE "ProductoEntregaDigital" ADD CONSTRAINT "ProductoEntregaDigital_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Reanclar EntregaDigitalCotizacion: cotizacionId -> cotizacionLineaId ───

ALTER TABLE "EntregaDigitalCotizacion" ADD COLUMN "cotizacionLineaId" TEXT;

-- Backfill: cada fila existente se ata a la línea de su cotización cuyo
-- producto es DIGITAL; si ninguna línea tiene un producto DIGITAL vinculado
-- (dato inconsistente), cae a la primera línea de esa cotización para no
-- dejar la fila huérfana.
UPDATE "EntregaDigitalCotizacion" edc
SET "cotizacionLineaId" = COALESCE(
  (SELECT cl.id FROM "CotizacionLinea" cl
   JOIN "Producto" p ON p.id = cl."productoId"
   WHERE cl."cotizacionId" = edc."cotizacionId" AND p."tipo" = 'DIGITAL'
   ORDER BY cl.id ASC LIMIT 1),
  (SELECT cl.id FROM "CotizacionLinea" cl
   WHERE cl."cotizacionId" = edc."cotizacionId"
   ORDER BY cl.id ASC LIMIT 1)
);

-- Defensivo: si por algún motivo no se pudo reanclar (cotización sin
-- ninguna línea — no debería pasar, CrearCotizacionSchema exige al menos
-- una), se descarta la fila en vez de dejarla con FK inválida.
DELETE FROM "EntregaDigitalCotizacion" WHERE "cotizacionLineaId" IS NULL;

ALTER TABLE "EntregaDigitalCotizacion" ALTER COLUMN "cotizacionLineaId" SET NOT NULL;
ALTER TABLE "EntregaDigitalCotizacion" DROP CONSTRAINT "EntregaDigitalCotizacion_cotizacionId_fkey";
DROP INDEX "EntregaDigitalCotizacion_cotizacionId_key";
DROP INDEX "EntregaDigitalCotizacion_cotizacionId_idx";
ALTER TABLE "EntregaDigitalCotizacion" DROP COLUMN "cotizacionId";

CREATE UNIQUE INDEX "EntregaDigitalCotizacion_cotizacionLineaId_key" ON "EntregaDigitalCotizacion"("cotizacionLineaId");
CREATE INDEX "EntregaDigitalCotizacion_cotizacionLineaId_idx" ON "EntregaDigitalCotizacion"("cotizacionLineaId");
ALTER TABLE "EntregaDigitalCotizacion" ADD CONSTRAINT "EntregaDigitalCotizacion_cotizacionLineaId_fkey" FOREIGN KEY ("cotizacionLineaId") REFERENCES "CotizacionLinea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Reanclar EntregaDigitalPedido: pedidoId -> pedidoLineaId (mismo patrón) ───

ALTER TABLE "EntregaDigitalPedido" ADD COLUMN "pedidoLineaId" TEXT;

UPDATE "EntregaDigitalPedido" edp
SET "pedidoLineaId" = COALESCE(
  (SELECT pl.id FROM "PedidoLinea" pl
   JOIN "Producto" p ON p.id = pl."productoId"
   WHERE pl."pedidoId" = edp."pedidoId" AND p."tipo" = 'DIGITAL'
   ORDER BY pl.id ASC LIMIT 1),
  (SELECT pl.id FROM "PedidoLinea" pl
   WHERE pl."pedidoId" = edp."pedidoId"
   ORDER BY pl.id ASC LIMIT 1)
);

DELETE FROM "EntregaDigitalPedido" WHERE "pedidoLineaId" IS NULL;

ALTER TABLE "EntregaDigitalPedido" ALTER COLUMN "pedidoLineaId" SET NOT NULL;
ALTER TABLE "EntregaDigitalPedido" DROP CONSTRAINT "EntregaDigitalPedido_pedidoId_fkey";
DROP INDEX "EntregaDigitalPedido_pedidoId_key";
DROP INDEX "EntregaDigitalPedido_pedidoId_idx";
ALTER TABLE "EntregaDigitalPedido" DROP COLUMN "pedidoId";

CREATE UNIQUE INDEX "EntregaDigitalPedido_pedidoLineaId_key" ON "EntregaDigitalPedido"("pedidoLineaId");
CREATE INDEX "EntregaDigitalPedido_pedidoLineaId_idx" ON "EntregaDigitalPedido"("pedidoLineaId");
ALTER TABLE "EntregaDigitalPedido" ADD CONSTRAINT "EntregaDigitalPedido_pedidoLineaId_fkey" FOREIGN KEY ("pedidoLineaId") REFERENCES "PedidoLinea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
