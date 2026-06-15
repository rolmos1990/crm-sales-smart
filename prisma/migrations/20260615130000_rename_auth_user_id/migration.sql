-- RenameColumn (desacopla el nombre del campo de auth de Supabase)
ALTER TABLE "Usuario" RENAME COLUMN "supabaseUserId" TO "authUserId";

-- RenameIndex
ALTER INDEX "Usuario_supabaseUserId_key" RENAME TO "Usuario_authUserId_key";
