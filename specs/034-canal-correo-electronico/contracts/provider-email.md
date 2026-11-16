# Contrato: `EmailProvider` y entrada de correo

**Feature**: 034-canal-correo-electronico

Cómo el canal correo cumple el contrato `ICanalProvider` que ya usan WhatsApp, Instagram y Messenger
(`src/conversaciones/providers/types.ts`), y cómo un correo leído del buzón entra al sistema.

## 1. Capacidades declaradas

El stub actual declara `plantillas: true`, que no corresponde: las "plantillas" de Karia son plantillas de
mensajería (las de WhatsApp Business), no el cuerpo de un correo. Queda:

```ts
readonly capacidades: CapacidadCanal = {
  texto: true,
  imagen: true,          // adjunto de imagen
  video: false,
  audio: false,
  notaVoz: false,
  documento: true,       // adjunto
  plantillas: false,     // corregido: el correo no usa plantillas de mensajería
  botones: false,
  marcarLeidoExterno: false,
  reacciones: false,
};
```

FR-031 se cumple con esto: el Inbox ya consulta `obtenerCapacidadesCanal` para decidir qué ofrecer.

## 2. Envío — `enviarMensaje`

Recibe el `MensajeSalientePayload` estándar. La `configuracion` llega desde `EnviarMensajeSuscriptor`, que
ya hace `{ ...cuentaCanal.configuracion, proveedorAuth }`; el provider descifra lo que necesita y arma el
envío SMTP.

```ts
interface ContextoHiloCorreo {
  asunto: string | null;        // asunto original de la conversación
  inReplyTo: string | null;     // Message-ID del último correo entrante
  references: string[];         // cadena del hilo, acotada
}
```

- El asunto sale como `Re: <asunto>` sin duplicar el prefijo; si no hay asunto previo, se usa un asunto
  neutro con el nombre del negocio.
- `tag` (el `HUMAN_AGENT` de Meta) se ignora, como ya hace el stub.
- Devuelve `{ idExterno }` con el `Message-ID` que generó el envío, para que la respuesta del cliente pueda
  encadenarse.

**Dónde se arma `ContextoHiloCorreo`**: en el provider no, porque no tiene acceso a Prisma — igual que la
ventana de mensajería de Meta, que `EnviarMensajeSuscriptor` resuelve antes de llamar al provider. El
contexto del hilo se resuelve en `src/integraciones/email/mensaje/hilo.ts` y se pasa dentro de
`configuracion`, sin cambiar la firma de `ICanalProvider`.

### Errores

Se traducen a `EnvioMensajeError` (`src/conversaciones/errores.ts`), que es lo que el Inbox ya sabe
mostrar, con estos códigos:

| Código | Reintentable | Cuándo |
|---|---|---|
| `CREDENCIALES_RECHAZADAS` | No | El servidor de salida rechaza la autenticación |
| `DESTINATARIO_RECHAZADO` | No | Dirección inexistente o rechazada por el servidor |
| `SERVIDOR_INALCANZABLE` | Sí | No se pudo conectar |
| `TIEMPO_AGOTADO` | Sí | Timeout de 15 s |
| `MENSAJE_RECHAZADO` | No | Rechazo por tamaño o por política del servidor |
| `ERROR_DESCONOCIDO` | Sí | Todo lo demás |

El texto original del servidor SMTP no viaja al cliente; queda en el log.

## 3. Entrada — del buzón al sistema

`mapearEntrante` del contrato queda para los canales que reciben por webhook. El correo no llega por
webhook: lo lee el worker. El flujo es:

```text
imap/polling.ts  →  lee los UID nuevos de un buzón
       ↓
mensaje/filtros.ts  →  ¿auto-respuesta, rebote, bucle, boletín?  → descartar y avanzar la marca
       ↓ no
mensaje/normalizar.ts  (mailparser + limpiar-cita + html-a-texto + adjuntos)
       ↓
publicar ComandoProcesarEntrante  (RabbitMQ, el comando que YA existe)
       ↓
ProcesarEntranteSuscriptor → procesarMensajeEntrante()  ← camino común a todos los canales
```

El payload publicado usa el contrato existente `ComandoProcesarEntrantePayload`, sin campos nuevos:

| Campo | Valor para correo |
|---|---|
| `canal` | `"email"` |
| `identificadorContacto` | Dirección del remitente, normalizada a minúsculas |
| `cuentaCanalId` | Id del buzón |
| `instanciaId` | Instancia dueña del buzón |
| `contenido` | Texto ya limpio (sin cita, sin HTML), recortado a 100 KB |
| `tipo` | `"TEXTO"`, o el tipo del adjunto principal si el correo no trae texto |
| `idExterno` | `Message-ID` normalizado, o `sha256(cuentaCanalId:uidValidity:uid)` si falta |
| `pushName` | Nombre visible del remitente (`"Juan Pérez" <juan@x.com>` → `Juan Pérez`) |
| `mediaArchivoId` | Id del adjunto ya guardado, si lo hay |

No se agrega ningún evento ni comando nuevo al catálogo: el correo entra por `ProcesarEntrante` y sale por
`EnviarMensaje`, los dos que ya existen. Por lo tanto **no hay nada nuevo que documentar en
`docs/eventos.md`** para este canal.

## 4. Lo que el provider NO hace

- No resuelve contactos ni conversaciones (eso es `procesarMensajeEntrante`).
- No decide si un remitente requiere aprobación (eso es `aprobacion/reglas.ts`).
- No toca Prisma.
- No renderiza ni devuelve HTML del correo (ver research.md R10).
