-- Formato de la respuesta del agente (markdown y emojis) como columnas
-- propias, y unificación de la longitud de respuesta en un solo campo.
--
-- Antes había dos fuentes para lo mismo: `configuracionTono.respuestaLarga`
-- (dentro del JSON) y la columna `longitudRespuesta`. Con LARGA + false el
-- prompt pedía a la vez respuestas detalladas y concisión. Acá se migra el
-- dato y se quitan las dos claves del JSON para que no quede una segunda
-- fuente de verdad.
--
-- El filtro es `jsonb_typeof(...) = 'object'`, no `IS NOT NULL`: hay filas con
-- el JSON escalar `null` guardado (no SQL NULL). `parsearTono` las trata como
-- "sin tono" y el prompt no emite ninguna línea de emojis para ellas, así que
-- deben quedar en NULL; y además el operador `-` sobre un JSON escalar falla.
ALTER TABLE "AgenteIAConfig" ADD COLUMN "formatoSinMarkdown" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AgenteIAConfig" ADD COLUMN "formatoEmojis" TEXT;

UPDATE "AgenteIAConfig"
   SET "longitudRespuesta" = 'LARGA'
 WHERE "longitudRespuesta" IS NULL
   AND jsonb_typeof("configuracionTono") = 'object'
   AND ("configuracionTono"->>'respuestaLarga') = 'true';

-- `usoEmojis` ausente dentro de un tono existente ya emitía "No uses emojis."
-- (la rama else de construirBloqueTono), así que 'SIN' es lo que preserva el
-- comportamiento; sin tono, NULL.
UPDATE "AgenteIAConfig"
   SET "formatoEmojis" = CASE
         WHEN ("configuracionTono"->>'usoEmojis') = 'true' THEN 'OCASIONALES'
         ELSE 'SIN'
       END
 WHERE jsonb_typeof("configuracionTono") = 'object';

UPDATE "AgenteIAConfig"
   SET "configuracionTono" = ("configuracionTono" - 'respuestaLarga') - 'usoEmojis'
 WHERE jsonb_typeof("configuracionTono") = 'object';
