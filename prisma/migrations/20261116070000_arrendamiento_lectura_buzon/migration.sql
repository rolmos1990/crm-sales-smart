-- Arrendamiento de lectura del buzón: reemplaza el lock de sesión de
-- PostgreSQL (pg_try_advisory_lock), que no funciona a través de un
-- pooler en modo transacción. Columna nueva, opcional: nada existente
-- cambia de significado.

-- AlterTable
ALTER TABLE "BuzonCorreoEstado" ADD COLUMN     "leyendoDesde" TIMESTAMP(3);

