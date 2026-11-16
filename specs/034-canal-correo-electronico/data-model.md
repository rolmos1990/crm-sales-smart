# Data Model: Canal de correo electrónico

**Feature**: 034-canal-correo-electronico | **Fecha**: 2026-11-15

Todo lo que sigue es **aditivo**: ninguna columna existente cambia de tipo, de nombre ni de significado, y
ningún dato actual se reinterpreta. Las columnas nuevas son opcionales o traen valor por defecto, así que
las filas existentes quedan válidas sin tocarlas.

---

## 1. Modelos que se reutilizan tal cual

| Modelo | Qué aporta al canal correo | Cambios |
|---|---|---|
| `CuentaCanal` | El buzón: `canal = "email"`, `identificador` = la dirección, `configuracion` = credenciales cifradas y opciones, `activa`, `pipelineId`, `stageId`, `stageIdRespuestaAutomatica` | Ninguna columna nueva; sí un índice (§4) |
| `Contacto` | El remitente. Se usa `email` para el emparejamiento y `activo` para los pendientes de aprobación | Ninguno |
| `Conversacion` | El hilo de atención por correo | 2 columnas nuevas (§3) |
| `MensajeConversacion` | Cada correo. `idExterno` guarda el `Message-ID`; `mediaArchivoId` los adjuntos; `codigoError`/`motivoError` los fallos de envío | Ninguno |
| `Oportunidad` | El negocio creado desde el correo | 1 columna nueva (§3) |
| `ContactoIdentificadorCanal` | La dirección del remitente, única por instancia | 1 columna nueva (§3) |
| `OportunidadConversacion` | El vínculo conversación ↔ oportunidad | Ninguno |
| `MediaArchivo` | Los adjuntos, por el servicio de media ya existente | Ninguno |

---

## 2. Entidad nueva: `BuzonCorreoEstado`

Estado operativo de la lectura de un buzón. Vive aparte de `CuentaCanal.configuracion` a propósito: se
escribe en **cada ciclo de lectura**, y no corresponde reescribir en cada ciclo la fila que guarda las
credenciales del comercio.

```prisma
model BuzonCorreoEstado {
  id String @id @default(cuid())

  cuentaCanalId String      @unique
  cuentaCanal   CuentaCanal @relation(fields: [cuentaCanalId], references: [id], onDelete: Cascade)

  instanciaId String
  instancia   Instancia @relation(fields: [instanciaId], references: [id], onDelete: Cascade)

  // Marca de posición IMAP. UID es un entero sin signo de 32 bits: no entra en Int.
  // Se anclan al activar el buzón, para no importar el historial de la casilla (FR-023).
  uidValidity BigInt?
  ultimoUid   BigInt?

  ultimaLecturaOkEn DateTime?
  ultimaLecturaEn   DateTime?
  correosLeidos     Int       @default(0)

  // Estado de error visible para el negocio (FR-012). El texto crudo del
  // servidor NO se guarda acá: solo el código funcional y un mensaje ya
  // traducido, porque esto se muestra en pantalla.
  errorCodigo   String?
  errorMensaje  String?
  errorDesde    DateTime?
  fallosSeguidos Int      @default(0)

  creadoEn      DateTime @default(now())
  actualizadoEn DateTime @updatedAt

  @@index([instanciaId])
}
```

**Reglas**:
- Se crea junto con el buzón, con `uidValidity`/`ultimoUid` en `null` y se ancla en la primera lectura.
- Una lectura exitosa limpia `errorCodigo`, `errorMensaje`, `errorDesde` y pone `fallosSeguidos = 0`.
- `fallosSeguidos` sube con cada ciclo fallido; a partir del umbral el buzón se muestra "con error" en el
  panel. El buzón **no** se desactiva solo: desactivarlo es una decisión del negocio.
- La marca nueva se persiste **después** de encolar los correos del ciclo, nunca antes.

---

## 3. Columnas nuevas sobre modelos existentes

### 3.1 `ContactoIdentificadorCanal.aprobadoEn` — la fuente de verdad de la aprobación

```prisma
  /// Solo canal "email": cuándo se aprobó a este remitente (FR-037). `null`
  /// significa "sin aprobar" ÚNICAMENTE si el buzón tiene desactivada la
  /// creación automática de contactos; en cualquier otro canal el campo no se
  /// consulta nunca y queda en null para siempre.
  aprobadoEn     DateTime?
  aprobadoPorId  String?
```

Se apoya en el `@@unique([canal, identificador, instanciaId])` que el modelo ya tiene: la aprobación es por
dirección y por cuenta, que es justo lo que pide FR-037.

### 3.2 `Conversacion` — bloqueo y clave de hilo

```prisma
  /// Bandera derivada de ContactoIdentificadorCanal.aprobadoEn, para que los
  /// tres puntos de corte (envío humano, IA, Workflows) no paguen una consulta
  /// extra. Se escribe en la misma transacción que la fuente de verdad.
  bloqueadaPorAprobacion Boolean @default(false)

  /// Clave del hilo de correo (Message-ID raíz normalizado). Solo se usa
  /// cuando el buzón agrupa por hilo (FR-007, historia P4). Null en todos los
  /// demás canales y en los buzones que agrupan por remitente.
  hiloExterno String?
```

```prisma
  @@index([instanciaId, bloqueadaPorAprobacion])
  @@index([instanciaId, hiloExterno])
```

El campo `asunto`, que ya existe y hoy casi no se usa, pasa a guardar el asunto del correo que abrió la
conversación: de ahí sale el `Re: …` de las respuestas (FR-028).

### 3.3 `Oportunidad.aprobacionPendiente` — el distintivo en el tablero

```prisma
  /// Bandera derivada, solo para oportunidades nacidas de un remitente de
  /// correo sin aprobar (FR-040). Permite distinguirlas en el Kanban sin
  /// agregar una consulta por columna.
  aprobacionPendiente Boolean @default(false)
```

```prisma
  @@index([instanciaId, aprobacionPendiente])
```

### 3.4 Invariante de las tres

> `Conversacion.bloqueadaPorAprobacion == true` **si y solo si** el `ContactoIdentificadorCanal` de canal
> `"email"` de esa conversación tiene `aprobadoEn == null` y el buzón tiene desactivada la creación
> automática. Y toda `Oportunidad` vinculada a una conversación bloqueada tiene `aprobacionPendiente == true`.

Las tres se escriben dentro de **una sola transacción**, en **una sola función**
(`aprobarRemitenteCorreo`), y hay un test que lo verifica. Si alguna vez hace falta reparar datos, la
fuente de verdad para reconstruir las banderas es `aprobadoEn`.

---

## 4. Índices y restricciones en SQL crudo

`CuentaCanal` ya tiene dos índices únicos **parciales** creados a mano en migraciones previas (Prisma no
los soporta en el DSL), uno para `instagram` y otro para `facebook_messenger`. Esta feature agrega el
equivalente para correo (FR-010):

```sql
CREATE UNIQUE INDEX "CuentaCanal_instanciaId_identificador_email_key"
  ON "CuentaCanal" ("instanciaId", "identificador")
  WHERE "canal" = 'email';
```

**Antes de aplicarlo**, verificar que no haya duplicados preexistentes (no debería haber ninguna fila con
`canal = 'email'`, porque hasta hoy no existe forma de crearlas):

```sql
SELECT "instanciaId", "identificador", COUNT(*)
  FROM "CuentaCanal" WHERE "canal" = 'email'
  GROUP BY 1, 2 HAVING COUNT(*) > 1;
```

> **Advertencia de migración** — el propio modelo `CuentaCanal` la deja escrita: al correr
> `prisma migrate dev` hay que **revisar el diff propuesto antes de aceptarlo**, porque Prisma no conoce
> esos índices parciales y puede proponer borrarlos.

---

## 5. Forma de `CuentaCanal.configuracion` para `canal = "email"`

Contrato completo, con su esquema Zod, en [contracts/configuracion-buzon.md](./contracts/configuracion-buzon.md).
Resumen:

```jsonc
{
  "entrada":  { "servidor": "imap.proveedor.com", "puerto": 993, "seguridad": "SSL_TLS",
                "usuario": "ventas@negocio.com", "passwordCifrada": "enc:v1:…" },
  "salida":   { "servidor": "smtp.proveedor.com", "puerto": 465, "seguridad": "SSL_TLS",
                "usuario": "ventas@negocio.com", "passwordCifrada": "enc:v1:…",
                "nombreRemitente": "Ventas Mi Negocio" },
  "recepcion": { "agrupacion": "POR_REMITENTE",        // | "POR_HILO"
                 "crearContactosAutomaticamente": true }
}
```

- `passwordCifrada` guarda el resultado de `cifrarToken` — nunca el valor plano, **nunca** se devuelve al
  navegador.
- `seguridad`: `"SSL_TLS"` | `"STARTTLS"` | `"NINGUNA"`.
- `pipelineId`, `stageId` y `stageIdRespuestaAutomatica` **no** van en este JSON: son columnas de
  `CuentaCanal` y ya las consume `procesarMensajeEntrante`.

---

## 6. Ciclo de vida de una conversación de correo

```text
         correo entrante de dirección desconocida
                          │
          ┌───────────────┴───────────────┐
   buzón crea contactos           buzón NO crea contactos
     automáticamente                automáticamente
          │                                │
          ▼                                ▼
  Contacto activo                 Contacto activo=false
  identificador aprobadoEn=now    identificador aprobadoEn=null
  Conversación normal             Conversación bloqueadaPorAprobacion=true
  Oportunidad normal              Oportunidad aprobacionPendiente=true
          │                                │
          │                    ┌───────────┴───────────┐
          │              aprobar creando         aprobar asociando
          │              contacto nuevo          a contacto existente
          │                    │                       │
          │        activo=true │      identificador y conversación
          │                    │      se reasignan; el provisional
          │                    │      se elimina
          │                    └───────────┬───────────┘
          │                                ▼
          │                   aprobadoEn=now, banderas en false
          └────────────────────┬───────────┘
                               ▼
                     conversación atendible
            (humano, IA y Workflows habilitados según
             la configuración que ya existe por etapa)
```

Correos que llegan **mientras** la aprobación está pendiente: se suman a la misma conversación bloqueada,
sin crear otra oportunidad ni otro pendiente (FR-038).

Si el contacto aprobado se elimina del CRM: `ContactoIdentificadorCanal` cae con él por `onDelete: Cascade`,
así que un correo posterior de esa dirección vuelve a tratarse como remitente desconocido. Es el
comportamiento que pide el caso borde del spec, y sale solo del modelo actual.

---

## 7. Reglas de validación (servidor)

| Dato | Regla |
|---|---|
| Dirección del buzón | Formato de correo válido; se guarda en minúsculas; única por instancia (§4) |
| Nombre del buzón | 1-60 caracteres |
| Servidor | Nombre de host válido, 1-255 caracteres |
| Puerto | Entero entre 1 y 65535 |
| Seguridad | Uno de `SSL_TLS` \| `STARTTLS` \| `NINGUNA` |
| Contraseña | 1-512 caracteres; obligatoria al crear, opcional al editar (vacío = conservar la actual) |
| `pipelineId` / `stageId` | Deben pertenecer a la instancia; el stage debe pertenecer al pipeline |
| Dirección del remitente entrante | Normalizada a minúsculas, sin el nombre visible, antes de buscar o crear (FR-015) |
| Aprobación | El contacto destino, si se asocia a uno existente, debe pertenecer a la instancia |

Todas se expresan con Zod en `src/integraciones/email/schema.ts` y se ejecutan **antes** de tocar Prisma.

---

## 8. Estrategia de migración

1. Migración única, aditiva: las 4 columnas nuevas, el modelo `BuzonCorreoEstado`, los índices nuevos y el
   índice único parcial de correo en SQL crudo.
2. Sin backfill: todas las filas existentes quedan con los defaults (`false`, `null`), que describen
   exactamente su estado real — ninguna conversación de WhatsApp está bloqueada por aprobación, ninguna
   oportunidad existente nació de un correo.
3. Reversión: `DROP` de lo agregado. Ningún dato previo se pierde porque ninguno se modificó.
4. Revisar el diff de `prisma migrate dev` por los índices parciales (§4) antes de aceptarlo.
