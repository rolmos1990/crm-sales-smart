-- 021-alias-proveedores-ia
-- Paso 1: agregar columnas nullable y quitar la restricción única vieja que
-- impedía tener más de una configuración del mismo proveedor + tipo de agente
ALTER TABLE "ProveedorIA" ADD COLUMN "alias" TEXT;
ALTER TABLE "ProveedorIA" ADD COLUMN "aliasNormalizado" TEXT;

DROP INDEX "ProveedorIA_instanciaId_proveedor_tipoAgenteIA_key";

-- Paso 2: backfill de filas existentes — alias = nombre del proveedor,
-- sufijado por colisión dentro de la misma instancia (orden por fecha de
-- creación), para que ninguna configuración previa quede sin alias válido
-- y único (FR-009 / SC-004 de specs/021-alias-proveedores-ia/spec.md)
WITH numerado AS (
  SELECT
    "id",
    "proveedor",
    ROW_NUMBER() OVER (
      PARTITION BY "instanciaId", "proveedor"
      ORDER BY "creadoEn"
    ) AS "fila"
  FROM "ProveedorIA"
)
UPDATE "ProveedorIA" p
SET "alias" = CASE
    WHEN numerado."fila" = 1 THEN numerado."proveedor"::text
    ELSE numerado."proveedor"::text || '-' || numerado."fila"::text
  END
FROM numerado
WHERE p."id" = numerado."id";

UPDATE "ProveedorIA"
SET "aliasNormalizado" = lower(trim("alias"));

-- Paso 3: ahora que toda fila tiene un alias válido, exigir NOT NULL y crear
-- la nueva restricción única (insensible a mayúsculas/espacios vía la columna
-- ya normalizada en el paso 2 — ver research.md Decisión 1)
ALTER TABLE "ProveedorIA" ALTER COLUMN "alias" SET NOT NULL;
ALTER TABLE "ProveedorIA" ALTER COLUMN "aliasNormalizado" SET NOT NULL;

CREATE UNIQUE INDEX "ProveedorIA_instanciaId_aliasNormalizado_key" ON "ProveedorIA"("instanciaId", "aliasNormalizado");
