-- Las zonas de entrega pasan a ser de UN transportista, no del catálogo
-- compartido de la empresa.
--
-- El catálogo compartido hacía que importar destinos para un transportista
-- modificara la cobertura de otro: resolverZona reutilizaba la zona existente
-- por nombre y le agregaba las ubicaciones del archivo. Además, la pestaña de
-- un transportista listaba las zonas de todos los demás como "sin tarifa".
--
-- La migración NO divide ninguna zona porque ninguna está cubierta por dos
-- transportistas: se verificó sobre la base entera (68 zonas — 53 con un
-- único transportista, 15 sin ninguno).

ALTER TABLE "ZonaEntrega" ADD COLUMN "transportistaId" TEXT;

-- Cada zona al único transportista que la cubre. El HAVING deja fuera a
-- cualquier zona compartida: si existiera, quedaría en NULL y el SET NOT NULL
-- de más abajo aborta la migración en vez de asignarla al azar.
UPDATE "ZonaEntrega" z
SET "transportistaId" = sub."transportistaId"
FROM (
  SELECT "zonaEntregaId", MIN("transportistaId") AS "transportistaId"
  FROM "TarifaTransportistaZona"
  GROUP BY "zonaEntregaId"
  HAVING COUNT(DISTINCT "transportistaId") = 1
) sub
WHERE z.id = sub."zonaEntregaId";

-- Zonas que no cubre nadie: sin transportista al que pertenecer, y en el
-- modelo nuevo serían inalcanzables desde la UI. Se eliminan solo si además
-- ninguna cotización ni pedido las referencia (verificado: 0 de las 15 lo
-- hacen). Sus ubicaciones y alias caen por ON DELETE CASCADE.
DELETE FROM "ZonaEntrega" z
WHERE z."transportistaId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "TarifaTransportistaZona" t WHERE t."zonaEntregaId" = z."id")
  AND NOT EXISTS (SELECT 1 FROM "EntregaCotizacion" e WHERE e."zonaEntregaId" = z."id")
  AND NOT EXISTS (SELECT 1 FROM "EntregaPedido"     e WHERE e."zonaEntregaId" = z."id");

-- Si algo quedó sin asignar (zona compartida, o huérfana referenciada por un
-- documento) esto falla y la migración se revierte entera: preferible a
-- dejar el modelo a medias.
ALTER TABLE "ZonaEntrega" ALTER COLUMN "transportistaId" SET NOT NULL;

ALTER TABLE "ZonaEntrega"
  ADD CONSTRAINT "ZonaEntrega_transportistaId_fkey"
  FOREIGN KEY ("transportistaId") REFERENCES "Transportista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- El nombre ya no es único por empresa sino por transportista: dos
-- transportistas pueden tener cada uno su "Coclé", que es justamente lo que
-- antes no se podía.
DROP INDEX IF EXISTS "ZonaEntrega_instanciaId_nombre_key";
CREATE UNIQUE INDEX "ZonaEntrega_transportistaId_nombre_key" ON "ZonaEntrega"("transportistaId", "nombre");
CREATE INDEX "ZonaEntrega_transportistaId_idx" ON "ZonaEntrega"("transportistaId");
