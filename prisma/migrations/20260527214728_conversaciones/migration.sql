-- CreateEnum
CREATE TYPE "EstadoConversacion" AS ENUM ('ABIERTA', 'CERRADA', 'ARCHIVADA', 'EN_ESPERA');

-- CreateEnum
CREATE TYPE "TipoMensaje" AS ENUM ('TEXTO', 'IMAGEN', 'VIDEO', 'AUDIO', 'NOTA_VOZ', 'DOCUMENTO', 'PLANTILLA', 'BOTON');

-- CreateEnum
CREATE TYPE "RemitenteMsg" AS ENUM ('CONTACTO', 'AGENTE', 'SISTEMA', 'BOT');

-- CreateEnum
CREATE TYPE "EstadoMensaje" AS ENUM ('RECIBIDO', 'ENVIADO', 'ENTREGADO', 'LEIDO', 'FALLIDO');

-- CreateTable
CREATE TABLE "ContactoIdentificadorCanal" (
    "id" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "identificador" TEXT NOT NULL,
    "contactoId" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactoIdentificadorCanal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuentaCanal" (
    "id" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "identificador" TEXT NOT NULL,
    "configuracion" JSONB NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "instanciaId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuentaCanal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversacion" (
    "id" TEXT NOT NULL,
    "asunto" TEXT,
    "estado" "EstadoConversacion" NOT NULL DEFAULT 'ABIERTA',
    "contactoId" TEXT NOT NULL,
    "cuentaCanalId" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MensajeConversacion" (
    "id" TEXT NOT NULL,
    "contenido" TEXT,
    "tipo" "TipoMensaje" NOT NULL DEFAULT 'TEXTO',
    "remitente" "RemitenteMsg" NOT NULL,
    "estado" "EstadoMensaje" NOT NULL DEFAULT 'ENVIADO',
    "esNotaInterna" BOOLEAN NOT NULL DEFAULT false,
    "idExterno" TEXT,
    "conversacionId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoEn" TIMESTAMP(3),
    "leidoEn" TIMESTAMP(3),

    CONSTRAINT "MensajeConversacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OportunidadConversacion" (
    "id" TEXT NOT NULL,
    "esActiva" BOOLEAN NOT NULL DEFAULT true,
    "oportunidadId" TEXT NOT NULL,
    "conversacionId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OportunidadConversacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactoIdentificadorCanal_instanciaId_idx" ON "ContactoIdentificadorCanal"("instanciaId");

-- CreateIndex
CREATE INDEX "ContactoIdentificadorCanal_contactoId_idx" ON "ContactoIdentificadorCanal"("contactoId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactoIdentificadorCanal_canal_identificador_instanciaId_key" ON "ContactoIdentificadorCanal"("canal", "identificador", "instanciaId");

-- CreateIndex
CREATE INDEX "CuentaCanal_instanciaId_idx" ON "CuentaCanal"("instanciaId");

-- CreateIndex
CREATE INDEX "CuentaCanal_canal_idx" ON "CuentaCanal"("canal");

-- CreateIndex
CREATE INDEX "Conversacion_instanciaId_idx" ON "Conversacion"("instanciaId");

-- CreateIndex
CREATE INDEX "Conversacion_contactoId_idx" ON "Conversacion"("contactoId");

-- CreateIndex
CREATE INDEX "Conversacion_cuentaCanalId_idx" ON "Conversacion"("cuentaCanalId");

-- CreateIndex
CREATE INDEX "Conversacion_estado_idx" ON "Conversacion"("estado");

-- CreateIndex
CREATE INDEX "MensajeConversacion_conversacionId_idx" ON "MensajeConversacion"("conversacionId");

-- CreateIndex
CREATE INDEX "MensajeConversacion_creadoEn_idx" ON "MensajeConversacion"("creadoEn");

-- CreateIndex
CREATE INDEX "MensajeConversacion_remitente_idx" ON "MensajeConversacion"("remitente");

-- CreateIndex
CREATE INDEX "OportunidadConversacion_oportunidadId_idx" ON "OportunidadConversacion"("oportunidadId");

-- CreateIndex
CREATE INDEX "OportunidadConversacion_conversacionId_idx" ON "OportunidadConversacion"("conversacionId");

-- CreateIndex
CREATE UNIQUE INDEX "OportunidadConversacion_oportunidadId_conversacionId_key" ON "OportunidadConversacion"("oportunidadId", "conversacionId");

-- AddForeignKey
ALTER TABLE "ContactoIdentificadorCanal" ADD CONSTRAINT "ContactoIdentificadorCanal_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "Contacto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactoIdentificadorCanal" ADD CONSTRAINT "ContactoIdentificadorCanal_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaCanal" ADD CONSTRAINT "CuentaCanal_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversacion" ADD CONSTRAINT "Conversacion_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "Contacto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversacion" ADD CONSTRAINT "Conversacion_cuentaCanalId_fkey" FOREIGN KEY ("cuentaCanalId") REFERENCES "CuentaCanal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversacion" ADD CONSTRAINT "Conversacion_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensajeConversacion" ADD CONSTRAINT "MensajeConversacion_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OportunidadConversacion" ADD CONSTRAINT "OportunidadConversacion_oportunidadId_fkey" FOREIGN KEY ("oportunidadId") REFERENCES "Oportunidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OportunidadConversacion" ADD CONSTRAINT "OportunidadConversacion_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
