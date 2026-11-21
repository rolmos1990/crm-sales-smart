-- 049-proveedores-de-voz (prerequisito, research.md R1)
--
-- Migración SOLO DE DATOS: reconstruye el vínculo MensajeConversacion ->
-- MediaArchivo que nunca llegó a persistirse.
--
-- El webhook y el encolador de WhatsApp producen `mediaArchivoId` y el
-- contrato del comando lo declara (procesar-entrante.comando.ts), pero los dos
-- suscriptores que rearman el payload copiaban campo por campo y lo
-- descartaban. Resultado: la columna quedó NULL en el 100% de los mensajes con
-- media, el MediaArchivo nunca se vinculaba al contacto, y no había forma de
-- llegar desde un mensaje a su archivo.
--
-- La 048 lo agravó sin notarlo: construyó toda la cadena de reubicación para
-- producir ese id (reubicacion.ts) y el suscriptor lo seguía tirando.
--
-- Se enlaza por la URL de storage, que es propia y única por archivo. El scope
-- por instanciaId es obligatorio: dos cuentas nunca se cruzan acá.
--
-- DETERMINISMO: se exige que la URL resuelva a EXACTAMENTE UN MediaArchivo.
-- No es teórico — hay 3 filas con `urlOptimizada = ''` (subidas de
-- application/octet-stream que fallaron sin dejar URL). Sin el filtro, un
-- mensaje con mediaUrl vacío engancharía una de las tres al azar, porque
-- UPDATE ... FROM con join no único elige una fila arbitraria. El HAVING
-- COUNT(*) = 1 y el descarte de la cadena vacía lo vuelven reproducible.
--
-- Idempotente: solo toca filas con mediaArchivoId NULL, y no modifica ningún
-- otro campo. Correrla dos veces no cambia nada.

WITH unicos AS (
  SELECT "instanciaId", "urlOptimizada", MIN(id) AS media_id
  FROM "MediaArchivo"
  WHERE "urlOptimizada" <> ''
  GROUP BY "instanciaId", "urlOptimizada"
  HAVING COUNT(*) = 1
)
UPDATE "MensajeConversacion" m
SET "mediaArchivoId" = u.media_id
FROM "Conversacion" c, unicos u
WHERE c.id = m."conversacionId"
  AND u."urlOptimizada" = m."mediaUrl"
  AND u."instanciaId" = c."instanciaId"
  AND m."mediaArchivoId" IS NULL
  AND m."mediaUrl" IS NOT NULL
  AND m."mediaUrl" <> '';

-- Y el contacto en el archivo, que dependía del mismo id y por eso tampoco se
-- escribía nunca (ver el update previo al create en conversaciones/actions.ts).
-- Mismo criterio de determinismo: si dos contactos distintos comparten un
-- archivo deduplicado por hash, no se toca — no hay un dueño correcto.
WITH un_solo_contacto AS (
  SELECT m."mediaArchivoId" AS media_id, MIN(c."contactoId") AS contacto_id
  FROM "MensajeConversacion" m
  JOIN "Conversacion" c ON c.id = m."conversacionId"
  WHERE m."mediaArchivoId" IS NOT NULL
  GROUP BY m."mediaArchivoId"
  HAVING COUNT(DISTINCT c."contactoId") = 1
)
UPDATE "MediaArchivo" ma
SET "contactoId" = u.contacto_id
FROM un_solo_contacto u
WHERE ma.id = u.media_id
  AND ma."contactoId" IS NULL;
