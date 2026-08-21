-- CreateEnum
CREATE TYPE "EstadoFlujoVentaRegla" AS ENUM ('BORRADOR', 'PUBLICADA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OperadorCondicion" ADD VALUE 'NO_CONTIENE';
ALTER TYPE "OperadorCondicion" ADD VALUE 'ESTA_VACIO';
ALTER TYPE "OperadorCondicion" ADD VALUE 'NO_ESTA_VACIO';
ALTER TYPE "OperadorCondicion" ADD VALUE 'EMPIEZA_CON';
ALTER TYPE "OperadorCondicion" ADD VALUE 'TERMINA_CON';
ALTER TYPE "OperadorCondicion" ADD VALUE 'MAYOR_IGUAL';
ALTER TYPE "OperadorCondicion" ADD VALUE 'MENOR_IGUAL';
ALTER TYPE "OperadorCondicion" ADD VALUE 'ENTRE';
ALTER TYPE "OperadorCondicion" ADD VALUE 'ESTA_EN';
ALTER TYPE "OperadorCondicion" ADD VALUE 'NO_ESTA_EN';
ALTER TYPE "OperadorCondicion" ADD VALUE 'ANTES_DE';
ALTER TYPE "OperadorCondicion" ADD VALUE 'DESPUES_DE';
ALTER TYPE "OperadorCondicion" ADD VALUE 'ENTRE_FECHAS';
ALTER TYPE "OperadorCondicion" ADD VALUE 'ESTA_VENCIDA';
ALTER TYPE "OperadorCondicion" ADD VALUE 'ES_HOY';
ALTER TYPE "OperadorCondicion" ADD VALUE 'PROXIMOS_N_DIAS';
ALTER TYPE "OperadorCondicion" ADD VALUE 'CONTIENE_ALGUNO';
ALTER TYPE "OperadorCondicion" ADD VALUE 'CONTIENE_TODOS';
ALTER TYPE "OperadorCondicion" ADD VALUE 'NO_CONTIENE_COLECCION';
ALTER TYPE "OperadorCondicion" ADD VALUE 'COLECCION_VACIA';
ALTER TYPE "OperadorCondicion" ADD VALUE 'COLECCION_NO_VACIA';
ALTER TYPE "OperadorCondicion" ADD VALUE 'CANTIDAD_IGUAL';
ALTER TYPE "OperadorCondicion" ADD VALUE 'CANTIDAD_MAYOR';
ALTER TYPE "OperadorCondicion" ADD VALUE 'CANTIDAD_MENOR';
ALTER TYPE "OperadorCondicion" ADD VALUE 'ADJUNTO';
ALTER TYPE "OperadorCondicion" ADD VALUE 'NO_ADJUNTO';

-- AlterTable
ALTER TABLE "FlujoVentaRegla" ADD COLUMN     "actualizadoPorId" TEXT,
ADD COLUMN     "arbolCondiciones" JSONB,
ADD COLUMN     "creadoPorId" TEXT,
ADD COLUMN     "estado" "EstadoFlujoVentaRegla" NOT NULL DEFAULT 'PUBLICADA',
ADD COLUMN     "mensajeFallo" TEXT,
ADD COLUMN     "mostrarPendientes" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;
