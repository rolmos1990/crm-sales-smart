# Data Model: Vista segura de correos HTML

**Feature**: 035-correo-html-seguro | **Migración**: `prisma/migrations/20261117000000_correo_html_seguro/`
(aditiva)

## Entidad nueva: `MensajeCorreo`

Contiene los datos propios de correo de un `MensajeConversacion`, en relación 1 a 1 y siempre dentro de un
comercio.

| Campo | Tipo | Nulo | Notas |
|---|---|---|---|
| `id` | `String @id @default(cuid())` | no | |
| `mensajeId` | `String @unique` | no | FK a `MensajeConversacion`, `onDelete: Cascade`. El `@unique` es lo que impide duplicar el registro al reprocesar (FR-011) |
| `instanciaId` | `String` | no | FK a `Instancia`, `onDelete: Cascade`. Toda lectura filtra por este campo (FR-015) |
| `estadoHtml` | `EstadoHtmlCorreo` | no | `SIN_HTML` \| `DISPONIBLE` \| `NO_DISPONIBLE` |
| `motivoHtml` | `String?` | sí | Código estable: `DEMASIADO_GRANDE`, `DEMASIADO_ANIDADO`, `TIEMPO_EXCEDIDO`, `ERROR_LIMPIEZA`, `VACIO`. Nunca guarda contenido del correo |
| `htmlLimpio` | `String? @db.Text` | sí | Solo con estado `DISPONIBLE`, como máximo 512 KB. **Nunca el original** (FR-001) |
| `versionPolitica` | `Int` | no | Versión de la política de limpieza que generó `htmlLimpio` (research R2) |
| `tieneImagenesExternas` | `Boolean @default(false)` | no | Activa el aviso de FR-017 |
| `imagenesExternas` | `Json @default("[]")` | no | `string[]` de URLs http(s), máximo 50. El proxy solo carga direcciones de esta lista. **No se envía al navegador** |
| `adjuntos` | `Json @default("[]")` | no | `AdjuntoCorreo[]` (ver abajo) |
| `de` | `Json?` | sí | `DireccionCorreo` |
| `para` | `Json @default("[]")` | no | `DireccionCorreo[]`, máximo 50 |
| `paraTotal` | `Int @default(0)` | no | Total real de destinatarios, para el "y N más" |
| `cc` | `Json @default("[]")` | no | `DireccionCorreo[]`, máximo 50 |
| `ccTotal` | `Int @default(0)` | no | |
| `asunto` | `String?` | sí | Asunto de **este** correo |
| `fechaEnvio` | `DateTime?` | sí | Cabecera `Date` del correo en UTC. Puede faltar o ser inválida |
| `creadoEn` | `DateTime @default(now())` | no | |

Índices: `@@index([instanciaId])`. `mensajeId` ya es único.

### Tipos JSON

Se validan con Zod en `src/integraciones/email/vista/schema.ts`, al leer y al escribir.

```ts
DireccionCorreo = { nombre: string | null; direccion: string }

AdjuntoCorreo = {
  mediaArchivoId: string;
  nombre: string;
  mimeType: string;      // tipo declarado por el correo
  bytes: number;
  cid: string | null;    // sin "<>", en minúsculas
  enLinea: boolean;      // true si el HTML limpio lo usa como cid:
}
```

### Enum nuevo

```prisma
enum EstadoHtmlCorreo {
  SIN_HTML       // el correo no traía HTML, o quedó vacío tras limpiarlo (motivo VACIO)
  DISPONIBLE     // hay htmlLimpio
  NO_DISPONIBLE  // traía HTML, pero no se pudo limpiar dentro de los límites
}
```

## Cambios en entidades existentes

Todos son aditivos y solo agregan relaciones inversas, sin columnas nuevas.

- `MensajeConversacion`: `correo MensajeCorreo?`
- `Instancia`: `mensajesCorreo MensajeCorreo[]`

## Contrato de evento (aditivo)

`ComandoProcesarEntrantePayload` (`src/eventos/contratos/procesar-entrante.comando.ts`) suma un campo
opcional:

```ts
correo?: DatosCorreoEntrante   // solo canal "email"; ver contracts/limpieza-html.md
```

Los canales que ya existían no lo envían y el consumidor lo ignora si falta. Mismo patrón que `asunto` e
`hiloExterno` en 034. No cambia el nombre ni la versión del comando.

## Reglas y transiciones

- **Creación de entrantes.** Se crea **anidado** en el `mensajeConversacion.create` de
  `procesarMensajeEntrante`, solo si el payload trae `correo`. Si el mensaje se deduplica por `idExterno`,
  no se crea nada.
- **Creación de salientes.** Se hace un `upsert` por `mensajeId` después de un envío SMTP exitoso, con
  `estadoHtml = SIN_HTML` y las cabeceras de salida.
- **Inmutabilidad.** Después de creado no se modifica. Si la política cambia, no se reescriben los
  registros viejos: la segunda limpieza al servir (research R7) aplica la política vigente.
- **Borrado.** Se borra en cascada con el mensaje o con la instancia.
- **Invariantes:**
  - `estadoHtml = DISPONIBLE` exige `htmlLimpio` no nulo.
  - Con cualquier otro estado, `htmlLimpio` es nulo.
  - `tieneImagenesExternas` es verdadero si y solo si `imagenesExternas` no está vacío.

## Migración

```sql
CREATE TYPE "EstadoHtmlCorreo" AS ENUM ('SIN_HTML', 'DISPONIBLE', 'NO_DISPONIBLE');
CREATE TABLE "MensajeCorreo" ( ... );                 -- columnas de la tabla de arriba
CREATE UNIQUE INDEX ... ON "MensajeCorreo"("mensajeId");
CREATE INDEX ... ON "MensajeCorreo"("instanciaId");
ALTER TABLE "MensajeCorreo" ADD CONSTRAINT ... FOREIGN KEY ("mensajeId") REFERENCES "MensajeConversacion"("id") ON DELETE CASCADE;
ALTER TABLE "MensajeCorreo" ADD CONSTRAINT ... FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE;
```

- No toca tablas existentes.
- No hay backfill (spec, supuestos).
- **Reversión:** `DROP TABLE "MensajeCorreo"; DROP TYPE "EstadoHtmlCorreo";`. No hay pérdida para el resto
  del sistema: el texto sigue en `MensajeConversacion.contenido`.
