-- Quita las URLs de Meta guardadas en mensajes de Instagram/Messenger (048).
--
-- Solo datos, sin cambio de esquema. Hasta 048, un adjunto no reconocido
-- (Reel, publicación, mención en historia, sticker de Messenger…) quedaba como
-- TEXTO con la URL del CDN de Meta en "mediaUrl": una URL de un tercero, que
-- además expira. Ya no se puede recuperar ese contenido, así que se borra la
-- referencia y, si el mensaje no tenía texto, se le pone el aviso genérico
-- (TEXTO_HISTORICO_NO_DISPONIBLE en src/conversaciones/providers/instagram-adjuntos.ts).
--
-- Idempotente: una segunda ejecución no encuentra filas. Nunca toca un mensaje
-- con "mediaArchivoId" ni una URL propia: el patrón exige un host de Meta.
UPDATE "MensajeConversacion" m
SET "mediaUrl" = NULL,
    "contenido" = COALESCE(m."contenido", 'Contenido compartido que ya no está disponible')
FROM "Conversacion" c
JOIN "CuentaCanal" cc ON cc."id" = c."cuentaCanalId"
WHERE m."conversacionId" = c."id"
  AND cc."canal" IN ('instagram', 'facebook_messenger')
  AND m."mediaArchivoId" IS NULL
  AND m."mediaUrl" ~* '^https?://([a-z0-9-]+\.)*(fbcdn\.net|cdninstagram\.com|fbsbx\.com|facebook\.com|instagram\.com)(:[0-9]+)?(/|\?|$)';
