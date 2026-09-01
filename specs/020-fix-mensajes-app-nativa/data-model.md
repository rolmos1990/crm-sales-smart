# Data Model: Registrar en Karia los mensajes enviados desde la app nativa del canal

## Cambios de esquema (Prisma)

### `RemitenteMsg` (enum) — nuevo valor

```prisma
enum RemitenteMsg {
  CONTACTO
  AGENTE
  SISTEMA
  BOT
  AGENTE_CANAL_NATIVO   // + nuevo: mensaje saliente detectado por eco, enviado desde la app/web nativa del canal (no desde Karia)
}
```

Requiere una migración Prisma nueva (`ALTER TYPE "RemitenteMsg" ADD VALUE ...`) — es un cambio aditivo, no destructivo; no requiere backfill (aplica hacia adelante, ver Assumptions del spec).

### `MensajeConversacion` — sin cambios de columnas

No se agrega ninguna columna. Los campos ya existentes se completan así para un mensaje registrado por esta vía:

| Campo | Valor |
|---|---|
| `remitente` | `"AGENTE_CANAL_NATIVO"` |
| `estado` | `"ENTREGADO"` (ya fue entregado — se detectó por el eco de la plataforma, no está en tránsito) |
| `idExterno` | `mid` (Meta) o `key.id` (Baileys) del evento de eco — misma columna que ya usa el flujo de envío y el de entrante para dedup |
| `enviadoEn` | `new Date()` al momento de procesar el evento |
| `usuarioId` | `null` — no hay forma de saber qué persona del equipo lo envió (ver Assumptions del spec) |
| `contenido` / `tipo` / `mediaUrl` / `mediaMimeType` / `mediaDuracion` / `mediaArchivoId` | igual que un mensaje entrante normal — mismo mapeo de contenido/adjuntos que ya existe (`provider.mapearEntrante` para IG/Messenger, extracción manual para WhatsApp) |

## Reglas de negocio

1. **Idempotencia por `idExterno`**: antes de encolar el comando (en el webhook/listener) y de nuevo antes de insertar (en la server action, dentro de `resolverContactoYConversacion` + verificación previa a `create`) — doble verificación, mismo patrón que ya usa `procesarMensajeEntrante` (pasos 4.5 y 7) para cubrir la condición de carrera del edge case de spec.
2. **No dispara IA**: el evento publicado al terminar es `EventosSistema.MensajeEnviado`, nunca `EventosSistema.MensajeRecibido` — `OrquestarIASuscriptor` solo escucha este último.
3. **No crea/actualiza `Oportunidad`**: decisión de alcance documentada en `research.md` R8.
4. **Reactivación de conversación**: si la conversación existente está `EN_ESPERA` o `CERRADA`, se reabre igual que hoy (reutiliza la misma lógica de `resolverContactoYConversacion`).
5. **Cuenta inactiva**: el filtro `activa: true` ya existente en la resolución de `CuentaCanal` (Instagram/Messenger: `prisma.cuentaCanal.findFirst({ where: { activa: true, ... } })`; WhatsApp: la sesión ni siquiera está conectada si la cuenta está inactiva) sigue aplicando sin cambios — un evento de una cuenta inactiva nunca llega a generarse.

## Nuevo comando asíncrono: `PROCESAR_MENSAJE_APP_NATIVA`

Mismo patrón que `PROCESAR_ENTRANTE` (comando → cola RabbitMQ → suscriptor → server action), como flujo hermano y no una rama dentro del existente (ver research.md R3, R6).

| Elemento | Valor |
|---|---|
| Nombre de comando | `ComandosSistema.ProcesarMensajeAppNativa` = `"PROCESAR_MENSAJE_APP_NATIVA"` |
| Cola | `QUEUES.MENSAJE_APP_NATIVA` = `"crm.comando.mensaje.app-nativa"` |
| Routing key | `RK.COMANDO_MENSAJE_APP_NATIVA` = `"comando.mensaje.app-nativa"` |
| Payload | Reutiliza `ComandoProcesarEntrantePayload` (mismo shape que `PROCESAR_ENTRANTE`: `instanciaId`, `canal`, `identificadorContacto`, `cuentaCanalId`, `contenido?`, `tipo`, `idExterno?`, `mediaUrl?`, `mediaMimeType?`, `mediaDuracion?`, `mediaArchivoId?`) — sin `pushName`/`avatarUrl` para WhatsApp (ver research.md R5); IG/Messenger sí pueden incluir `avatarUrl`/`handleCanal` si el contacto es nuevo, resueltos con `event.recipient.id` (ver R4) |
| Suscriptor | `ProcesarMensajeAppNativaSuscriptor extends ConsumidorBase<ComandoProcesarEntrantePayload>` — mismo `MAX_INTENTOS`/dead-letter que el resto de comandos vía `ConsumidorBase` |
| Server action invocada | `registrarMensajeAppNativa(payload)` en `src/conversaciones/actions.ts` |
| Evento publicado al terminar | `EventosSistema.MensajeEnviado` (sin cambios de contrato — ver research.md R7) |

## Flujo por canal

### Instagram / Facebook Messenger

```
Meta envía evento messaging[] con message.is_echo = true
  └─ event.read? → continue (sin cambios)
  └─ resolver CuentaCanal / canal (instagram vs facebook_messenger) → sin cambios
  └─ event.reaction? → procesarReaccionIG (sin cambios)
  └─ mid = event.message.mid
      ├─ existe MensajeConversacion.idExterno = mid?
      │     └─ sí → continue (ya lo registró Karia — sin cambios respecto a hoy)
      │     └─ no → es un mensaje de la app nativa
      │           ├─ identificadorContacto = event.recipient.id  (swap — ver R4)
      │           ├─ mapear contenido/adjuntos (mismo mapeo que hoy, reutilizado)
      │           ├─ descargar/almacenar media si aplica (misma función existente)
      │           └─ publicar comando PROCESAR_MENSAJE_APP_NATIVA
```

### WhatsApp (Baileys) — en `reconectar.ts` y en `sesion/route.ts`, los dos puntos (FR-006)

```
Baileys emite messages.upsert con msg.key.fromMe = true
  └─ es reacción? → procesarReaccionEntranteWA (sin cambios)
  └─ idExterno = msg.key.id
      ├─ existe MensajeConversacion.idExterno = idExterno?
      │     └─ sí → continue (ya lo registró Karia — sin cambios respecto a hoy)
      │     └─ no → es un mensaje de la app nativa
      │           ├─ identificadorContacto = derivado de msg.key.remoteJid (igual que hoy — sin swap, ver R4)
      │           ├─ extraer contenido/tipo/media (misma extracción que encolarMensajeEntrante, sin pushName — ver R5)
      │           └─ publicar comando PROCESAR_MENSAJE_APP_NATIVA
```

## UI — distinción visual (FR-004 / SC-003)

`src/conversaciones/components/burbuja-mensaje.tsx`:

- `esPropioONota` debe incluir `"AGENTE_CANAL_NATIVO"` junto a `"AGENTE"` y `"SISTEMA"` (línea 187) — se alinea a la derecha como cualquier mensaje saliente.
- Debajo del contenido de la burbuja (mismo lugar donde hoy se podría agregar metadata), mostrar una etiqueta corta cuando `remitente === "AGENTE_CANAL_NATIVO"`, ej. "Enviado desde {nombre del canal}" — reutilizar tokens semánticos existentes (no colores nuevos); no requiere ícono nuevo si el texto ya es suficientemente claro. El nombre del canal se puede derivar del `canal` de la conversación (`conversacion.cuentaCanal.canal`), ya disponible en el contexto donde se renderiza la lista de mensajes.
