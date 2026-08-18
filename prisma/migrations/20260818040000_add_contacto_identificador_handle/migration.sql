-- Migración aditiva: agrega el "handle" (usuario visible, ej. @ramonu1990 en
-- Instagram) al identificador de canal de un contacto. Opcional, no afecta
-- filas existentes ni ningún otro campo.

-- AlterTable
ALTER TABLE "ContactoIdentificadorCanal" ADD COLUMN "handle" TEXT;
