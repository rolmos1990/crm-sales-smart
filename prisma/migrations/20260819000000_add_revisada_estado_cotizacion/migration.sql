-- Migración aditiva: agrega el valor "REVISADA" al enum EstadoCotizacion,
-- entre BORRADOR y APROBADA en el flujo manual de la cotización. No renombra
-- ni elimina ningún valor existente (BORRADOR, ENVIADA, APROBADA, RECHAZADA,
-- VENCIDA se mantienen tal cual) — las filas existentes no se ven afectadas.
--
-- Postgres exige que ALTER TYPE ... ADD VALUE corra fuera de una transacción
-- explícita que además lo use en la misma transacción; Prisma Migrate ya
-- ejecuta cada archivo de migración en su propia transacción individual, así
-- que este ALTER va solo en su propio archivo.
ALTER TYPE "EstadoCotizacion" ADD VALUE 'REVISADA';
