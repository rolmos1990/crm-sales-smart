-- Soporte para el canal "facebook_messenger" (spec 005-facebook-messenger-integracion).
-- No agrega columnas ni toca datos existentes — "canal" en CuentaCanal ya es
-- una columna de texto libre, el mismo patrón que ya permitió sumar
-- "instagram" sin cambios estructurales (ver 20260817120000_add_instagram_auth_provider).
--
-- Rollback manual (en caso de necesitarlo):
--   DROP INDEX IF EXISTS "CuentaCanal_facebook_messenger_unica_por_instancia";

-- CreateIndex
-- Único parcial: evita conectar la misma Página de Facebook dos veces para
-- Messenger dentro de la misma organización — mismo criterio ya aplicado a
-- "instagram" (ver esa migración). Se limita a canal = 'facebook_messenger'
-- a propósito, por la misma razón: no forzar unicidad retroactiva en otros
-- canales que hoy no la garantizan.
-- Nota: Prisma no representa índices únicos parciales en schema.prisma — ver
-- comentario en el modelo CuentaCanal.
CREATE UNIQUE INDEX "CuentaCanal_facebook_messenger_unica_por_instancia"
  ON "CuentaCanal"("instanciaId", "identificador")
  WHERE "canal" = 'facebook_messenger';
