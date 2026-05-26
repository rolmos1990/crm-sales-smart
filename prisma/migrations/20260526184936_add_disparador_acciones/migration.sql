-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoAccionDisparador" ADD VALUE 'ASIGNAR_ETIQUETA';
ALTER TYPE "TipoAccionDisparador" ADD VALUE 'MODIFICAR_CAMPO';
ALTER TYPE "TipoAccionDisparador" ADD VALUE 'CAMBIAR_ETAPA';
