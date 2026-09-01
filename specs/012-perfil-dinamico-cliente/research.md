# Research: Perfil dinámico del cliente

## Decisión 1 — Lista cerrada de eventos relevantes para invalidación (FR-005, FR-006)

**Decisión**: el perfil de un contacto se recalcula únicamente en reacción a estos eventos de dominio ya existentes en `src/eventos/catalogo.ts` (confirmados por inspección, no supuestos): `PedidoCreado`, `PedidoActualizado`, `PedidoEntregado`, `CotizacionCreada`, `CotizacionActualizada`, `CotizacionAprobada`, `OportunidadCreada`, `OportunidadActualizada`, `OportunidadGanada`, `OportunidadPerdida`, `EtapaCambiada`. Se agrega un evento nuevo, **`ConversacionClasificada`**, emitido cuando `Conversacion.clasificacion` cambia (hoy `transferir_a_humano.tool.ts` lo actualiza con un `updateMany` directo sin publicar evento — gap confirmado por inspección) — necesario para que "incidencia activa" (basada en `clasificacion: SOPORTE`) pueda invalidar el perfil sin sondeo.

**Rationale**: son exactamente los sucesos que cambian alguno de los campos objetivos del perfil (FR-001). Ninguno de estos eventos existe hoy con otro propósito que se esté reutilizando incorrectamente — es una lista cerrada y verificable contra el catálogo real del proyecto, no una lista aspiracional.

**Alternativas consideradas**: recalcular en un cron periódico (ej. cada hora) — rechazada porque no cumple FR-005 ("sin esperar a que llegue un nuevo mensaje", que implícitamente pide reflejar el cambio tan pronto como sea razonable, no con una demora fija); invalidar por *cualquier* evento de las entidades relacionadas (más simple pero más ruidoso) — rechazada porque dispararía recálculos innecesarios ante cambios que no afectan ningún campo del perfil (por ejemplo, un cambio de nota interna en un pedido).

## Decisión 2 — Criterio de clasificación de `tipoRelacion`

**Decisión**: función pura `clasificarTipoRelacion(datos: { pedidosCompletados: number; fechaPrimeraInteraccion: Date; fechaUltimaCompra: Date | null; tieneIncidenciaActiva: boolean })`:

1. Si `tieneIncidenciaActiva` → `CLIENTE_CON_INCIDENCIA` (máxima prioridad — una incidencia abierta importa más que el historial de compra para decidir cómo tratarlo).
2. Si `pedidosCompletados === 0` y no hay ninguna interacción previa a la actual → `NUEVO_CONTACTO`.
3. Si `pedidosCompletados === 0` pero hay interacciones previas (conversaciones anteriores sin compra) → `PROSPECTO_RECURRENTE`.
4. Si `pedidosCompletados >= 1` y la última compra fue reciente (dentro de una ventana configurable, default 90 días) → `CLIENTE_REGULAR` si `pedidosCompletados >= 2`, o `CLIENTE_NUEVO` si es exactamente 1.
5. Si `pedidosCompletados >= 1` pero la última compra excede la ventana → `CLIENTE_INACTIVO`.

**Rationale**: reglas deterministas, explicables, y basadas 100% en datos objetivos ya definidos como campos del perfil — sin necesidad de IA para esta clasificación, lo que la hace instantánea, gratuita y testeable con casos exactos.

**Alternativas consideradas**: delegar la clasificación a un LLM — rechazada porque introduce costo, latencia y no-determinismo para una decisión que es una función directa de datos ya calculados; el pedido original tampoco sugiere que esto requiera interpretación, solo los campos de presupuesto/ocasión/preferencias sí la requieren.

## Decisión 3 — Generación de `senalesObjetivas: string[]` sin adjetivos (FR-003)

**Decisión**: plantillas de texto parametrizadas por regla, no generación libre de un LLM. Ejemplos: `pedidosCompletados > 0` → `"Ha completado {n} pedido(s), el más reciente el {fecha}."`; `cotizacionesActivas.length > 0` → `"Tiene {n} cotización(es) activa(s) sin resolver."`; conteo de veces que se detectó intención `COMPARANDO` en interpretaciones pasadas → `"Ha comparado precios en {n} conversación(es) distintas."` (ejemplo textual del propio pedido original).

**Rationale**: garantiza por construcción que ninguna señal contiene un juicio de valor — una plantilla fija no puede "decidir" usar un adjetivo subjetivo, a diferencia de pedirle a un LLM que "no use etiquetas despectivas" (que es una instrucción, no una garantía). Esto también hace que FR-003/SC-003 sean 100% verificables con tests unitarios exactos, no con revisión muestral de output de IA.

**Alternativas consideradas**: usar el proveedor de IA para resumir el perfil en señales — rechazada por el motivo de garantía anterior; se reserva el uso de IA únicamente para lo que genuinamente requiere interpretación de texto libre (datos interpretados, Decisión 4), no para reformular datos que ya son estructurados.

## Decisión 4 — Extracción interpretada: cuándo correr y cómo tolerar fallo

**Decisión**: `extraccion-interpretada.ts` se invoca de forma asíncrona (no bloqueante) usando `TareaIA.EXTRACCION_ENTIDADES` sobre el texto reciente de las conversaciones del contacto, cuando se recalcula el perfil por un evento de conversación (`ConversacionCreada`, `ConversacionResumida`, `ConversacionClasificada`) — no en cada evento de Pedido/Cotización/Oportunidad, que no aportan nueva información conversacional para interpretar. Si la llamada falla o no hay IA habilitada para la instancia, el snapshot se guarda igual con `datosInterpretados: null` y `datosObjetivos` completos (FR-007).

**Rationale**: evita gastar una llamada de IA en eventos que no cambian nada interpretable (por ejemplo, un cambio de etapa de oportunidad no agrega información nueva sobre presupuesto u ocasión); se apoya en el enrutamiento de `010` (esta tarea ya es candidata a proveedor económico).

**Alternativas consideradas**: correr la extracción en cada invalidación sin distinción de tipo de evento — rechazada por costo innecesario; correr la extracción de forma síncrona bloqueando el cálculo del perfil — rechazada porque contradice FR-007 (la disponibilidad del perfil objetivo no debe depender de la IA).

## Decisión 5 — Emitir `ConversacionClasificada` (cambio mínimo fuera de este módulo)

**Decisión**: se agrega la publicación de este evento en el único punto donde `Conversacion.clasificacion` cambia hoy (`src/ai/tools/providers/transfer.tool.ts`) y en cualquier otro punto de escritura de ese campo que se descubra durante la implementación. Es un agregado (publicar un evento más), no una modificación de la lógica existente — no cambia el comportamiento de la transferencia a humano.

**Rationale**: es el único gap real encontrado entre "lo que el perfil necesita observar" y "lo que Karia ya publica" — sin este evento, "incidencia activa" solo podría detectarse por sondeo periódico, lo que violaría FR-006.
