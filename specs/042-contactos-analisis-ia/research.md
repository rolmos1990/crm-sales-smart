# Research: Análisis inteligente de Contactos (042)

Decisiones de diseño tomadas a partir del código existente. Cada una cita el
código que la justifica. El orden sigue el flujo: marcado → planificación →
evaluación → escritura → auditoría.

---

## D1 — El estado pendiente vive en PostgreSQL, no en RabbitMQ

**Decision**: Una fila por contacto en `ContactoAnalisisCola` (estado,
prioridad, versión de datos, lease). El planificador reclama lotes con
`FOR UPDATE SKIP LOCKED`. RabbitMQ solo se usa para los eventos de dominio que
ya existen (entrada) y para publicar `ContactoAnalizado` (salida). Ningún
mensaje por contacto.

**Rationale**:
- El patrón ya está probado en Karia: `DisparadorJob` +
  `reclamarJobs()`/`recuperarJobsInterrumpidos()`
  (`src/crm/pipeline/disparadores/ejecutor.ts:469-510`) con `bloqueadoHasta`
  como lease y `SKIP LOCKED` para varios workers.
- RabbitMQ no permite elegir "el siguiente mensaje de la cuenta que lleva más
  tiempo esperando" sin una cola por cuenta (FR-032 lo prohíbe), y no
  deduplica por contacto (FR-007).
- `ConsumidorBase` reintenta 3 veces de inmediato, sin backoff
  (`src/shared/rabbitmq/consumidor.ts:6,103-112`), y la DLQ `crm.muertos` no
  tiene consumidor: no sirve para FR-035.
- Con la fila permanente, la deduplicación es un `upsert` y la versión es
  monótona (D4).

**Alternatives considered**:
- *Una cola de RabbitMQ por cuenta*: miles de colas, viola FR-032.
- *Una cola de RabbitMQ con prioridades*: no da justicia entre cuentas ni
  deduplicación.
- *Outbox general*: está fuera de alcance (spec). D3 cubre los eventos
  perdidos con un barrido.

---

## D2 — Planificación justa: stride scheduling sobre la configuración por cuenta

**Decision**: Cada cuenta tiene `siguienteTurnoEn` en
`ConfiguracionAnalisisContactos`. En cada ciclo, para cada espacio libre:

1. **Elegir la clase de prioridad** (P0/P1/P2) con cupos del 20/50/30 % de la
   concurrencia global. Si una clase no tiene trabajo, presta su espacio. P0 se
   evalúa siempre primero.
2. **Elegir la cuenta**: entre las habilitadas, con
   `lotesEnCurso < maxLotesSimultaneos` y con trabajo elegible de esa clase
   (`EXISTS` sobre el índice parcial de la cola), la de menor
   `siguienteTurnoEn`. Se toma con `FOR UPDATE SKIP LOCKED`.
3. **Avanzar su turno**:
   `siguienteTurnoEn = max(siguienteTurnoEn, now) + intervaloBase / peso`.
4. **Reclamar** hasta `tamanoLote` contactos de esa cuenta y clase, ordenados
   por `elegibleDesde` (`SKIP LOCKED` + lease).

La política (pasos 1 y 3) es una **función pura**
`elegirTurnos(estado, capacidad)` en `motor/planificador.ts`. Solo la consulta
(pasos 2 y 4) es SQL.

**Rationale**:
- Stride scheduling es Weighted Fair Queuing con un solo número por cuenta.
  Con lotes de tamaño similar equivale a Deficit Round Robin, sin mantener un
  déficit por cuenta.
- `siguienteTurnoEn` mide "cuánto lleva esperando" (spec FR-026). El `max(…,
  now)` evita que una cuenta que estuvo inactiva acumule crédito y monopolice
  al volver.
- Recorrer 1.000 filas de configuración en orden, probando `EXISTS` con el
  índice parcial, cuesta milisegundos. No hay `DISTINCT` sobre millones de
  filas pendientes.

**Alternatives considered**:
- *DRR con déficit explícito*: misma justicia, más estado que mantener.
- *Round-robin por cursor de cuenta*: no pondera ni considera la espera.
- *Elegir al azar ponderado*: no garantiza SC-007 (todos reciben turno antes
  del segundo de cualquiera).

---

## D3 — Marcado de pendientes: en línea + suscriptor + barrido

**Decision**: Una única función `marcarPendiente({instanciaId, contactoId,
prioridad, motivo, inmediato?})` en `src/crm/contactos/analisis/cola.ts`. Hace
un upsert: sube `versionDatos`, eleva la prioridad (nunca la baja) y fija
`elegibleDesde`. Se llama desde tres lugares:

1. **En línea**, en las funciones de `src/crm/contactos/interaccion.ts`
   (`registrarInteraccion`, `registrarMensajeEntrante`). Cubre mensajes,
   actividades y pedidos en el mismo punto donde la 041 ya escribe
   `ultimaInteraccionEn`. Hay seis llamadores (`conversaciones/actions.ts`,
   `envio.ts`, `actividades/actions.ts`, `pedidos/actions.ts`,
   `crear-pedido.tool.ts`, `generar-pedido-desde-cotizacion.service.ts`), que
   pasan `instanciaId` como parámetro opcional nuevo. Sin ese dato no se marca
   y el barrido lo recupera, para no sumar una consulta por mensaje.
   - Se ejecuta "sin fallar" y **siempre con el cliente global**, nunca con el
     `tx` del llamador: un error al marcar no puede abortar la transacción de
     quien llama.
   - La configuración de la ventana sale de una caché en memoria de 60 s, sin
     un upsert por mensaje.
   - La marca es una sola sentencia `INSERT ... ON CONFLICT DO UPDATE`.
2. **Por suscriptor**: `InvalidarPerfilSuscriptor` (pedido, cotización,
   oportunidad, etapa, conversación clasificada) recalcula la parte objetiva
   del perfil 012 y marca P1. Se agrega `CONTACTO_CREADO` → P2 (solo reglas).
   También se corrige `resolverContactoId` para filtrar por `instanciaId`.
   Para `CONVERSACION_CLASIFICADA` hay una bifurcación (FR-022):
   - **Análisis con IA activo y disponible para la cuenta**: no llama a la
     IA; marca **P0 inmediato**, para que la interpretación del agente no
     llegue más tarde que hoy.
   - **Análisis con IA desactivado o no disponible, pero
     `ConfiguracionIA.habilitado`**: llama a `recalcular(contactoId,
     instanciaId, envelope.tipo)` como hoy, con la extracción por evento
     (`extraccion-interpretada.ts`), y además marca P1 para las reglas. El
     agente conversacional no pierde información si el administrador apaga el
     análisis (FR-055).
   - La disponibilidad se decide con la misma función del motor
     (`evaluarDisponibilidadIA`), así que no hay dos criterios distintos.
3. **Barrido de reconciliación** cada 15 min: contactos con
   `ultimaInteraccionEn > cola.datosHasta`, o con
   `ContactoEvaluacion.proximaEvaluacionEn <= now`, en páginas de 1.000 por
   cursor. Cubre los eventos perdidos (hoy los eventos se publican con
   `void publicar(...)` después del commit, sin outbox).

**Ventana de agrupación**: `elegibleDesde = min(ahora + ventana, primerMarcado
+ esperaMaxima)`, con 5 y 30 min por defecto. P0 usa `inmediato`, que deja
`elegibleDesde = ahora`.

**Señal explícita de compra (P0)**: cuando `registrarLectura` de la ficha
(`src/ai/ficha-conversacion/servicio.ts:54`) guarda una intención
`LISTO_PARA_COMPRAR` o `LISTO_PARA_COTIZAR`.

**Alternatives considered**:
- *Solo suscriptores*: el mensaje entrante no tiene un evento propio que
  dispare el perfil, y se pierde si falla la publicación.
- *Trigger de PostgreSQL*: lógica de negocio escondida en la base, sin
  precedente en Karia.

---

## D4 — Versión monótona y escritura que no pisa datos más nuevos

**Decision**: La fila de cola es permanente (estado `AL_DIA` cuando no hay
nada pendiente), así que `versionDatos BigInt` solo crece.

- Al **reclamar** se guarda `versionReclamada`.
- Al **completar**:
  1. La evaluación se escribe solo si
     `ContactoEvaluacion.versionEvaluada < versionReclamada`
     (`updateMany … where versionEvaluada lt`, o `create` si no existe).
  2. La cola vuelve a `AL_DIA` solo si `versionDatos = versionReclamada`. Si
     llegaron datos nuevos durante el análisis, vuelve a `PENDIENTE`.

**Rationale**: Cumple FR-011 y FR-036 sin locks largos. Reprocesar es
idempotente.

**Alternatives considered**:
- *Borrar la fila al completar*: la versión vuelve a 1 y se rompe la
  comparación.
- *Versión en `Contacto`*: escribir en `Contacto` en cada mensaje agrega
  contención sobre la tabla más leída.

---

## D5 — Embudo reglas → IA

**Decision**: Todo lote pasa primero por `evaluarPorReglas` (pura). Un contacto
va a la IA solo si cumple todo esto:

- La cuenta tiene IA habilitada (`ConfiguracionIA.habilitado`), el análisis
  activo y un proveedor activo para `ANALISIS_CONTACTOS`.
- Tiene mensajes de conversación posteriores a `ContactoEvaluacion.iaHasta`,
  o hay un pedido explícito de un usuario (P0 manual, selección).
- En la clasificación inicial (P2, sin evaluación de IA previa): su
  `ultimaInteraccionEn` está dentro del plazo de antigüedad (12 meses por
  defecto).
- Hay presupuesto disponible (D9).

Los demás se cierran con origen `REGLA` en el mismo turno, sin llamar a la IA.

**Rationale**: Cumple FR-012 y SC-004. Los contactos sin conversación
(importados, cargados a mano) nunca cuestan IA.

---

## D6 — Datos del lote cargados en bloque

**Decision**: `cargarDatosLote(instanciaId, contactoIds[])` hace un número fijo
de consultas por lote (unas 6), no una por contacto:

| Dato | Consulta |
|---|---|
| Compras | `pedido.groupBy` por `contactoId` con `construirCondicionVenta(etapas)`: count, sum(total), max(fechaVenta) |
| Cotizaciones activas | `cotizacion.groupBy` por contacto, estados `ESTADOS_COTIZACION_ACTIVA` |
| Oportunidades abiertas | `oportunidadContacto.groupBy` (sin `fechaGanada`/`fechaPerdida`) |
| Actividades | `actividad` pendientes y vencidas por contacto |
| Seguimiento de la 041 | campos ya cargados del contacto + `calcularSeguimientoFila` |
| Conversación (solo los que van a la IA) | fichas `interpretado` de sus conversaciones actualizadas después de `iaHasta`; si una conversación no tiene lectura, sus últimos 12 mensajes posteriores a `iaHasta`, de hasta 300 caracteres cada uno |

**Rationale**:
- Evita el N+1 y los escaneos completos (spec sección 12).
- `ESTADOS_COTIZACION_ACTIVA` y `construirCondicionVenta` se reutilizan, así
  que "Cliente" sigue derivándose igual que en 038/041.
- La ficha solo tiene `interpretado` en conversaciones atendidas por el agente
  IA (`responder-con-agente.ts:396`). Las atendidas solo por personas usan
  mensajes recortados. Nunca se manda la conversación completa (FR-014).

---

## D7 — Reglas y puntaje

**Decision**: Funciones puras en `src/crm/contactos/analisis/reglas.ts` y
`puntaje.ts`.

**Relación comercial**:

| Valor | Condición |
|---|---|
| `PROSPECTO` | Sin compras |
| `CLIENTE` | Al menos 1 compra |
| `CLIENTE_RECURRENTE` | Compras ≥ `umbrales.comprasRecurrente` (2 por defecto) |
| `CLIENTE_INACTIVO` | Última compra anterior a `umbrales.diasInactivo` (90 por defecto). Tiene precedencia sobre `CLIENTE_RECURRENTE` |

**Puntaje**:
- **Base** de 0 a 60, como suma ponderada de factores normalizados: compras,
  recencia de interacción, documentos abiertos, actividad agendada y espera
  de respuesta. Los pesos vienen del criterio (`pesos`, que suman 1).
- **Ajuste de la IA** de −40 a +40.
- **Final** = `clamp(base + ajuste, 0, 100)`. Sin IA, el puntaje es solo la
  base.

**Próxima evaluación**: la fecha más temprana entre la próxima actividad
pendiente, el corte de "Por recuperar" de la 041
(`ultimaInteraccion + diasSeguimientoRecuperar`) y el de inactividad del
criterio. Si no hay ninguna, `null`.

**Relación con la 041**: `condiciones.ts` **no se toca** (FR-003). La relación
comercial es un dato del análisis, no un filtro de la lista. Los filtros por
relación quedan fuera de alcance.

**Alternatives considered**: *Agregar `condicionRecurrente` a `condiciones.ts`*.
No hace falta sin filtro, y el umbral pasa a ser configurable por criterio, no
por `ConfiguracionEmpresa`.

---

## D8 — Contrato con la IA

**Decision**:
- **Una llamada por lote**, a la tarea nueva `TareaIA.ANALISIS_CONTACTOS`
  (enum aditivo), con temperatura 0,2 y salida en JSON.
- **Prompt en tres capas** (detalle en `contracts/ia-analisis-lote.md`):
  1. Sistema fijo de Karia: formato, prohibiciones, datos tratados como no
     confiables.
  2. Criterio de la cuenta, delimitado y con largo máximo.
  3. Datos del lote como JSON, con referencias `c1…cN`.
- **Referencias del lote**: el modelo nunca ve el cuid del contacto. El mapa
  `ref → contactoId` vive en memoria del ejecutor.
- **Validación con Zod** (`salida.ts`), por contacto:
  - `ref` pertenece al lote y no está repetida.
  - Los enums son válidos.
  - `ajustePuntaje` es un entero entre −40 y 40.
  - Las listas tienen hasta 5 elementos de hasta 120 caracteres.
- **Filtro de privacidad** (FR-017a), en dos niveles:
  - *Verificado*: se rechaza el texto que contenga teléfonos, emails, URLs,
    secuencias de 7 o más dígitos, **direcciones** (palabra de vía —`calle`,
    `av.`, `avenida`, `jr.`, `jirón`, `pasaje`, `psje.`, `carrera`, `cra.`,
    `mz.`, `manzana`, `lote`— seguida de un número en los siguientes 15
    caracteres), o una subcadena de 25 o más caracteres copiada de los mensajes
    del lote (normalizados). Un contacto con texto rechazado cuenta como
    resultado inválido.
  - *Solo instruido*: salud, pago y otros datos sensibles sin forma
    reconocible se prohíben en el prompt fijo. Se controlan con una revisión
    de 50 evaluaciones antes de habilitar en producción (SC-018). No se
    intenta detectarlos con listas de palabras: darían falsos positivos sobre
    señales legítimas ("pregunta por formas de pago").
- **Mapeo de intención**:

  | IA | `NivelInteres` |
  |---|---|
  | ALTA | ALTO |
  | MEDIA | MEDIO |
  | BAJA | BAJO |
  | DESCONOCIDA | sin sugerencia |

- **Idioma**: la salida se pide en `ConfiguracionEmpresa.idiomaPrincipal`.
- **Lote no interpretable** (JSON inválido): se divide en mitades dentro del
  mismo turno, cada mitad como una atención nueva con el mismo `loteId` raíz,
  hasta llegar a un contacto (FR-018). Si lo que falla son contactos sueltos,
  solo esos vuelven a la cola con backoff.

**Rationale**: El modelo no puede devolver un id de otra cuenta (FR-054). La
salida no tiene ningún campo para hechos verificables (FR-020).

---

## D9 — Gateway, presupuestos y límites

**Decision — extensiones aditivas del gateway** (no cambian a los llamadores
actuales):

- `ChatParams.formatoRespuesta?: "json"`:
  - OpenAI y DeepSeek usan `response_format: { type: "json_object" }`.
  - Anthropic usa la instrucción del sistema más un prefijo `{` en el asistente.
- `ChatResult.tokensCacheados?`:
  - OpenAI: `usage.prompt_tokens_details.cached_tokens`.
  - DeepSeek: `usage.prompt_cache_hit_tokens`.
  - Anthropic: `usage.cache_read_input_tokens`.
- `UsoIA.tokensCacheados Int @default(0)` (columna nueva).
- `RespuestaIA` también devuelve `proveedorIAId`, `alias` y `costoEstimado`,
  para el snapshot de la atención.
- Si el proveedor lanza un error que trae `usage`, se registra (FR-040). Si
  el JSON es inválido, se registra igual porque el `usage` ya se conocía.

**Presupuestos y límites**, revisados **antes de reclamar** cada lote:

| Límite | Cómo se cuenta | Si se alcanza |
|---|---|---|
| Presupuesto propio de la cuenta (opcional, Clarifications Q3: sin valor por defecto) | Suma de `UsoIA` con `tarea = ANALISIS_CONTACTOS` en `rangoHoy(obtenerZonaNegocio)`. En costo si el proveedor tiene costos; si no, en tokens | Solo reglas hasta el día siguiente |
| `ConfiguracionIA.limiteTokensDiarios` de la cuenta (existe en el esquema y en el formulario, pero **hoy no lo aplica nadie**) | Suma de `UsoIA` de todas las tareas en el día del negocio | El análisis se detiene al llegar al 100 %. **Desde el 80 %, el histórico (P2) se pausa para esa cuenta**, para dejar margen al agente conversacional (spec FR-044a) |
| `ProveedorIA.limitePorMinuto` / `limitePorDia` (tampoco se aplican hoy) | Para esta tarea, contando `UsoIA` por `proveedorIAId` en la ventana | Ese proveedor no recibe turno hasta la ventana siguiente |
| Presupuesto global de Karia | Variable de entorno, sumando `UsoIA` de `ANALISIS_CONTACTOS` en el día UTC | Solo reglas en todas las cuentas |

Para no sumar `UsoIA` en cada turno, el consumo del día se cachea en memoria del
worker por cuenta durante 60 s, y se incrementa localmente con cada atención.
Con varios workers, el exceso posible queda acotado a un lote por worker
(SC-014).

**Alternatives considered**: *Aplicar `limiteTokensDiarios` a todo Karia en el
gateway*. Cambiaría el comportamiento del agente conversacional y viola
FR-055. Queda como deuda, documentada.

---

## D10 — Ejecución dentro del worker existente

**Decision**: `iniciarCicloAnalisisContactos()` se arranca en
`src/worker/disparadores.ts`, junto a `iniciarPollingCorreo()` y con un ciclo
propio (FR-033). Cada ciclo:

- Corre cada 2 s.
- Lleva un semáforo con la concurrencia global (variable de entorno, 3 por
  defecto).
- Ejecuta recuperación (D11), planificación y ejecución de lotes en paralelo
  hasta llenar el semáforo.
- Cada 15 min, el barrido (D3). Cada día, la retención (D13).

**Pausa del histórico desde el primer ciclo**: la selección de trabajo, tanto
la provisional FIFO como el planificador definitivo, excluye P2 si
`ANALISIS_CONTACTOS_HISTORICO_PAUSADO` está activo o si la cuenta tiene
`historicoPausado`. El barrido de reconciliación puede crear filas P2 (son
baratas e idempotentes), pero ninguna se procesa mientras la pausa siga. Así,
producción se despliega con la pausa global activa hasta completar el
planificador justo (Historia 4), y la clasificación inicial no corre sin
reparto entre cuentas.

"Analizar con IA" desde la app solo marca P0 con `inmediato`. El worker lo
toma en el siguiente ciclo (≤ 2 s), así que no hace falta publicar un comando.

**Rationale**:
- Mismo proceso, mismo despliegue, ninguna dependencia nueva (restricción del
  pedido: sin microservicios).
- Escalar es levantar otro worker: `SKIP LOCKED` reparte el trabajo (FR-031).

---

## D11 — Lease, recuperación, reintentos

**Decision**:
- **Lease**: `bloqueadoHasta = now + 2 × timeoutMs del proveedor + 30 s`
  (unos 90 s por defecto).
- **Recuperación** en cada ciclo, igual que `recuperarJobsInterrumpidos`:
  - Las filas de cola `EN_PROCESO` con lease vencido vuelven a `PENDIENTE`,
    con `intentos + 1`.
  - Las atenciones `EN_CURSO` con `leaseHasta < now` pasan a `ABANDONADA`.
  - Se recalcula `lotesEnCurso` de la cuenta.
- **Backoff**: `elegibleDesde = now + min(30 s × 2^intentos, 30 min) × (0,8 +
  0,4 × aleatorio)`.
- **Límite de intentos**: con `intentos ≥ 5` el contacto pasa a `FALLIDO` y no
  se reintenta solo (FR-035). "Reintentar fallidos" lo devuelve a `PENDIENTE`
  con `intentos = 0`.
- **Fallback de proveedor** (FR-025, SHOULD): ya existe en
  `seleccionarProveedor`, que recorre los proveedores activos con circuit
  breaker (`orquestador.ts`). Se aprovecha tal cual.

**Riesgo conocido**: el circuit breaker vive en memoria de cada proceso. Con
varios workers, cada uno aprende la falla por su cuenta. Es aceptable para
esta spec.

---

## D12 — Criterio por cuenta con versiones

**Decision**:
- `CriterioAnalisisContactos`: uno por cuenta, con puntero a la versión
  publicada.
- `CriterioAnalisisContactosVersion`: `numero`, `estado` (BORRADOR, PUBLICADA,
  ARCHIVADA), `contenido Json` validado con Zod, `plantillaOrigen`. Es el mismo
  patrón que `AgenteIAConfigVersion` (009).
- **Plantillas en código** (`criterio/plantillas.ts`, como
  `src/ai/estrategia/plantillas-default.ts`): General, Comercio minorista,
  Servicios / citas y Venta B2B.
- **Sin siembra**: si una cuenta no tiene criterio, se usa "General" en
  memoria y la evaluación guarda `criterioVersionId = null` más
  `plantillaAplicada = "GENERAL"`.
- **Contenido**: `instrucciones` (hasta 2.000 caracteres), `senalesCompra[]`,
  `objecionesTipicas[]` (hasta 15 de 120 c/u), `umbrales {comprasRecurrente,
  diasInactivo}`, `pesos {compras, recencia, documentosAbiertos,
  actividadAgendada, esperaRespuesta}`.

**Rationale**: Sin migración de datos. Las versiones permiten auditar con qué
criterio se hizo cada evaluación (FR-005).

---

## D13 — Auditoría y retención

**Decision**:
- **`EjecucionAnalisisContactos`**: una fila por intento (FR-037). Se crea
  `EN_CURSO` antes de llamar a la IA y se cierra después. Si falla la
  escritura de cierre, la recuperación (D11) la marca `ABANDONADA`; el trabajo
  ya se recuperó por la cola, que es la fuente de verdad del trabajo
  (FR-042).
- **Conteo lógico sin duplicados** (FR-038): la cola registra
  `ultimaEjecucionId`, y la finalización del contacto se cuenta en la cola,
  no en las atenciones.
- **`EjecucionAnalisisContactosItem`**: detalle por contacto. Se purga a los
  90 días.
- **`ResumenDiarioAnalisisContactos`**: agregado por cuenta y día. Se calcula
  con un upsert diario antes de purgar y se conserva para siempre.
- **Sin texto de conversaciones ni prompts** (FR-041). `errorMensaje` se
  sanitiza: se cortan 300 caracteres y se enmascaran secuencias con forma de
  clave (`sk-…`, `Bearer …`).
- **Las atenciones solo por reglas también se registran**, con
  `proveedor = null` y tokens en 0. Así el avance puede contar "resueltos por
  reglas".

**Volumen estimado**: con 1.000 cuentas × 10.000 contactos, unos 2,5 M de
evaluaciones por mes en régimen, son unos 125.000 lotes al mes: atenciones
chicas. El detalle se mantiene en unos 7,5 M de filas con la retención de
90 días, sin particionar. Particionar por mes se reevalúa por encima de
50 M.

---

## D14 — Sugerencias y modo de aplicación

**Decision**:
- **Columnas nuevas en `ContactoEvaluacion`**: `interesSugerido`,
  `interesSugeridoEstado` y `noContactarSugerido`, `noContactarMotivo`,
  `noContactarSugeridoEstado`. Los estados posibles son PENDIENTE, ACEPTADA,
  DESCARTADA y REEMPLAZADA.
- **Modo `SOLO_SUGERIR`** (el inicial): se guarda la sugerencia y no se toca
  `nivelInteres`.
- **Modo `APLICAR_AUTOMATICO`**: después del commit de la evaluación se llama
  a `actualizarInteres({ origen: "IA", accion: FIJAR })`. Si devuelve
  `FIJADO`, se ignora; es lo esperado.
- **Aceptar o descartar** son server actions que, si aceptan, llaman a
  `actualizarInteres` o `actualizarPreferenciaContacto` con `origen: "MANUAL"`
  (Clarifications Q1/Q2).
- **Interés fijado a mano**: cuando una persona fija el interés,
  `actualizarInteres` (rama manual) marca la sugerencia pendiente como
  REEMPLAZADA en la misma transacción. Es un `updateMany` de una línea: el
  único cambio dentro de `clasificacion.ts` y no altera sus reglas.
- **No contactar descartado**: no se vuelve a sugerir salvo que haya un rechazo
  nuevo posterior a `noContactarResueltoEn`. La IA recibe ese dato en el
  contexto.

---

## D15 — Columna "Puntaje" en la tabla

**Decision**:
- `Contacto.puntajeComercial Int?` materializado, escrito en la misma
  transacción que `ContactoEvaluacion`.
- Índice `[instanciaId, puntajeComercial]`.
- `vista.ts` agrega `orden = "PUNTAJE"` con
  `{ puntajeComercial: { sort, nulls: "last" } }`.

**Rationale**:
- Ordenar 20.000 filas por un campo de una relación 1:1 obliga a un join en
  cada página. La columna con índice sostiene SC-017, con el mismo criterio
  que `nivelInteres`.
- No contradice la regla 10 de CLAUDE.md: el puntaje no se deriva de la
  configuración vigente del flujo, sino que es el resultado de una evaluación
  con fecha, igual que el interés.

---

## D16 — Feature activa por defecto y clasificación inicial

**Decision**: la configuración por cuenta se crea de forma perezosa (upsert en
el primer `marcarPendiente`), con `habilitado = true` (Clarifications Q1). El
script `scripts/042-encolar-clasificacion-inicial.ts` (patrón de
`041-sembrar-interes-contactos.ts`):

- Recorre las cuentas y sus contactos por cursor, en páginas de 1.000.
- Inserta filas de cola P2 con `ON CONFLICT DO NOTHING`.
- Es idempotente.

Que un contacto vaya a la IA o se resuelva por reglas se decide al procesarlo
(D5, antigüedad de 12 meses).

---

## D17 — Pruebas

**Decision**:
- **Vitest (unitarias puras; el proyecto no tiene vitest contra base de
  datos)**:
  - Planificador con 1.000 cuentas simuladas (SC-007/008, pesos, cupos,
    préstamo, pausa del histórico).
  - Reglas, puntaje, validación de salida (ids ajenos o duplicados, faltantes,
    rangos, privacidad).
  - Backoff, ventana de agrupación, mapeo de intención.
  - Ejecutor con Prisma y gateway simulados (`vi.mock`, 67 tests ya usan este
    patrón): resultado parcial, división de lote, error con consumo, guarda
    de versión.
- **Simulador de carga** (`scripts/042-simular-carga-analisis.ts`) contra una
  base de desarrollo:
  - Crea N cuentas y M contactos sintéticos.
  - Corre K ciclos del motor con un **ejecutor de IA inyectado** (latencia y
    tasa de error configurables) en varios procesos.
  - Verifica que no haya doble toma, la justicia entre cuentas y la
    recuperación después de matar un proceso.
  - No agrega un valor `SIMULADO` a `ProveedorIAEnum`: el ejecutor de IA es
    una dependencia del motor.
- **Playwright**: panel "Análisis de IA", "Analizar con IA", sugerencias,
  columna Puntaje, configuración y criterio, permisos.

**Alternatives considered**: *Un proveedor `SIMULADO` en el enum*. Contamina
producción con un valor de prueba.
