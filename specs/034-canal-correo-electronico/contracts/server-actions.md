# Contrato: Server Actions y puntos de corte

**Feature**: 034-canal-correo-electronico

Firmas de las operaciones del servidor y los tres lugares donde el bloqueo por aprobación pendiente debe
cortar. Todas validan con Zod antes de tocar Prisma y resuelven `instanciaId` desde la sesión, nunca desde
el cliente.

## 1. Buzón — `src/integraciones/email/actions.ts`

```ts
type Resultado<T> = { ok: true; data: T } | { ok: false; error: string; codigo?: string };

/** Prueba las dos conexiones contra el servidor real. No persiste nada. */
probarConexionBuzon(input: unknown): Promise<Resultado<{
  entrada: { ok: boolean; codigo?: CodigoErrorCorreo; mensaje?: string };
  salida:  { ok: boolean; codigo?: CodigoErrorCorreo; mensaje?: string };
}>>

/** Crea el buzón. Falla si la prueba de conexión no pasó (FR-004). */
registrarBuzon(input: unknown): Promise<Resultado<{ id: string }>>

/** Edita. Contraseña vacía = conservar la actual. Vuelve a exigir prueba si cambió una conexión. */
actualizarBuzon(input: unknown): Promise<Resultado<{ id: string }>>

/** Activa o desactiva la lectura y el envío del buzón. */
cambiarEstadoBuzon(input: unknown): Promise<Resultado<{ activa: boolean }>>

/** Elimina el buzón. Las conversaciones ya recibidas se conservan. */
eliminarBuzon(input: unknown): Promise<Resultado<null>>
```

`CodigoErrorCorreo`: `CREDENCIALES_RECHAZADAS` | `SERVIDOR_INALCANZABLE` | `SEGURIDAD_INCOMPATIBLE` |
`TIEMPO_AGOTADO` | `BUZON_INACCESIBLE` | `ERROR_DESCONOCIDO`.

Lectura: `src/integraciones/email/queries.ts` → `obtenerBuzones(instanciaId): Promise<BuzonParaCliente[]>`,
que **nunca** selecciona las credenciales (ver `contracts/configuracion-buzon.md`).

## 2. Aprobación — `src/integraciones/email/aprobacion/actions.ts`

```ts
/** Aprueba creando un contacto nuevo con los datos del remitente. */
aprobarRemitenteConContactoNuevo(input: {
  conversacionId: string;
  nombre: string;
  apellido?: string;
}): Promise<Resultado<{ contactoId: string }>>

/** Aprueba asociando el remitente a un contacto que ya existe. */
aprobarRemitenteConContactoExistente(input: {
  conversacionId: string;
  contactoId: string;
}): Promise<Resultado<{ contactoId: string }>>
```

Ambas desembocan en **una** función interna, `aprobarRemitenteCorreo`, que en **una sola transacción**:

1. Escribe `ContactoIdentificadorCanal.aprobadoEn = now()` y `aprobadoPorId`.
2. Pone `Conversacion.bloqueadaPorAprobacion = false`.
3. Pone `Oportunidad.aprobacionPendiente = false` en las oportunidades vinculadas.
4. Activa el contacto provisional, **o** reasigna conversación e identificador al contacto existente y
   elimina el provisional.

Es el único lugar del código que puede levantar el bloqueo. Hay un test que verifica que las tres banderas
quedan consistentes y otro que verifica que un fallo a mitad de camino no deja nada aplicado.

## 3. Los tres puntos de corte

Una conversación con `bloqueadaPorAprobacion = true` no puede emitir **ningún** mensaje saliente. Hay tres
caminos para emitir uno, y los tres se cierran:

| # | Dónde | Qué se agrega | Resultado |
|---|---|---|---|
| 1 | `enviarMensajeInterno` (`src/conversaciones/envio.ts`) | La conversación ya se carga ahí con `findUniqueOrThrow`; se suma el campo al `select` y se corta **antes** de crear el `MensajeConversacion` | `{ ok: false, error: "Aprobá al remitente antes de responder este correo." }` (FR-034) |
| 2 | `OrquestarIASuscriptor` (`src/suscriptores/ai/orquestar-ia.suscriptor.ts`) | La conversación ya se carga con `modoAtencion`; se suma el campo y se corta junto al gate de `modoAtencion === "HUMANO"` | La IA no genera ni envía nada, con log del motivo |
| 3 | `enrutarMensajeEntrante` (`src/workflows/motor/disparo.ts`) | La conversación ya se carga con `modoAtencion`; mismo tratamiento | Devuelve `{ atendido: true }`: ningún Workflow toma la conversación |

**El orden importa**: `enrutarMensajeEntrante` se evalúa *antes* que la IA dentro del mismo suscriptor, así
que el corte tiene que estar en los dos — cortar solo en la IA dejaría a los Workflows respondiendo.

Los tres leen una columna que **solo** el canal correo pone en `true`. Para WhatsApp, Instagram y Messenger
el valor es siempre `false` y el comportamiento queda idéntico al actual (FR-039, SC-011).

## 4. Lectura del buzón — `src/integraciones/email/imap/polling.ts`

No es una Server Action: la invoca el worker.

```ts
/** Arranca el ciclo. Se llama una vez al iniciar el worker, como reconectarSesionesWA. */
iniciarPollingCorreo(opciones?: { intervaloMs?: number }): Promise<void>

/** Un ciclo: recorre los buzones activos de todas las instancias. Exportada para poder probarla. */
ejecutarCicloCorreo(): Promise<{ buzones: number; correos: number; fallidos: number }>

/** Lee un buzón. Toma el lock, procesa y persiste la marca al final. */
leerBuzon(cuentaCanalId: string): Promise<{ correos: number }>
```

Garantías:
- Un buzón se lee de a uno por vez en todo el despliegue (lock de aplicación en PostgreSQL).
- El fallo de un buzón no interrumpe el ciclo ni afecta a los demás.
- La marca de lectura avanza **después** de encolar, nunca antes.
