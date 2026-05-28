-- DropForeignKey
ALTER TABLE "Conversacion" DROP CONSTRAINT "Conversacion_cuentaCanalId_fkey";

-- DropForeignKey
ALTER TABLE "Conversacion" DROP CONSTRAINT "Conversacion_instanciaId_fkey";

-- AlterTable
ALTER TABLE "Conversacion" ALTER COLUMN "cuentaCanalId" DROP NOT NULL,
ALTER COLUMN "instanciaId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Conversacion" ADD CONSTRAINT "Conversacion_cuentaCanalId_fkey" FOREIGN KEY ("cuentaCanalId") REFERENCES "CuentaCanal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversacion" ADD CONSTRAINT "Conversacion_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
