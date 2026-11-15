-- Icono del agente: una de las 8 claves del set de avatares
-- (ICONOS_AGENTE en src/configuracion/components/iconos-agente.tsx).
-- Aditiva y nullable: los agentes existentes quedan en NULL y siguen
-- mostrando el icono genérico actual.
ALTER TABLE "AgenteIAConfig" ADD COLUMN "iconoAgente" TEXT;
