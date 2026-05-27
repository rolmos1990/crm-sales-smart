-- CreateEnum
CREATE TYPE "TipoPlantilla" AS ENUM ('TEXTO', 'TEXTO_IMAGEN');

-- CreateTable
CREATE TABLE "ConfiguracionEmpresa" (
    "id" TEXT NOT NULL,
    "nombreEmpresa" TEXT,
    "nombreComercial" TEXT,
    "razonSocial" TEXT,
    "ruc" TEXT,
    "tipoNegocio" TEXT,
    "industria" TEXT,
    "correoPrincipal" TEXT,
    "telefonoPrincipal" TEXT,
    "whatsappPrincipal" TEXT,
    "sitioWeb" TEXT,
    "pais" TEXT,
    "provincia" TEXT,
    "ciudad" TEXT,
    "direccion" TEXT,
    "zonaHoraria" TEXT NOT NULL DEFAULT 'America/Lima',
    "monedaPrincipal" TEXT NOT NULL DEFAULT 'PEN',
    "idiomaPrincipal" TEXT NOT NULL DEFAULT 'es',
    "formatoFecha" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "formatoHora" TEXT NOT NULL DEFAULT '24h',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "ConfiguracionEmpresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantillaCRM" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" "TipoPlantilla" NOT NULL DEFAULT 'TEXTO',
    "contenidoTexto" TEXT,
    "imagenUrl" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "instanciaId" TEXT NOT NULL,
    "creadoPorId" TEXT,
    "actualizadoPorId" TEXT,

    CONSTRAINT "PlantillaCRM_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracionEmpresa_instanciaId_key" ON "ConfiguracionEmpresa"("instanciaId");

-- CreateIndex
CREATE INDEX "PlantillaCRM_instanciaId_idx" ON "PlantillaCRM"("instanciaId");

-- CreateIndex
CREATE INDEX "PlantillaCRM_alias_idx" ON "PlantillaCRM"("alias");

-- CreateIndex
CREATE INDEX "PlantillaCRM_activo_idx" ON "PlantillaCRM"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "PlantillaCRM_instanciaId_alias_key" ON "PlantillaCRM"("instanciaId", "alias");

-- AddForeignKey
ALTER TABLE "ConfiguracionEmpresa" ADD CONSTRAINT "ConfiguracionEmpresa_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantillaCRM" ADD CONSTRAINT "PlantillaCRM_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
