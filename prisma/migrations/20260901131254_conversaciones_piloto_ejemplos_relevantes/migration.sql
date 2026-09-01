-- CreateEnum
CREATE TYPE "ClasificacionPiloto" AS ENUM ('POSITIVO', 'NEGATIVO');

-- CreateEnum
CREATE TYPE "EstadoRecomendacion" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CONVERTIDA_REGLA', 'CONVERTIDA_EJEMPLO');

-- CreateTable
CREATE TABLE "ConversacionPiloto" (
    "id" TEXT NOT NULL,
    "clasificacion" "ClasificacionPiloto" NOT NULL,
    "explicacion" TEXT NOT NULL,
    "contenidoAnonimizado" JSONB,
    "intencion" TEXT,
    "tipoCliente" TEXT,
    "incluidaEnPerfil" BOOLEAN NOT NULL DEFAULT false,
    "anonimizadaEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "instanciaId" TEXT NOT NULL,
    "conversacionOrigenId" TEXT NOT NULL,
    "productoId" TEXT,
    "playbookEstrategiaId" TEXT,
    "creadaPorUsuarioId" TEXT,

    CONSTRAINT "ConversacionPiloto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecomendacionComportamiento" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "reglaSugerida" TEXT NOT NULL,
    "confianza" DOUBLE PRECISION NOT NULL,
    "estado" "EstadoRecomendacion" NOT NULL DEFAULT 'PENDIENTE',
    "basadaEnConversacionesPilotoIds" JSONB NOT NULL,
    "resueltaPorUsuarioId" TEXT,
    "resueltaEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "instanciaId" TEXT NOT NULL,
    "agenteIAConfigId" TEXT,
    "playbookEstrategiaAsociadoId" TEXT,

    CONSTRAINT "RecomendacionComportamiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EjemploPrompt" (
    "id" TEXT NOT NULL,
    "contenido" JSONB NOT NULL,
    "intencion" TEXT,
    "tipoCliente" TEXT,
    "calidad" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "instanciaId" TEXT NOT NULL,
    "agenteIAConfigId" TEXT,
    "conversacionPilotoOrigenId" TEXT NOT NULL,
    "productoId" TEXT,
    "playbookEstrategiaId" TEXT,

    CONSTRAINT "EjemploPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversacionPiloto_instanciaId_incluidaEnPerfil_idx" ON "ConversacionPiloto"("instanciaId", "incluidaEnPerfil");

-- CreateIndex
CREATE INDEX "RecomendacionComportamiento_instanciaId_estado_idx" ON "RecomendacionComportamiento"("instanciaId", "estado");

-- CreateIndex
CREATE INDEX "EjemploPrompt_instanciaId_activo_idx" ON "EjemploPrompt"("instanciaId", "activo");

-- AddForeignKey
ALTER TABLE "ConversacionPiloto" ADD CONSTRAINT "ConversacionPiloto_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversacionPiloto" ADD CONSTRAINT "ConversacionPiloto_conversacionOrigenId_fkey" FOREIGN KEY ("conversacionOrigenId") REFERENCES "Conversacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversacionPiloto" ADD CONSTRAINT "ConversacionPiloto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversacionPiloto" ADD CONSTRAINT "ConversacionPiloto_playbookEstrategiaId_fkey" FOREIGN KEY ("playbookEstrategiaId") REFERENCES "PlaybookEstrategia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversacionPiloto" ADD CONSTRAINT "ConversacionPiloto_creadaPorUsuarioId_fkey" FOREIGN KEY ("creadaPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecomendacionComportamiento" ADD CONSTRAINT "RecomendacionComportamiento_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecomendacionComportamiento" ADD CONSTRAINT "RecomendacionComportamiento_agenteIAConfigId_fkey" FOREIGN KEY ("agenteIAConfigId") REFERENCES "AgenteIAConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecomendacionComportamiento" ADD CONSTRAINT "RecomendacionComportamiento_playbookEstrategiaAsociadoId_fkey" FOREIGN KEY ("playbookEstrategiaAsociadoId") REFERENCES "PlaybookEstrategia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecomendacionComportamiento" ADD CONSTRAINT "RecomendacionComportamiento_resueltaPorUsuarioId_fkey" FOREIGN KEY ("resueltaPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EjemploPrompt" ADD CONSTRAINT "EjemploPrompt_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EjemploPrompt" ADD CONSTRAINT "EjemploPrompt_agenteIAConfigId_fkey" FOREIGN KEY ("agenteIAConfigId") REFERENCES "AgenteIAConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EjemploPrompt" ADD CONSTRAINT "EjemploPrompt_conversacionPilotoOrigenId_fkey" FOREIGN KEY ("conversacionPilotoOrigenId") REFERENCES "ConversacionPiloto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EjemploPrompt" ADD CONSTRAINT "EjemploPrompt_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EjemploPrompt" ADD CONSTRAINT "EjemploPrompt_playbookEstrategiaId_fkey" FOREIGN KEY ("playbookEstrategiaId") REFERENCES "PlaybookEstrategia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
