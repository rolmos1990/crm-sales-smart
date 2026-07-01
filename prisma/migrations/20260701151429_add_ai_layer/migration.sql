-- CreateEnum
CREATE TYPE "ProveedorIAEnum" AS ENUM ('ANTHROPIC', 'OPENAI', 'GEMINI', 'DEEPSEEK', 'LOCAL');

-- CreateEnum
CREATE TYPE "TareaIA" AS ENUM ('CHAT', 'RESUMEN', 'CLASIFICACION', 'SENTIMIENTO', 'EXTRACCION_ENTIDADES', 'REPORTE', 'EMBEDDINGS');

-- CreateEnum
CREATE TYPE "TipoMemoriaIA" AS ENUM ('EPISODICO', 'SEMANTICO', 'PROCEDURAL');

-- CreateTable
CREATE TABLE "ConfiguracionIA" (
    "id" TEXT NOT NULL,
    "habilitado" BOOLEAN NOT NULL DEFAULT false,
    "proveedorDefault" "ProveedorIAEnum" NOT NULL DEFAULT 'ANTHROPIC',
    "modeloDefault" TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    "temperaturaDefault" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "limiteTokensDiarios" INTEGER,
    "limiteTokensMensual" INTEGER,
    "fallbackHabilitado" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "ConfiguracionIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProveedorIA" (
    "id" TEXT NOT NULL,
    "proveedor" "ProveedorIAEnum" NOT NULL,
    "apiKeyEncriptada" TEXT,
    "baseUrl" TEXT,
    "modelosDisponibles" JSONB NOT NULL DEFAULT '[]',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "prioridad" INTEGER NOT NULL DEFAULT 1,
    "limitePorMinuto" INTEGER,
    "limitePorDia" INTEGER,
    "costoInputPorMilToken" DECIMAL(65,30),
    "costoOutputPorMilToken" DECIMAL(65,30),
    "timeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "reintentosMax" INTEGER NOT NULL DEFAULT 2,
    "casosDeUso" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "ProveedorIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgenteIAConfig" (
    "id" TEXT NOT NULL,
    "sistemaPrompt" TEXT,
    "personalidad" TEXT,
    "objetivo" TEXT,
    "especialidad" TEXT,
    "temperaturaOverride" DOUBLE PRECISION,
    "modeloPreferido" TEXT,
    "proveedorPreferido" "ProveedorIAEnum",
    "herramientas" JSONB,
    "canalesPermitidos" JSONB,
    "memoriaHabilitada" BOOLEAN NOT NULL DEFAULT true,
    "limiteTokensCtx" INTEGER NOT NULL DEFAULT 4000,
    "instrucciones" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "AgenteIAConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoriaAgenteIA" (
    "id" TEXT NOT NULL,
    "tipo" "TipoMemoriaIA" NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agenteIAConfigId" TEXT NOT NULL,

    CONSTRAINT "MemoriaAgenteIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsoIA" (
    "id" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "tarea" "TareaIA" NOT NULL,
    "tokensInput" INTEGER NOT NULL DEFAULT 0,
    "tokensOutput" INTEGER NOT NULL DEFAULT 0,
    "costoEstimado" DECIMAL(65,30),
    "tiempoMs" INTEGER NOT NULL DEFAULT 0,
    "exito" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "entidadTipo" TEXT,
    "entidadId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "instanciaId" TEXT NOT NULL,
    "proveedorIAId" TEXT,
    "agenteIAConfigId" TEXT,

    CONSTRAINT "UsoIA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracionIA_instanciaId_key" ON "ConfiguracionIA"("instanciaId");

-- CreateIndex
CREATE INDEX "ProveedorIA_instanciaId_idx" ON "ProveedorIA"("instanciaId");

-- CreateIndex
CREATE INDEX "ProveedorIA_instanciaId_activo_prioridad_idx" ON "ProveedorIA"("instanciaId", "activo", "prioridad");

-- CreateIndex
CREATE UNIQUE INDEX "ProveedorIA_instanciaId_proveedor_key" ON "ProveedorIA"("instanciaId", "proveedor");

-- CreateIndex
CREATE UNIQUE INDEX "AgenteIAConfig_usuarioId_key" ON "AgenteIAConfig"("usuarioId");

-- CreateIndex
CREATE INDEX "MemoriaAgenteIA_agenteIAConfigId_tipo_idx" ON "MemoriaAgenteIA"("agenteIAConfigId", "tipo");

-- CreateIndex
CREATE INDEX "MemoriaAgenteIA_expiraEn_idx" ON "MemoriaAgenteIA"("expiraEn");

-- CreateIndex
CREATE INDEX "UsoIA_instanciaId_creadoEn_idx" ON "UsoIA"("instanciaId", "creadoEn");

-- CreateIndex
CREATE INDEX "UsoIA_instanciaId_tarea_idx" ON "UsoIA"("instanciaId", "tarea");

-- CreateIndex
CREATE INDEX "UsoIA_proveedorIAId_idx" ON "UsoIA"("proveedorIAId");

-- CreateIndex
CREATE INDEX "Oportunidad_instanciaId_id_idx" ON "Oportunidad"("instanciaId", "id");

-- CreateIndex
CREATE INDEX "OportunidadContacto_oportunidadId_principal_idx" ON "OportunidadContacto"("oportunidadId", "principal");

-- AddForeignKey
ALTER TABLE "ConfiguracionIA" ADD CONSTRAINT "ConfiguracionIA_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProveedorIA" ADD CONSTRAINT "ProveedorIA_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgenteIAConfig" ADD CONSTRAINT "AgenteIAConfig_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgenteIAConfig" ADD CONSTRAINT "AgenteIAConfig_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoriaAgenteIA" ADD CONSTRAINT "MemoriaAgenteIA_agenteIAConfigId_fkey" FOREIGN KEY ("agenteIAConfigId") REFERENCES "AgenteIAConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsoIA" ADD CONSTRAINT "UsoIA_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsoIA" ADD CONSTRAINT "UsoIA_proveedorIAId_fkey" FOREIGN KEY ("proveedorIAId") REFERENCES "ProveedorIA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsoIA" ADD CONSTRAINT "UsoIA_agenteIAConfigId_fkey" FOREIGN KEY ("agenteIAConfigId") REFERENCES "AgenteIAConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
