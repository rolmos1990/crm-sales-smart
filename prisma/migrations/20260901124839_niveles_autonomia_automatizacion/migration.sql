-- CreateEnum
CREATE TYPE "CategoriaIntencionAutonomia" AS ENUM ('SALUDO', 'CONSULTA_HORARIO', 'PREGUNTA_FRECUENTE', 'INFORMACION_GENERAL', 'RECOMENDACION', 'CONSULTA_PRECIO', 'CONSULTA_DISPONIBILIDAD', 'COSTO_ENVIO', 'SOLICITUD_COTIZACION', 'RECLAMO', 'SOLICITUD_REEMBOLSO', 'DESCUENTO_ESPECIAL', 'PROBLEMA_PAGO', 'EXCEPCION_ENTREGA', 'CLIENTE_MOLESTO', 'COMPROMISO_NO_DEFINIDO');

-- CreateEnum
CREATE TYPE "NivelAutonomia" AS ENUM ('SUGGESTION_ONLY', 'AUTO_REPLY_SAFE_INTENTS', 'CONDITIONAL_AUTOMATION', 'HUMAN_ONLY');

-- CreateTable
CREATE TABLE "AutonomiaIntencionConfig" (
    "id" TEXT NOT NULL,
    "categoria" "CategoriaIntencionAutonomia" NOT NULL,
    "nivel" "NivelAutonomia" NOT NULL,
    "condicionesConfianza" JSONB,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "instanciaId" TEXT NOT NULL,
    "agenteIAConfigId" TEXT NOT NULL,

    CONSTRAINT "AutonomiaIntencionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RespuestaPendienteRevision" (
    "id" TEXT NOT NULL,
    "categoriaDetectada" "CategoriaIntencionAutonomia",
    "mensajeCliente" TEXT NOT NULL,
    "respuestaPropuesta" TEXT NOT NULL,
    "motivoPendiente" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "respuestaEditada" TEXT,
    "resueltaPorUsuarioId" TEXT,
    "resueltaEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "instanciaId" TEXT NOT NULL,
    "agenteIAConfigId" TEXT NOT NULL,
    "conversacionId" TEXT NOT NULL,

    CONSTRAINT "RespuestaPendienteRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutonomiaIntencionConfig_instanciaId_idx" ON "AutonomiaIntencionConfig"("instanciaId");

-- CreateIndex
CREATE UNIQUE INDEX "AutonomiaIntencionConfig_agenteIAConfigId_categoria_key" ON "AutonomiaIntencionConfig"("agenteIAConfigId", "categoria");

-- CreateIndex
CREATE INDEX "RespuestaPendienteRevision_instanciaId_estado_idx" ON "RespuestaPendienteRevision"("instanciaId", "estado");

-- CreateIndex
CREATE INDEX "RespuestaPendienteRevision_conversacionId_idx" ON "RespuestaPendienteRevision"("conversacionId");

-- AddForeignKey
ALTER TABLE "AutonomiaIntencionConfig" ADD CONSTRAINT "AutonomiaIntencionConfig_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutonomiaIntencionConfig" ADD CONSTRAINT "AutonomiaIntencionConfig_agenteIAConfigId_fkey" FOREIGN KEY ("agenteIAConfigId") REFERENCES "AgenteIAConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RespuestaPendienteRevision" ADD CONSTRAINT "RespuestaPendienteRevision_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RespuestaPendienteRevision" ADD CONSTRAINT "RespuestaPendienteRevision_agenteIAConfigId_fkey" FOREIGN KEY ("agenteIAConfigId") REFERENCES "AgenteIAConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RespuestaPendienteRevision" ADD CONSTRAINT "RespuestaPendienteRevision_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
