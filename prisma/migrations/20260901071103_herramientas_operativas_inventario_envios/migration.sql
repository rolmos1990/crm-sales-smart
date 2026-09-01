-- AlterTable
ALTER TABLE "AgenteIAConfig" ADD COLUMN     "accionesComercialesModoBorrador" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Cotizacion" ADD COLUMN     "confirmadoPorHumano" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "confirmadoPorUsuarioId" TEXT,
ADD COLUMN     "generadoPorIA" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "confirmadoPorHumano" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "confirmadoPorUsuarioId" TEXT,
ADD COLUMN     "generadoPorIA" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MetodoEntregaConfig" (
    "id" TEXT NOT NULL,
    "metodoEntrega" "MetodoEntrega" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "costoBase" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "diasEstimadosMin" INTEGER,
    "diasEstimadosMax" INTEGER,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "MetodoEntregaConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZonaCobertura" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "ZonaCobertura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZonaCoberturaMetodo" (
    "id" TEXT NOT NULL,
    "cubierta" BOOLEAN NOT NULL DEFAULT true,
    "costoAdicional" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "diasAdicionales" INTEGER NOT NULL DEFAULT 0,
    "zonaCoberturaId" TEXT NOT NULL,
    "metodoEntregaConfigId" TEXT NOT NULL,

    CONSTRAINT "ZonaCoberturaMetodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UbicacionRetiro" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "UbicacionRetiro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetodoEntregaConfig_instanciaId_idx" ON "MetodoEntregaConfig"("instanciaId");

-- CreateIndex
CREATE UNIQUE INDEX "MetodoEntregaConfig_instanciaId_metodoEntrega_key" ON "MetodoEntregaConfig"("instanciaId", "metodoEntrega");

-- CreateIndex
CREATE UNIQUE INDEX "ZonaCobertura_instanciaId_nombre_key" ON "ZonaCobertura"("instanciaId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "ZonaCoberturaMetodo_zonaCoberturaId_metodoEntregaConfigId_key" ON "ZonaCoberturaMetodo"("zonaCoberturaId", "metodoEntregaConfigId");

-- CreateIndex
CREATE INDEX "UbicacionRetiro_instanciaId_activo_idx" ON "UbicacionRetiro"("instanciaId", "activo");

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_confirmadoPorUsuarioId_fkey" FOREIGN KEY ("confirmadoPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_confirmadoPorUsuarioId_fkey" FOREIGN KEY ("confirmadoPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodoEntregaConfig" ADD CONSTRAINT "MetodoEntregaConfig_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZonaCobertura" ADD CONSTRAINT "ZonaCobertura_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZonaCoberturaMetodo" ADD CONSTRAINT "ZonaCoberturaMetodo_zonaCoberturaId_fkey" FOREIGN KEY ("zonaCoberturaId") REFERENCES "ZonaCobertura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZonaCoberturaMetodo" ADD CONSTRAINT "ZonaCoberturaMetodo_metodoEntregaConfigId_fkey" FOREIGN KEY ("metodoEntregaConfigId") REFERENCES "MetodoEntregaConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UbicacionRetiro" ADD CONSTRAINT "UbicacionRetiro_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
