-- 034-canal-correo-electronico — migración aditiva.
--
-- Nada de lo que sigue modifica datos existentes: todas las columnas nuevas
-- son opcionales o traen DEFAULT, y los defaults describen exactamente el
-- estado real de las filas actuales (ninguna conversación de WhatsApp está
-- bloqueada por aprobación, ninguna oportunidad existente nació de un correo).
--
-- El diff generado por `prisma migrate diff` se revisó antes de escribir este
-- archivo: no contiene ningún DROP, y en particular NO toca los dos índices
-- únicos parciales de CuentaCanal creados a mano en migraciones previas
-- (instagram y facebook_messenger), que Prisma no conoce porque el DSL no
-- soporta índices parciales. Ver el comentario del modelo CuentaCanal.

-- AlterTable
ALTER TABLE "Oportunidad" ADD COLUMN     "aprobacionPendiente" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ContactoIdentificadorCanal" ADD COLUMN     "aprobadoEn" TIMESTAMP(3),
ADD COLUMN     "aprobadoPorId" TEXT;

-- AlterTable
ALTER TABLE "Conversacion" ADD COLUMN     "bloqueadaPorAprobacion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hiloExterno" TEXT;

-- CreateTable
CREATE TABLE "BuzonCorreoEstado" (
    "id" TEXT NOT NULL,
    "cuentaCanalId" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,
    "uidValidity" BIGINT,
    "ultimoUid" BIGINT,
    "ultimaLecturaEn" TIMESTAMP(3),
    "ultimaLecturaOkEn" TIMESTAMP(3),
    "correosLeidos" INTEGER NOT NULL DEFAULT 0,
    "errorCodigo" TEXT,
    "errorMensaje" TEXT,
    "errorDesde" TIMESTAMP(3),
    "fallosSeguidos" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuzonCorreoEstado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BuzonCorreoEstado_cuentaCanalId_key" ON "BuzonCorreoEstado"("cuentaCanalId");

-- CreateIndex
CREATE INDEX "BuzonCorreoEstado_instanciaId_idx" ON "BuzonCorreoEstado"("instanciaId");

-- CreateIndex
CREATE INDEX "Oportunidad_instanciaId_aprobacionPendiente_idx" ON "Oportunidad"("instanciaId", "aprobacionPendiente");

-- CreateIndex
CREATE INDEX "Conversacion_instanciaId_bloqueadaPorAprobacion_idx" ON "Conversacion"("instanciaId", "bloqueadaPorAprobacion");

-- CreateIndex
CREATE INDEX "Conversacion_instanciaId_hiloExterno_idx" ON "Conversacion"("instanciaId", "hiloExterno");

-- AddForeignKey
ALTER TABLE "BuzonCorreoEstado" ADD CONSTRAINT "BuzonCorreoEstado_cuentaCanalId_fkey" FOREIGN KEY ("cuentaCanalId") REFERENCES "CuentaCanal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuzonCorreoEstado" ADD CONSTRAINT "BuzonCorreoEstado_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- Índice único parcial del canal de correo (FR-010): una misma dirección no
-- puede registrarse dos veces en la misma cuenta, o se leerían los mismos
-- correos dos veces.
--
-- Va en SQL crudo y no en el schema porque Prisma no soporta índices únicos
-- parciales en el DSL. Es el mismo patrón que ya usan:
--   20260817120000_add_instagram_auth_provider        (canal = 'instagram')
--   20260827000000_add_facebook_messenger_canal       (canal = 'facebook_messenger')
-- Se restringe a su canal para no imponer unicidad a canales que hoy no la
-- garantizan en datos existentes (whatsapp_lite).
--
-- No hace falta limpiar duplicados previos: hasta esta feature no existía
-- ninguna forma de crear una CuentaCanal con canal = 'email'. Verificable con:
--   SELECT "instanciaId", "identificador", COUNT(*) FROM "CuentaCanal"
--     WHERE "canal" = 'email' GROUP BY 1, 2 HAVING COUNT(*) > 1;
CREATE UNIQUE INDEX "CuentaCanal_instanciaId_identificador_email_key"
  ON "CuentaCanal" ("instanciaId", "identificador")
  WHERE "canal" = 'email';
