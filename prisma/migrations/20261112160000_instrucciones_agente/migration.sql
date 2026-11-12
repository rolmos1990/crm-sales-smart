-- Bloque único de instrucciones del agente (Rol · Estilo · Proceso · Reglas).
-- Aditiva y nullable: un agente con NULL sigue generando su prompt desde los
-- campos estructurados de la 009 hasta que el backfill lo rellene
-- (scripts/backfill-instrucciones-agente.ts).

-- AlterTable
ALTER TABLE "AgenteIAConfig" ADD COLUMN     "instruccionesAgente" TEXT;
