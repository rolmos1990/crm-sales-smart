-- CreateEnum
CREATE TYPE "ModoAplicacionInteres" AS ENUM ('SOLO_SUGERIR', 'APLICAR_AUTOMATICO');

-- CreateEnum
CREATE TYPE "EstadoColaAnalisis" AS ENUM ('AL_DIA', 'PENDIENTE', 'EN_PROCESO', 'FALLIDO');

-- CreateEnum
CREATE TYPE "PrioridadAnalisis" AS ENUM ('P0', 'P1', 'P2');

-- CreateEnum
CREATE TYPE "TipoEjecucionAnalisis" AS ENUM ('INICIAL', 'INCREMENTAL', 'REEVALUACION');

-- CreateEnum
CREATE TYPE "ModoEjecucionAnalisis" AS ENUM ('REGLAS', 'IA');

-- CreateEnum
CREATE TYPE "EstadoEjecucionAnalisis" AS ENUM ('PENDIENTE', 'EN_CURSO', 'COMPLETADA', 'PARCIAL', 'FALLIDA', 'CANCELADA', 'ABANDONADA');

-- CreateEnum
CREATE TYPE "EstadoItemAnalisis" AS ENUM ('EXITOSO', 'OMITIDO', 'INVALIDO', 'DESCARTADO_VERSION', 'FALLIDO');

-- CreateEnum
CREATE TYPE "OrigenEvaluacion" AS ENUM ('REGLA', 'IA');

-- CreateEnum
CREATE TYPE "RelacionComercial" AS ENUM ('PROSPECTO', 'CLIENTE', 'CLIENTE_RECURRENTE', 'CLIENTE_INACTIVO');

-- CreateEnum
CREATE TYPE "IntencionCompra" AS ENUM ('ALTA', 'MEDIA', 'BAJA', 'DESCONOCIDA');

-- CreateEnum
CREATE TYPE "NivelUrgencia" AS ENUM ('ALTA', 'MEDIA', 'BAJA');

-- CreateEnum
CREATE TYPE "NivelRecuperacion" AS ENUM ('ALTA', 'MEDIA', 'BAJA', 'NO_APLICA');

-- CreateEnum
CREATE TYPE "AccionComercial" AS ENUM ('RESPONDER', 'NO_CONTACTAR', 'CONTACTAR_HOY', 'ENVIAR_COTIZACION', 'DAR_SEGUIMIENTO', 'RESOLVER_OBJECION', 'REACTIVAR', 'OFRECER_NOVEDADES', 'ESPERAR', 'SIN_ACCION');

-- CreateEnum
CREATE TYPE "EstadoSugerencia" AS ENUM ('PENDIENTE', 'ACEPTADA', 'DESCARTADA', 'REEMPLAZADA');

-- CreateEnum
CREATE TYPE "EstadoVersionCriterio" AS ENUM ('BORRADOR', 'PUBLICADA', 'ARCHIVADA');

-- AlterEnum
ALTER TYPE "TareaIA" ADD VALUE 'ANALISIS_CONTACTOS';

-- AlterTable
ALTER TABLE "Contacto" ADD COLUMN     "puntajeComercial" INTEGER;

-- AlterTable
ALTER TABLE "UsoIA" ADD COLUMN     "tokensCacheados" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ConfiguracionAnalisisContactos" (
    "id" TEXT NOT NULL,
    "habilitado" BOOLEAN NOT NULL DEFAULT true,
    "modoInteres" "ModoAplicacionInteres" NOT NULL DEFAULT 'SOLO_SUGERIR',
    "mesesAntiguedadInicial" INTEGER NOT NULL DEFAULT 12,
    "tamanoLote" INTEGER NOT NULL DEFAULT 20,
    "maxLotesSimultaneos" INTEGER NOT NULL DEFAULT 1,
    "presupuestoDiarioCosto" DECIMAL(65,30),
    "presupuestoDiarioTokens" INTEGER,
    "ventanaAgrupacionSeg" INTEGER NOT NULL DEFAULT 300,
    "esperaMaximaSeg" INTEGER NOT NULL DEFAULT 1800,
    "historicoPausado" BOOLEAN NOT NULL DEFAULT false,
    "peso" INTEGER NOT NULL DEFAULT 1,
    "siguienteTurnoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lotesEnCurso" INTEGER NOT NULL DEFAULT 0,
    "ultimaAtencionEn" TIMESTAMP(3),
    "modoInteresCambiadoPorId" TEXT,
    "modoInteresCambiadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "ConfiguracionAnalisisContactos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactoAnalisisCola" (
    "id" TEXT NOT NULL,
    "estado" "EstadoColaAnalisis" NOT NULL DEFAULT 'PENDIENTE',
    "prioridad" "PrioridadAnalisis" NOT NULL DEFAULT 'P2',
    "tipo" "TipoEjecucionAnalisis" NOT NULL DEFAULT 'INCREMENTAL',
    "versionDatos" BIGINT NOT NULL DEFAULT 1,
    "versionReclamada" BIGINT,
    "forzarIA" BOOLEAN NOT NULL DEFAULT false,
    "primerMarcadoEn" TIMESTAMP(3),
    "elegibleDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "datosHasta" TIMESTAMP(3),
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" TIMESTAMP(3),
    "ultimaEjecucionId" TEXT,
    "motivo" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "contactoId" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "ContactoAnalisisCola_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactoEvaluacion" (
    "id" TEXT NOT NULL,
    "origen" "OrigenEvaluacion" NOT NULL,
    "relacionComercial" "RelacionComercial" NOT NULL,
    "puntaje" INTEGER NOT NULL,
    "puntajeBase" INTEGER NOT NULL,
    "ajusteIA" INTEGER,
    "intencion" "IntencionCompra",
    "urgencia" "NivelUrgencia",
    "recuperacion" "NivelRecuperacion",
    "senalesReglas" JSONB NOT NULL DEFAULT '[]',
    "motivosReglas" JSONB NOT NULL DEFAULT '[]',
    "senales" JSONB NOT NULL DEFAULT '[]',
    "objeciones" JSONB NOT NULL DEFAULT '[]',
    "motivos" JSONB NOT NULL DEFAULT '[]',
    "accionIA" "AccionComercial",
    "accionSugerida" "AccionComercial" NOT NULL,
    "versionEvaluada" BIGINT NOT NULL,
    "iaHasta" TIMESTAMP(3),
    "evaluadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluadoIAEn" TIMESTAMP(3),
    "proximaEvaluacionEn" TIMESTAMP(3),
    "plantillaAplicada" TEXT,
    "ejecucionId" TEXT,
    "interesSugerido" "NivelInteres",
    "interesSugeridoEstado" "EstadoSugerencia",
    "noContactarSugerido" BOOLEAN NOT NULL DEFAULT false,
    "noContactarMotivo" TEXT,
    "noContactarSugeridoEstado" "EstadoSugerencia",
    "noContactarResueltoEn" TIMESTAMP(3),
    "sugerenciaResueltaPorId" TEXT,
    "sugerenciaResueltaEn" TIMESTAMP(3),
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "criterioVersionId" TEXT,
    "contactoId" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "ContactoEvaluacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriterioAnalisisContactos" (
    "id" TEXT NOT NULL,
    "versionPublicadaId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "CriterioAnalisisContactos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriterioAnalisisContactosVersion" (
    "id" TEXT NOT NULL,
    "numero" INTEGER,
    "estado" "EstadoVersionCriterio" NOT NULL,
    "plantillaOrigen" TEXT NOT NULL,
    "contenido" JSONB NOT NULL,
    "publicadaEn" TIMESTAMP(3),
    "creadaPorId" TEXT,
    "publicadaPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "criterioId" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "CriterioAnalisisContactosVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EjecucionAnalisisContactos" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "loteRaizId" TEXT,
    "intento" INTEGER NOT NULL DEFAULT 1,
    "tipo" "TipoEjecucionAnalisis" NOT NULL,
    "prioridad" "PrioridadAnalisis" NOT NULL,
    "modo" "ModoEjecucionAnalisis" NOT NULL,
    "estado" "EstadoEjecucionAnalisis" NOT NULL DEFAULT 'EN_CURSO',
    "proveedor" TEXT,
    "modelo" TEXT,
    "configAplicada" JSONB NOT NULL DEFAULT '{}',
    "contactosPedidos" INTEGER NOT NULL DEFAULT 0,
    "contactosProcesados" INTEGER NOT NULL DEFAULT 0,
    "contactosExitosos" INTEGER NOT NULL DEFAULT 0,
    "contactosFallidos" INTEGER NOT NULL DEFAULT 0,
    "tokensEntrada" INTEGER NOT NULL DEFAULT 0,
    "tokensSalida" INTEGER NOT NULL DEFAULT 0,
    "tokensCacheados" INTEGER NOT NULL DEFAULT 0,
    "costoEstimado" DECIMAL(65,30),
    "usoIAId" TEXT,
    "duracionMs" INTEGER,
    "esperaColaMs" INTEGER,
    "iniciadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadoEn" TIMESTAMP(3),
    "leaseHasta" TIMESTAMP(3) NOT NULL,
    "errorCodigo" TEXT,
    "errorMensaje" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proveedorIAId" TEXT,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "EjecucionAnalisisContactos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EjecucionAnalisisContactosItem" (
    "id" TEXT NOT NULL,
    "contactoId" TEXT NOT NULL,
    "estado" "EstadoItemAnalisis" NOT NULL,
    "antes" JSONB,
    "despues" JSONB,
    "motivo" TEXT,
    "errorCodigo" TEXT,
    "procesadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ejecucionId" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "EjecucionAnalisisContactosItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumenDiarioAnalisisContactos" (
    "id" TEXT NOT NULL,
    "dia" TEXT NOT NULL,
    "atenciones" INTEGER NOT NULL DEFAULT 0,
    "atencionesFallidas" INTEGER NOT NULL DEFAULT 0,
    "contactosEvaluados" INTEGER NOT NULL DEFAULT 0,
    "contactosPorReglas" INTEGER NOT NULL DEFAULT 0,
    "contactosConIA" INTEGER NOT NULL DEFAULT 0,
    "contactosFallidos" INTEGER NOT NULL DEFAULT 0,
    "tokensEntrada" INTEGER NOT NULL DEFAULT 0,
    "tokensSalida" INTEGER NOT NULL DEFAULT 0,
    "tokensCacheados" INTEGER NOT NULL DEFAULT 0,
    "costoEstimado" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "duracionTotalMs" BIGINT NOT NULL DEFAULT 0,
    "esperaTotalMs" BIGINT NOT NULL DEFAULT 0,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "ResumenDiarioAnalisisContactos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracionAnalisisContactos_instanciaId_key" ON "ConfiguracionAnalisisContactos"("instanciaId");

-- CreateIndex
CREATE INDEX "ConfiguracionAnalisisContactos_habilitado_siguienteTurnoEn_idx" ON "ConfiguracionAnalisisContactos"("habilitado", "siguienteTurnoEn");

-- CreateIndex
CREATE UNIQUE INDEX "ContactoAnalisisCola_contactoId_key" ON "ContactoAnalisisCola"("contactoId");

-- CreateIndex
CREATE INDEX "ContactoAnalisisCola_instanciaId_estado_idx" ON "ContactoAnalisisCola"("instanciaId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "ContactoEvaluacion_contactoId_key" ON "ContactoEvaluacion"("contactoId");

-- CreateIndex
CREATE INDEX "ContactoEvaluacion_instanciaId_proximaEvaluacionEn_idx" ON "ContactoEvaluacion"("instanciaId", "proximaEvaluacionEn");

-- CreateIndex
CREATE INDEX "ContactoEvaluacion_instanciaId_interesSugeridoEstado_idx" ON "ContactoEvaluacion"("instanciaId", "interesSugeridoEstado");

-- CreateIndex
CREATE UNIQUE INDEX "CriterioAnalisisContactos_versionPublicadaId_key" ON "CriterioAnalisisContactos"("versionPublicadaId");

-- CreateIndex
CREATE UNIQUE INDEX "CriterioAnalisisContactos_instanciaId_key" ON "CriterioAnalisisContactos"("instanciaId");

-- CreateIndex
CREATE INDEX "CriterioAnalisisContactosVersion_criterioId_estado_idx" ON "CriterioAnalisisContactosVersion"("criterioId", "estado");

-- CreateIndex
CREATE INDEX "CriterioAnalisisContactosVersion_instanciaId_idx" ON "CriterioAnalisisContactosVersion"("instanciaId");

-- CreateIndex
CREATE INDEX "EjecucionAnalisisContactos_instanciaId_creadoEn_idx" ON "EjecucionAnalisisContactos"("instanciaId", "creadoEn");

-- CreateIndex
CREATE INDEX "EjecucionAnalisisContactos_estado_leaseHasta_idx" ON "EjecucionAnalisisContactos"("estado", "leaseHasta");

-- CreateIndex
CREATE INDEX "EjecucionAnalisisContactos_loteId_idx" ON "EjecucionAnalisisContactos"("loteId");

-- CreateIndex
CREATE INDEX "EjecucionAnalisisContactosItem_instanciaId_contactoId_proce_idx" ON "EjecucionAnalisisContactosItem"("instanciaId", "contactoId", "procesadoEn");

-- CreateIndex
CREATE INDEX "EjecucionAnalisisContactosItem_procesadoEn_idx" ON "EjecucionAnalisisContactosItem"("procesadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "ResumenDiarioAnalisisContactos_instanciaId_dia_key" ON "ResumenDiarioAnalisisContactos"("instanciaId", "dia");

-- CreateIndex
CREATE INDEX "Contacto_instanciaId_puntajeComercial_idx" ON "Contacto"("instanciaId", "puntajeComercial");

-- CreateIndex
CREATE INDEX "Contacto_instanciaId_creadoEn_idx" ON "Contacto"("instanciaId", "creadoEn");

-- AddForeignKey
ALTER TABLE "ConfiguracionAnalisisContactos" ADD CONSTRAINT "ConfiguracionAnalisisContactos_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactoAnalisisCola" ADD CONSTRAINT "ContactoAnalisisCola_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "Contacto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactoAnalisisCola" ADD CONSTRAINT "ContactoAnalisisCola_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactoEvaluacion" ADD CONSTRAINT "ContactoEvaluacion_criterioVersionId_fkey" FOREIGN KEY ("criterioVersionId") REFERENCES "CriterioAnalisisContactosVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactoEvaluacion" ADD CONSTRAINT "ContactoEvaluacion_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "Contacto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactoEvaluacion" ADD CONSTRAINT "ContactoEvaluacion_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterioAnalisisContactos" ADD CONSTRAINT "CriterioAnalisisContactos_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterioAnalisisContactosVersion" ADD CONSTRAINT "CriterioAnalisisContactosVersion_criterioId_fkey" FOREIGN KEY ("criterioId") REFERENCES "CriterioAnalisisContactos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterioAnalisisContactosVersion" ADD CONSTRAINT "CriterioAnalisisContactosVersion_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EjecucionAnalisisContactos" ADD CONSTRAINT "EjecucionAnalisisContactos_proveedorIAId_fkey" FOREIGN KEY ("proveedorIAId") REFERENCES "ProveedorIA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EjecucionAnalisisContactos" ADD CONSTRAINT "EjecucionAnalisisContactos_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EjecucionAnalisisContactosItem" ADD CONSTRAINT "EjecucionAnalisisContactosItem_ejecucionId_fkey" FOREIGN KEY ("ejecucionId") REFERENCES "EjecucionAnalisisContactos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EjecucionAnalisisContactosItem" ADD CONSTRAINT "EjecucionAnalisisContactosItem_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumenDiarioAnalisisContactos" ADD CONSTRAINT "ResumenDiarioAnalisisContactos_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 042 — Índices parciales de la cola (Prisma no los modela). El primero
-- sostiene el EXISTS del planificador y el reclamo de lotes por cuenta y
-- prioridad; el segundo, la recuperación de leases vencidos.
CREATE INDEX "ContactoAnalisisCola_pendientes_idx"
  ON "ContactoAnalisisCola" ("instanciaId", "prioridad", "elegibleDesde")
  WHERE "estado" = 'PENDIENTE';

CREATE INDEX "ContactoAnalisisCola_en_proceso_idx"
  ON "ContactoAnalisisCola" ("bloqueadoHasta")
  WHERE "estado" = 'EN_PROCESO';
