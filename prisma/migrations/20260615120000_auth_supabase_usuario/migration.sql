-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('ACTIVO', 'INVITADO', 'SUSPENDIDO', 'BLOQUEADO');

-- AlterTable
ALTER TABLE "Usuario"
  ALTER COLUMN "passwordHash" DROP NOT NULL,
  ADD COLUMN "supabaseUserId" TEXT,
  ADD COLUMN "estado" "EstadoUsuario" NOT NULL DEFAULT 'INVITADO',
  ADD COLUMN "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bloqueadoHasta" TIMESTAMP(3),
  ADD COLUMN "nivelBloqueo" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ultimoLogin" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_supabaseUserId_key" ON "Usuario"("supabaseUserId");
