-- Migración compatible y reversible: agrega soporte para múltiples flujos de
-- autenticación en CuentaCanal (hoy solo aplica a canal = 'instagram').
--
-- No borra ni modifica datos existentes. Las filas actuales quedan con
-- proveedorAuth = 'MetaFacebook' (el flujo que efectivamente usaron).
--
-- Rollback manual (en caso de necesitarlo):
--   DROP INDEX IF EXISTS "CuentaCanal_instagram_unica_por_instancia";
--   ALTER TABLE "CuentaCanal" DROP COLUMN "tokenRenovadoEn";
--   ALTER TABLE "CuentaCanal" DROP COLUMN "tokenExpiraEn";
--   ALTER TABLE "CuentaCanal" DROP COLUMN "proveedorAuth";
--   DROP TYPE IF EXISTS "ProveedorAuthCanal";

-- CreateEnum
CREATE TYPE "ProveedorAuthCanal" AS ENUM ('MetaFacebook', 'Instagram');

-- AlterTable
ALTER TABLE "CuentaCanal"
  ADD COLUMN "proveedorAuth" "ProveedorAuthCanal" NOT NULL DEFAULT 'MetaFacebook',
  ADD COLUMN "tokenExpiraEn" TIMESTAMP(3),
  ADD COLUMN "tokenRenovadoEn" TIMESTAMP(3);

-- CreateIndex
-- Único parcial: evita duplicar la misma cuenta de Instagram (mismo
-- identificador de IG) dentro de una misma organización. Se limita a
-- canal = 'instagram' a propósito — whatsapp_lite/email no garantizan hoy
-- esa unicidad en datos existentes y aplicar el índice sin el filtro podría
-- romper el deploy si ya hay duplicados en esos canales. No afecta cuentas
-- de otras instancias (instanciaId forma parte de la clave).
-- Nota: Prisma no representa índices únicos parciales en schema.prisma —
-- ver comentario en el modelo CuentaCanal.
CREATE UNIQUE INDEX "CuentaCanal_instagram_unica_por_instancia"
  ON "CuentaCanal"("instanciaId", "identificador")
  WHERE "canal" = 'instagram';
