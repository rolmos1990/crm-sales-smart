-- Ícono por etapa del pipeline (046).
--
-- Aditiva y nullable a propósito: las etapas existentes quedan en NULL y el
-- tablero les pone un ícono por defecto, así que no hace falta backfill ni
-- hay ventana en la que una etapa quede sin representación visual.
ALTER TABLE "PipelineStage" ADD COLUMN "icono" TEXT;
