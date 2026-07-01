-- CreateEnum
CREATE TYPE "TipoAgenteIA" AS ENUM ('COMERCIAL', 'GERENCIA');

-- AlterTable ProveedorIA: add tipoAgenteIA column
ALTER TABLE "ProveedorIA" ADD COLUMN "tipoAgenteIA" "TipoAgenteIA";

-- DropIndex old unique (instanciaId, proveedor)
DROP INDEX "ProveedorIA_instanciaId_proveedor_key";

-- CreateIndex new unique (instanciaId, proveedor, tipoAgenteIA)
CREATE UNIQUE INDEX "ProveedorIA_instanciaId_proveedor_tipoAgenteIA_key" ON "ProveedorIA"("instanciaId", "proveedor", "tipoAgenteIA");

-- AlterTable AgenteIAConfig: add tipo, drop proveedorPreferido
ALTER TABLE "AgenteIAConfig" ADD COLUMN "tipo" "TipoAgenteIA" NOT NULL DEFAULT 'COMERCIAL';
ALTER TABLE "AgenteIAConfig" DROP COLUMN "proveedorPreferido";

-- AlterTable PipelineStage: add respuestaIAHabilitada and agenteIAConfigId
ALTER TABLE "PipelineStage" ADD COLUMN "respuestaIAHabilitada" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PipelineStage" ADD COLUMN "agenteIAConfigId" TEXT;

-- AddForeignKey PipelineStage -> AgenteIAConfig
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_agenteIAConfigId_fkey" FOREIGN KEY ("agenteIAConfigId") REFERENCES "AgenteIAConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
