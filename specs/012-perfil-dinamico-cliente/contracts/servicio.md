# Contratos: `src/ai/perfil-cliente/`

## `PerfilClienteService.obtenerPerfil(contactoId, instanciaId)`

```ts
async function obtenerPerfil(contactoId: string, instanciaId: string): Promise<PerfilCliente | null>
```

- **Comportamiento**: lee `PerfilClienteSnapshot` vigente si existe y pertenece a `instanciaId`; si no existe ninguno (primer acceso), lo calcula bajo demanda (`recalcular`) y lo persiste antes de devolverlo. Devuelve `null` si el contacto no existe o no pertenece a `instanciaId` (FR-008).

## `PerfilClienteService.recalcular(contactoId, disparadoPor?)`

```ts
async function recalcular(contactoId: string, disparadoPor?: string): Promise<PerfilCliente>
```

- **Comportamiento**: (1) calcula `datosObjetivos` con `calculo-objetivo.ts` (queries agregadas); (2) clasifica `tipoRelacion` (research.md Decisión 2); (3) genera `senalesObjetivas` (research.md Decisión 3); (4) si `disparadoPor` es uno de `ConversacionCreada`/`ConversacionResumida`/`ConversacionClasificada`, dispara `extraccion-interpretada.ts` de forma tolerante a fallo y fusiona el resultado en `datosInterpretados` (conservando el interpretado anterior si la nueva extracción falla, en vez de borrarlo); (5) hace upsert de `PerfilClienteSnapshot`.
- **Idempotencia**: llamar dos veces seguidas con el mismo estado de datos produce el mismo resultado (upsert por `contactoId`, sin acumulación).

## `calcularDatosObjetivos(contactoId, instanciaId)` (`calculo-objetivo.ts`)

```ts
async function calcularDatosObjetivos(contactoId: string, instanciaId: string): Promise<DatosObjetivos>
```

- **Comportamiento**: agrega en paralelo (`Promise.all`, patrón ya establecido en el proyecto): conteo de `Pedido` con estado `ENTREGADO`, fecha mínima de interacción (`Contacto.creadoEn`), fecha máxima de pedido entregado, lista de productos de esos pedidos, oportunidades con `fechaGanada: null, fechaPerdida: null` (mismo filtro que `customer.tool.ts`), cotizaciones con `estado` en un conjunto "activo" (`BORRADOR`, `REVISADA`, `APROBADA`, `ENVIADA` — no `RECHAZADA`/`VENCIDA`), conteo de conversaciones con `clasificacion: "SOPORTE"` sin resolución posterior registrada, y el `metodoEntrega` más frecuente entre pedidos+cotizaciones históricos.

## `extraerDatosInterpretados(contactoId, instanciaId)` (`extraccion-interpretada.ts`)

```ts
async function extraerDatosInterpretados(
  contactoId: string,
  instanciaId: string,
): Promise<DatosInterpretados | null>
```

- **Comportamiento**: arma el texto reciente de las conversaciones del contacto (reutilizando el mismo criterio de presupuesto de tokens que `resolverDecisionContexto` de `009`/código existente), llama a `generarRespuesta({ tarea: "EXTRACCION_ENTIDADES", ... })` pidiendo un JSON con los campos de `DatosInterpretados`, parsea el resultado con Zod, y devuelve `null` si la IA no está habilitada, si la llamada falla, o si el resultado no es parseable — nunca lanza una excepción hacia el llamador (FR-007).

## `invalidar-perfil.suscriptor.ts` — consumidor RabbitMQ

- **Routing keys**: las de los eventos listados en `research.md` Decisión 1, más `CONVERSACION_CLASIFICADA` (nuevo).
- **Comportamiento**: extrae `contactoId` del payload de cada evento (cada contrato de evento ya incluye la referencia necesaria — `Pedido.contactoId`, `Cotizacion.contactoId`, `Oportunidad` vía `OportunidadContacto`, `Conversacion.contactoId`) y llama a `PerfilClienteService.recalcular(contactoId, disparadoPor: nombreDelEvento)`. Idempotente: procesar el mismo evento dos veces (entrega duplicada, ya contemplado por Constitution III) simplemente recalcula el mismo snapshot dos veces sin efecto acumulativo.

## Evento nuevo — `ConversacionClasificada` (`src/eventos/contratos/conversacion-clasificada.event.ts`)

```ts
interface ConversacionClasificadaPayload {
  conversacionId: string;
  contactoId: string | null;
  instanciaId: string;
  clasificacion: "NINGUNA" | "POSTVENTA" | "SOPORTE" | "COMERCIAL";
  clasificadoEn: string; // ISO datetime
}
```

- **Emisor**: `src/ai/tools/providers/transfer.tool.ts`, inmediatamente después del `updateMany` que ya existe hoy — agregado, no reemplazo de esa escritura.
