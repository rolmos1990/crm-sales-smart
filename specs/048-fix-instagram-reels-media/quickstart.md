# Quickstart: validar 048

**Prerequisitos**:
- App y worker corriendo (`npm run dev` + worker).
- Una cuenta de Instagram profesional conectada en Karia.
- Una cuenta personal de prueba para enviar DMs.
- Acceso a los logs de la app.

Tests unitarios: `npm run test:unit -- src/conversaciones/providers src/app/api/webhooks src/app/cdn`

## 0. Captura de payloads reales (antes de cerrar research R1)

1. Desde la cuenta de prueba, enviar por DM a la cuenta conectada:
   - Un Reel compartido.
   - Una publicación compartida.
   - Una mención en historia de foto y otra de video.
   - Una respuesta a historia.
2. En el log `IG_WEBHOOK_POST`, anotar los `attachments[].type` y las claves de `payload` reales, en especial si el Reel trae `title`.
3. **Esperado**: todos los tipos caen en alguna familia de research R1. Si aparece otro string, agregarlo antes de continuar.

## 1. Ninguna URL de Meta (US1)

1. Enviar los contenidos del paso 0, más un sticker.
2. Consultar en la base los mensajes recién creados de esa conversación.
3. **Esperado**:
   - `mediaUrl` es NULL o pertenece al storage de Karia (`/cdn/…`, `/uploads/…` o el dominio propio del bucket).
   - Ninguna contiene `fbcdn`, `cdninstagram`, `fbsbx`, `instagram.com` ni `facebook.com`.
   - El Reel tiene `mediaUrl` NULL y no generó ningún `MediaArchivo`.
4. Repetir con un sticker o enlace por Facebook Messenger. **Esperado**: igual.

## 2. Video directo reproducible y bien visto (US2)

1. Enviar por DM un video vertical (grabado con el celular) y uno horizontal.
2. Abrir la conversación en Chrome, Edge, Firefox y Safari de escritorio, y en Safari iOS y Chrome Android.
3. **Esperado en cada navegador**:
   - Antes de reproducir se ve un cuadro del video.
   - Se reproduce, se pausa, se adelanta a la mitad sin esperar la descarga completa y entra a pantalla completa.
   - El vertical no se deforma ni desborda la burbuja.
   - En iOS no salta solo a pantalla completa al reproducir.
4. En DevTools, con el storage sirviendo por `/cdn`: al adelantar se ven respuestas `206` con `Content-Range`.
5. Forzar un video `.mov` (por ejemplo, desde WhatsApp) y abrirlo en Firefox. **Esperado**: aviso "no se puede reproducir" y botón de descarga, sin reproductor roto.

## 3. Reels, publicaciones e historias identificables (US3)

1. Abrir la conversación del paso 0.
2. **Esperado**:
   - Ningún mensaje muestra "Este contenido no puede visualizarse".
   - Reel: solo el texto "Compartió un Reel…", sin imagen, reproductor ni enlace.
   - Publicación e historia de foto: la imagen con el texto debajo.
   - Historia de video: solo el texto.
   - Respuesta a historia: "Respondió a tu historia: …".
3. Con un agente IA activo en la cuenta, enviar un Reel. **Esperado**: la respuesta de la IA hace referencia al Reel compartido.

## 4. Cero regresión (FR-010)

1. Enviar por Instagram un texto, una imagen directa y una nota de voz. Reaccionar a un mensaje desde Instagram.
2. **Esperado**:
   - Todo se ve igual que antes de 048: la imagen con su miniatura y lightbox, y la nota de voz con su reproductor.
   - La reacción aparece.
   - Reenviar el mismo webhook no duplica mensajes.
3. Enviar una imagen por Facebook Messenger y una por WhatsApp. **Esperado**: sin cambios.

## 5. Limpieza del histórico (FR-009)

1. En una copia de la base, contar los mensajes de Instagram o Messenger con `mediaUrl` de host Meta.
2. Aplicar `npm run db:migrate`.
3. **Esperado**:
   - El conteo pasa a 0.
   - Esos mensajes siguen existiendo, con "Contenido compartido que ya no está disponible" si `contenido` estaba vacío.
   - Ningún mensaje con `mediaArchivoId` fue tocado.
