-- DropForeignKey
ALTER TABLE "PreparacionHistorial" DROP CONSTRAINT "PreparacionHistorial_estadoId_fkey";

-- AlterTable
ALTER TABLE "PreparacionHistorial" ALTER COLUMN "estadoId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "PreparacionHistorial" ADD CONSTRAINT "PreparacionHistorial_estadoId_fkey" FOREIGN KEY ("estadoId") REFERENCES "EstadoPreparacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

