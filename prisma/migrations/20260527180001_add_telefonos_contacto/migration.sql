-- Rename telefono → telefonoPrincipal and add telefonoSecundario
ALTER TABLE "Contacto" RENAME COLUMN "telefono" TO "telefonoPrincipal";
ALTER TABLE "Contacto" ADD COLUMN "telefonoSecundario" TEXT;
