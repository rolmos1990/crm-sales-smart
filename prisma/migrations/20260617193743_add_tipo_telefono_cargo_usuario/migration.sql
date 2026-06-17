-- CreateEnum
CREATE TYPE "TipoUsuario" AS ENUM ('USUARIO', 'AGENTE');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "cargo" TEXT,
ADD COLUMN     "telefono" TEXT,
ADD COLUMN     "tipo" "TipoUsuario" NOT NULL DEFAULT 'USUARIO';
