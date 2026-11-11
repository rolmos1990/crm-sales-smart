-- Hotfix: la IA seguía respondiendo después de transferir a humano.
-- Aditiva: todas las conversaciones existentes quedan en AUTOMATICO
-- (comportamiento actual).

-- CreateEnum
CREATE TYPE "ModoAtencionConversacion" AS ENUM ('AUTOMATICO', 'WORKFLOW', 'HUMANO');

-- AlterTable
ALTER TABLE "Conversacion" ADD COLUMN     "modoAtencion" "ModoAtencionConversacion" NOT NULL DEFAULT 'AUTOMATICO',
ADD COLUMN     "atencionDesde" TIMESTAMP(3),
ADD COLUMN     "atencionMotivo" TEXT,
ADD COLUMN     "atencionUsuarioId" TEXT;
