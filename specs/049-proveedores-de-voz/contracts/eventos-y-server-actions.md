# Contrato: evento de dominio y Server Actions

## Evento `AudioTranscrito`

Única pieza nueva en el bus. Existe para que una transcripción que termina **después** de que
el mensaje ya se pintó actualice la burbuja sin recargar (FR-025).

```ts
// src/eventos/contratos/audio-transcrito.evento.ts
export interface AudioTranscritoPayload extends Record<string, unknown> {
  version: number;          // 1
  instanciaId: string;
  mediaArchivoId: string;
  conversacionIds: string[]; // conversaciones donde aparece este archivo
  estado: "LISTO" | "INAUDIBLE" | "ERROR";
  /** Presente solo en LISTO e INAUDIBLE. Nunca en ERROR. */
  transcripcion?: string;
  idioma?: string | null;
  segundos?: number | null;
}
```

Registro, en los cuatro sitios que exige el repo:

| Dónde | Qué se agrega |
|---|---|
| `src/eventos/catalogo.ts` | `AudioTranscrito: "AUDIO_TRANSCRITO"` en `EventosSistema` |
| `src/eventos/mapa.ts` | entrada en `MapaPayloads` |
| `src/shared/rabbitmq/exchanges.ts` | `RK.EVENTO_AUDIO_TRANSCRITO = "evento.audio.transcrito"` + `TIPO_EVENTO_A_RK` |
| `src/suscriptores/sse/sse-relay.suscriptor.ts` | sumar la routing key a `routingKeys` |

No hace falta cola nueva: el relay SSE ya consume de `crm.sse`. Nombre en pasado, `version`,
nombre oficial en el catálogo — regla 11 de `CLAUDE.md`. Documentar en `docs/eventos.md`.

> **Ningún suscriptor que marque audios como pendientes debe escuchar este evento.** Sería un
> bucle: transcribir → evento → marcar → transcribir. Mismo criterio que `CONTACTO_ANALIZADO`
> en 042.

## Comando interno (sin cola)

No se crea un comando `TRANSCRIBIR_AUDIO` en RabbitMQ. La transcripción de entrantes es una
llamada en proceso dentro de `procesarMensajeEntrante`, y el resto lo toma el barrido del worker
leyendo la cola en PostgreSQL (research R5 y R2).

## Server Actions — `src/configuracion/voz/actions.ts`

Todas con el preámbulo del repo: `requireSesion()` → `verificarAcceso(sesion, "voz", "modificar")`
→ Zod `safeParse` → Prisma acotado por `instanciaId` → `revalidatePath("/configuracion")`.
Devuelven `{ exito: true } | { exito: false, error: string }`.

| Action | Entrada | Notas |
|---|---|---|
| `crearProveedorVoz(datos)` | `ProveedorVozSchema` | Normaliza alias y chequea duplicado antes de Prisma; el índice único cubre la carrera (P2002). Rechaza proveedor no implementado. Cifra la credencial con `cifrarToken`. |
| `actualizarProveedorVoz(id, datos)` | `ActualizarProveedorVozSchema` = `ProveedorVozSchema.omit({ proveedor: true })` | `proveedor` inmutable. **API key vacía = conservar la vigente** (FR-003). |
| `toggleProveedorVoz(id, activo)` | — | `findFirst({ id, instanciaId })` previo. |
| `eliminarProveedorVoz(id)` | — | Ídem. |
| `probarCredencialesVoz(id \| datos)` | — | Llama `estaDisponible()`. Devuelve motivo entendible, nunca el error crudo del proveedor (FR-005). Modelo: `probarConexionBuzon` (`src/integraciones/email/actions.ts:82`). |
| `guardarTranscripcionVozHabilitada(habilitada)` | `boolean` | Rechaza encender sin un `ProveedorVoz` activo con credencial. |

**Lecturas** — `src/configuracion/voz/queries.ts`:

| Query | Devuelve |
|---|---|
| `obtenerProveedoresVoz(instanciaId)` | Lista para la UI. **Nunca `apiKeyEncriptada`**: el `select` la excluye explícitamente (FR-002). |
| `obtenerResumenUsoVoz(instanciaId)` | Minutos y costo del día y del mes, agregando `UsoVoz`. Los cortes de día usan `obtenerZonaNegocio(instanciaId)`, nunca la zona del navegador. |

## Campos nuevos en `MensajeConMeta`

`src/conversaciones/types.ts` suma, aplanados desde `mediaArchivo` en `mapearMensaje`
(`src/conversaciones/queries.ts`):

```ts
  transcripcion: string | null;
  transcripcionEstado: EstadoTranscripcion | null;
  transcripcionIdioma: string | null;
```

Deben salir por los **tres** caminos de lectura, no solo por el paginado:
`obtenerUltimosMensajes`, `obtenerMensajesAnteriores` y `obtenerMensajesConversacion`. Esta
última hoy **no usa `mensajeInclude`** y castea `as unknown as MensajeConMeta`
(`src/conversaciones/queries.ts:147`): hay que corregirla o la transcripción llegará
`undefined` según qué endpoint sirva la conversación.
