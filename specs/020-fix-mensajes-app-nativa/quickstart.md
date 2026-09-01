# Quickstart: Validar el registro de mensajes enviados desde la app nativa

Guía de validación end-to-end por historia de usuario. Referencia a `data-model.md` para los contratos exactos y a `research.md` para el razonamiento detrás de cada comportamiento esperado.

## Prerequisitos

- Migración de Prisma aplicada (`npm run db:migrate`) con el nuevo valor `AGENTE_CANAL_NATIVO` en `RemitenteMsg`.
- Servidor corriendo (`npm run dev`) con los suscriptores de RabbitMQ activos (incluye el nuevo `ProcesarMensajeAppNativaSuscriptor`, registrado en `src/suscriptores/registrar.ts`).
- Al menos una integración activa por canal a validar:
  - Instagram y/o Facebook Messenger: cuenta conectada con webhook de Meta apuntando a un túnel público (ngrok o similar) hacia el entorno de desarrollo.
  - WhatsApp: sesión Baileys vinculada (QR escaneado) desde `Configuración → Integraciones → WhatsApp`.
- Una conversación existente con al menos un contacto real por canal (para el escenario 1) y, opcionalmente, un contacto sin conversación previa (para el edge case de contacto nuevo).

## Escenario 1 — Instagram: mensaje desde la app nativa se registra (US1, AC1)

1. Con la conversación abierta en Karia (`/crm/conversaciones` o el inbox), responder al mismo contacto directamente desde la app de Instagram (no desde Karia).
2. **Esperado**: en menos de un minuto, el mensaje aparece en el historial de esa conversación en Karia, alineado como mensaje saliente, con una etiqueta que indica que se envió desde Instagram (no como si fuera un mensaje del agente vía Karia).
3. Verificar en base de datos: `SELECT remitente, idExterno, estado FROM "MensajeConversacion" WHERE contenido = '<texto enviado>' ORDER BY "creadoEn" DESC LIMIT 1;` → `remitente = 'AGENTE_CANAL_NATIVO'`, `estado = 'ENTREGADO'`, `idExterno` no nulo.
4. Confirmar que **no** se generó una respuesta automática de IA para ese mensaje (si la conversación tiene un agente de IA habilitado, revisar que no aparezca una respuesta de IA inmediatamente después).

## Escenario 2 — Facebook Messenger: mismo comportamiento (US1, AC2)

Repetir el Escenario 1 respondiendo desde la app/web nativa de Messenger a una conversación de Facebook Messenger.

## Escenario 3 — No duplicar el eco de un mensaje enviado desde Karia (US1 AC4, US2 AC2)

1. Enviar un mensaje a un contacto **desde Karia** (Instagram, Messenger o WhatsApp).
2. **Esperado**: el mensaje aparece una sola vez en el historial — el eco que la plataforma reenvía de ese mismo mensaje no genera un segundo registro.
3. Verificar en base de datos: `SELECT count(*) FROM "MensajeConversacion" WHERE idExterno = '<idExterno del mensaje enviado>';` → debe devolver `1`.

## Escenario 4 — WhatsApp: mensaje desde la app nativa se registra (US2, AC1)

1. Con la sesión de WhatsApp vinculada y una conversación existente, responder al contacto desde la app de WhatsApp o WhatsApp Web del número vinculado (no desde Karia).
2. **Esperado**: mismo resultado que el Escenario 1 — el mensaje aparece en el historial, `remitente = 'AGENTE_CANAL_NATIVO'`, sin duplicados, sin disparo de IA.

## Escenario 5 — WhatsApp: el ajuste aplica en los dos puntos de código (US2, AC3)

FR-006 exige que el fix aplique tanto en la sesión inicial (`sesion/route.ts`) como en la reconexión (`reconectar.ts`). Validar ambos:

1. Repetir el Escenario 4 justo después de vincular una sesión nueva (flujo que usa `sesion/route.ts`).
2. Reiniciar el servidor (o forzar una reconexión: desconectar y reconectar el proceso) para que la sesión pase por `reconectar.ts`, y repetir el Escenario 4 sobre esa misma sesión ya reconectada.
3. **Esperado**: mismo resultado en ambos casos.

## Edge case — contacto nuevo iniciado desde la app nativa

1. Desde la app nativa de cualquiera de los tres canales, enviar el primer mensaje a alguien que **no** tiene contacto ni conversación previa en Karia.
2. **Esperado**: se crea el contacto (placeholder, sin nombre si no se puede resolver) y la conversación, y el mensaje queda registrado con `remitente = 'AGENTE_CANAL_NATIVO'` — sin fallar silenciosamente. Verificar que **no** se creó una `Oportunidad` nueva asociada (decisión de alcance, ver research.md R8) — si el negocio esperaba que sí se cree, es la señal de que la asunción R8 necesita revisarse antes de continuar.

## Edge case — reacciones y recibos de lectura sin cambios

1. Reaccionar a un mensaje desde la app nativa de Instagram/Messenger, y marcar un mensaje como leído desde la app nativa de cualquier canal.
2. **Esperado**: comportamiento idéntico al actual (las reacciones se siguen procesando vía `procesarReaccionIG`/`procesarReaccionEntranteWA`; los recibos de lectura se siguen ignorando) — este ajuste no debe tocar esos caminos.

## Tests automatizados a agregar (Vitest)

No hay forma práctica de automatizar el webhook real de Meta ni una sesión real de Baileys en CI — los tests automatizados deben cubrir la lógica pura y determinística:

- `src/conversaciones/providers/instagram.test.ts` / `facebook-messenger.test.ts`: `mapearEntrante` con `message.is_echo = true` debe devolver `identificadorContacto = recipient.id`, no `sender.id` (ver research.md R4).
- Test unitario para la función de dedup/registro (`registrarMensajeAppNativa` o el helper compartido): dado un `idExterno` ya existente, no debe crear un segundo `MensajeConversacion` ni publicar `MensajeEnviado` dos veces.
- Test para el extractor de contenido/media de WhatsApp reutilizado: confirmar que el mensaje registrado por esta vía nunca usa `msg.pushName` para setear `contacto.nombre` (ver research.md R5).
