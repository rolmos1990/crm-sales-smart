# Research: Segmentación comercial de Contactos (041)

Cada decisión cita el código que la motiva. Formato: Decisión · Por qué · Alternativas descartadas.

---

## D1 — Las reglas de segmento y seguimiento se expresan como `Prisma.ContactoWhereInput`, no como SQL crudo

**Decisión**: Un módulo puro `src/crm/contactos/segmentacion/condiciones.ts` (sin Prisma en runtime, solo sus tipos — mismo criterio que `src/sales/pedidos/condicion-venta.ts`) construye un `where` por cada concepto: `condicionCliente`, `condicionInteresado`, `condicionLead`, y uno por estado de seguimiento. Los umbrales en días se convierten **antes** en fechas de corte (`Date`) a partir de `ahora`, así que cada regla de FR-028 se reduce a comparaciones `gte`/`lt` sobre columnas y `some`/`none` sobre relaciones.

Ejemplo de forma (no es el código final):

```ts
cliente      = { pedidos: { some: construirCondicionVenta(etapas) } }
senal        = { OR: [ { oportunidades: { some: { oportunidad: { fechaGanada: null, fechaPerdida: null } } } },
                       { cotizaciones: { some: { estado: { in: ESTADOS_COTIZACION_ACTIVA } } } } ] }
interesado   = { OR: [ { nivelInteres: { in: ["ALTO", "MEDIO"] } },
                       { AND: [ senal, { NOT: { nivelInteres: "BAJO", nivelInteresFijado: true } } ] } ] }
```

**Por qué**: la tabla, los conteos de los cinco indicadores, las pestañas, el filtro de seguimiento y el orden por prioridad usan **las mismas** reglas. Si se escriben una vez como `where`, un conteo y una página nunca pueden contradecirse, y las reglas se prueban como funciones puras (entrada → árbol de `where`), igual que `construirCondicionVenta`. Prisma parametriza todo; no hay concatenación de SQL.

**Alternativas**: (a) `$queryRaw` con `CASE` para todo — duplica las reglas en SQL y las vuelve difíciles de probar; (b) materializar tipo o seguimiento en el contacto — prohibido para Cliente por la regla 10 de CLAUDE.md, e incorrecto para seguimiento porque depende de `ahora` y de umbrales configurables.

---

## D2 — Orden por prioridad de atención (FR-012) sin SQL crudo: paginación por tramos

**Decisión**: La prioridad tiene cuatro tramos mutuamente excluyentes, cada uno un `where` de D1 combinado con `NOT` de los anteriores:

1. T1 — mensaje sin responder (`esperandoRespuestaDesde` no nulo)
2. T2 — Pendiente de seguimiento y no T1
3. T3 — Por recuperar y no T1/T2
4. T4 — el resto

Se piden en paralelo los cuatro `count` (filtrados además por búsqueda y filtros activos). Con esos conteos se calcula qué tramos cubre la página pedida y con qué `skip`/`take` dentro de cada uno; normalmente son uno o dos `findMany`, cada uno ordenado por `ultimaInteraccionEn desc nulls last`, con `id` como desempate estable.

**Por qué**: mantiene una sola definición de las reglas (D1) y solo usa índices simples. Los conteos ya hacen falta para las pestañas (D7), así que el costo extra es bajo.

**Alternativas**: `ORDER BY CASE …` en `$queryRaw` — más corto en SQL pero duplica las reglas; materializar una columna de prioridad — se desactualiza con el paso del tiempo y con cambios de umbral. **DT-01** queda abierto hasta medirlo con 20.000 contactos (ver quickstart, escenario de rendimiento).

---

## D3 — `ultimaInteraccionEn` y `esperandoRespuestaDesde` se materializan en `Contacto`, escritos en línea en cada punto de escritura

**Decisión**: Dos columnas nuevas en `Contacto`, actualizadas por un único helper `src/crm/contactos/interaccion.ts`:

- `registrarInteraccion(contactoId, fecha)` — `ultimaInteraccionEn = GREATEST(actual, fecha)` (con `updateMany` y `where: { OR: [{ultimaInteraccionEn: null}, {ultimaInteraccionEn: {lt: fecha}}] }`, así mensajes fuera de orden no la hacen retroceder).
- `registrarMensajeEntrante(contactoId, fecha)` — llama a la anterior y además pone `esperandoRespuestaDesde = fecha` solo si estaba en `null` (conserva el primer mensaje sin respuesta).
- `registrarRespuesta(contactoId)` — `esperandoRespuestaDesde = null`.

Puntos de llamada (verificados):

| Punto | Archivo | Interacción | Respuesta |
|---|---|---|---|
| Mensaje entrante del contacto | `src/conversaciones/actions.ts:514` | sí (entrante) | — |
| Eco desde la app nativa del canal (lo escribió una persona fuera de Karia) | `src/conversaciones/actions.ts:616` | sí | sí |
| Envío desde Karia por una persona | `src/conversaciones/envio.ts:69` con `autor: "PERSONA"` | sí | sí |
| Envío automático de la IA o un Workflow | `src/conversaciones/envio.ts:69` con `autor` automático | **no** | sí |
| Nota interna | `envio.ts` con `esNotaInterna` | no | no |
| Actividad creada por una persona | `src/crm/actividades/actions.ts:30` | sí | — |
| Pedido creado (manual, desde cotización, por la herramienta de IA) | `src/sales/pedidos/actions.ts:143`, `src/sales/cotizaciones/services/generar-pedido-desde-cotizacion.service.ts:116`, `src/ai/tools/providers/crear-pedido.tool.ts:203` | sí | — |

No cuentan: actividades creadas por disparadores (`crm/pipeline/disparadores/ejecutor.ts`) ni por Workflows (`workflows/motor/adaptadores.ts:69,93`) — son automáticas (clarificación 1); la importación (`crm/datos/actions.ts`) la cubre el backfill.

**Por qué**: ordenar y filtrar miles de contactos por un `MAX` sobre mensajes, actividades y pedidos en cada consulta no escala. Son **hechos con fecha**, no dependen de configuración, así que materializarlos no viola la regla 10 (que protege lo que depende de la configuración vigente, como `cuentaComoVenta`). Se escriben en línea —igual que el `conversacion.update({ actualizadoEn })` que ya existe al lado— y no por suscriptor, para que la lista refleje el mensaje en el mismo render sin depender de la cola.

**Alternativas**: suscriptor a `MensajeRecibido`/`MensajeEnviado`/`ActividadCreada`/`PedidoCreado` — consistencia eventual y más piezas para un `UPDATE` de una fila; vista materializada — refresco periódico, deja de ser "al instante".

---

## D4 — Distinguir mensajes de personas de mensajes automáticos

**Hallazgo**: hoy **no se puede distinguir**. La IA (`ai/respuesta/responder-con-agente.ts:312`), los Workflows (`workflows/motor/adaptadores.ts:15`) y las personas (`conversaciones/actions.ts:772`) crean el mensaje con `remitente: "AGENTE"`, y la UI no envía `usuarioId` (`inbox-layout.tsx:695`, `panel-conversacion.tsx:194`), así que `MensajeConversacion.usuarioId` queda en `null` también para las personas.

**Decisión**:
- `enviarMensajeInterno` recibe un parámetro obligatorio `autor: "PERSONA" | "IA" | "WORKFLOW"`, que reemplaza al opcional `origen?: "WORKFLOW"` (`origen === "WORKFLOW"` ⇔ `autor === "WORKFLOW"`; se conserva el comportamiento de `procesarPrimeraRespuestaProspecto`).
- `enviarMensaje` (Server Action, `conversaciones/actions.ts`) pasa `autor: "PERSONA"` y `usuarioId` **tomado de la sesión**, no del input del cliente.
- La IA pasa `autor: "IA"`; los Workflows y la aprobación de sugerencias en modo Workflow (`ai/autonomia/actions.ts:25`) pasan `autor: "WORKFLOW"`.
- El `remitente` sigue siendo `AGENTE` para todos: cambiarlo afectaría la UI del chat y `workflows/motor/motor.ts:572`. La distinción persistida es `usuarioId` no nulo.

**Por qué**: hace obligatorio decidir el autor en cada llamada nueva (el compilador obliga), y corrige de paso un dato que ya debería guardarse (`usuarioId`: "agente que envió").

**Backfill**: como el historial no distingue, `ultimaInteraccionEn` inicial se calcula con mensajes `CONTACTO` y `AGENTE_CANAL_NATIVO`, actividades que no crearon un Workflow ni un disparador (su `metadata` no tiene `workflowEjecucionId` ni `disparadorId`; las actividades de una persona no guardan `usuarioId`, así que ese campo no sirve para distinguirlas), y pedidos. Los mensajes `AGENTE` históricos se excluyen: subestima un poco la última interacción de cuentas donde respondían personas desde Karia, lo que en el peor caso adelanta un "Pendiente" — preferible a esconder contactos tras respuestas automáticas.

---

## D5 — "No contactar": el corte vive en `enviarMensajeInterno`, más dos cortes tempranos

**Decisión**:
1. **Corte principal** en `enviarMensajeInterno`, antes de crear el mensaje (mismo lugar que el corte de aprobación 034): si `conversacion.contacto.noContactarDesde` no es nulo y `autor !== "PERSONA"`, devuelve `{ ok: false, error: MENSAJE_NO_CONTACTAR }`. Cubre la IA, los Workflows y cualquier envío automático futuro, porque todos pasan por aquí.
2. **Cortes tempranos** (evitan gastar tokens o ejecutar un Workflow que luego no puede enviar): `suscriptores/ai/orquestar-ia.suscriptor.ts` (junto a `bloqueadaPorAprobacion`, línea ~82) y `workflows/motor/disparo.ts` (junto al corte 3 de 3, línea ~54, devolviendo `atendido: true`). Ambos ya cargan la conversación; se agrega `contacto: { select: { noContactarDesde: true } }` al `select`.
3. **Envío de una persona**: no se bloquea. El compositor de mensajes muestra un aviso persistente cuando el contacto está en "No contactar" (FR-025). El dato llega con la conversación que el inbox ya carga.

**Workflows proactivos**: un Workflow en espera que despierta y manda un mensaje pasa por `adaptadores.enviarMensaje` → `enviarMensajeInterno` → corte principal → `throw new Error(...)`. Hay que tratarlo como **error definitivo** (`ErrorDefinitivoWorkflow`) para que no reintente. Se agrega al `if` de `adaptadores.ts:20`.

**Por qué no** una bandera derivada en `Conversacion` (como `bloqueadaPorAprobacion`): esa bandera existe porque la aprobación es por identificador de canal; "No contactar" es por contacto y `enviarMensajeInterno` ya hace `include: { contacto: true }`, así que no hay consulta extra.

---

## D6 — Interés: columnas en `Contacto` + historial aparte

**Decisión**: `nivelInteres` (enum `NivelInteres`: `ALTO`, `MEDIO`, `BAJO`, `SIN_EVALUAR`, **en ese orden**, así `orderBy: { nivelInteres: "asc" }` ordena de Alto a Sin evaluar con el orden nativo del enum de PostgreSQL), `nivelInteresOrigen` (enum `OrigenClasificacion`: `MANUAL`, `REGLA`, `IA`), `nivelInteresFijado` (bool), `nivelInteresActualizadoEn`. Cada cambio escribe en la misma transacción una fila de `ContactoClasificacionHistorial`.

**Liberar el valor fijado (DT-02)**: `nivelInteresFijado = false`, `nivelInteres = SIN_EVALUAR`, origen `MANUAL`, con su fila de historial.

**Por qué columnas y no una tabla 1:1**: el interés se filtra, se cuenta y se ordena en cada consulta del listado; en `Contacto` evita un join en todas ellas. La 042 agregará su tabla de evaluación de IA (score, motivo, evidencias) y escribirá aquí solo el valor vigente cuando `nivelInteresFijado` sea `false`.

**Alternativa**: reutilizar `PerfilClienteSnapshot.datosInterpretados` (JSON) — no indexable ni ordenable.

---

## D7 — Conteos de indicadores y pestañas

**Decisión**: `obtenerConteosSegmentos(instanciaId, contexto)` corre en `Promise.all` los `count` de Total, Cliente, Interesado, Por recuperar y Lead **sin** los filtros de la barra (los indicadores describen la cartera, no el filtro activo). Las pestañas muestran esos mismos números. Los cuatro conteos de tramos de D2 sí aplican los filtros activos, porque sirven para paginar.

**Por qué**: FR-001 pide los indicadores "sobre todos los contactos de la cuenta". Si dependieran del filtro, al hacer clic en "Interesados" el indicador "Clientes" mostraría la intersección, que confunde.

---

## D8 — Filtros, paginación y estado: `useVistaFiltrada`

**Decisión**: igual que Pedidos (`src/sales/pedidos/vista.ts`, `components/vista-pedidos.tsx`, `consultarVistaPedidosAction`): `cargarVistaContactos(instanciaId, zonaNegocio, filtros, etapas)` en `src/crm/contactos/vista.ts`; la página la llama con los filtros por defecto y pasa `inicial`; el cliente usa `useVistaFiltrada` con `consultarVistaContactosAction`. Los filtros incluyen página, tamaño de página, orden, segmento, búsqueda, tipo, interés, canal, rango de última actividad, seguimiento y preferencia de contacto, validados con Zod en la acción.

Los rangos de "Última actividad" (Hoy, 7, 30, más de 30 días) y los cortes de seguimiento salen de `obtenerZonaNegocio` y de los helpers de `src/shared/fechas/rangos.ts` (rangos semiabiertos `{ gte, lt }`). "Hoy" empieza al inicio del día de negocio; "7 días" es `gte: inicioDelDía − 6 días`.

---

## D9 — Canal: filtro por identificadores, columna por última conversación

**Decisión**:
- Filtro: `identificadoresCanal: { some: { canal: { in: canalesDelGrupo } } }`. Los valores de `ContactoIdentificadorCanal.canal` en uso son `whatsapp`, `whatsapp_lite`, `instagram`, `facebook_messenger`, `email`; la UI agrupa `whatsapp` + `whatsapp_lite` como "WhatsApp". El mapa grupo → valores vive en un archivo de constantes del módulo.
- Columna: por cada fila de la página, `conversaciones: { orderBy: { actualizadoEn: "desc" }, take: 1, select: { cuentaCanal: { select: { canal: true } } } }`. Solo para las filas de la página (≤ 100).

---

## D10 — Siembra del interés desde el perfil 012 (FR-026)

**Decisión**: script de datos idempotente `scripts/041-sembrar-interes-contactos.ts` (se ejecuta una vez; solo toca contactos con `nivelInteresOrigen` nulo). Equivalencias:

| `intencionComercialActual` (012) | Interés |
|---|---|
| `LISTO_PARA_COMPRAR`, `LISTO_PARA_COTIZAR` | ALTO |
| `CONSULTANDO_PRECIO`, `CONSULTANDO_DISPONIBILIDAD`, `COMPARANDO`, `SOLICITANDO_RECOMENDACION`, `REQUIERE_SEGUIMIENTO`, `ESPERANDO_INFORMACION` | MEDIO |
| `EXPLORANDO` | BAJO |
| `REQUIERE_ATENCION_HUMANA`, `null`, sin perfil | SIN_EVALUAR (sin origen) |

Origen `IA`, `nivelInteresFijado = false`, una fila de historial por contacto sembrado. La tabla se documenta en el mismo archivo.

El mismo script hace el backfill de `ultimaInteraccionEn` y `esperandoRespuestaDesde` (D4) con `UPDATE … FROM (subconsulta)` por instancia, en lotes.

---

## D11 — Perfil 012 cuenta compras con la condición de venta (FR-027)

**Decisión**: `src/ai/perfil-cliente/calculo-objetivo.ts:27` reemplaza `estado: "ENTREGADO"` por `...construirCondicionVenta(await obtenerEtapasFlujoActivo(instanciaId))`. La fecha de última compra pasa a usar `fechaVenta ?? fechaEntrega ?? creadoEn` (038 sella `fechaVenta` al entrar a una etapa que cuenta). Sus tests (`calculo-objetivo.test.ts`) se amplían con el caso de flujo con etapa marcada y el de flujo sin ninguna marcada (debe dar 0 compras, no "todas").

---

## D12 — Seguimiento de un contacto "No contactar" que vuelve a escribir

**Observación**: FR-028 (regla 1: mensaje sin responder → Pendiente) y FR-029 ("No contactar" nunca queda Pendiente "por reglas de fechas") no chocan: la regla 1 no es de fechas. **Decisión**: si un contacto en "No contactar" escribe, su seguimiento es Pendiente (entra al tramo T1 del orden) y la recomendación sigue FR-031 al pie de la letra: "No contactar" va antes que "Responder". La persona que abre la conversación ve el aviso de FR-025 y decide. Si el usuario prefiere que en ese caso la recomendación sea "Responder", es un cambio de orden en una lista.

---

## D13 — Índices

`Contacto(instanciaId, ultimaInteraccionEn)`, `Contacto(instanciaId, nivelInteres)`, `Contacto(instanciaId, esperandoRespuestaDesde)`, `Contacto(instanciaId, noContactarDesde)`; y, porque hoy faltan y las reglas hacen `EXISTS` por contacto: `Pedido(contactoId)`, `Cotizacion(contactoId)`, `OportunidadContacto(contactoId)`, `Actividad(contactoId, completada, fecha)`, `ContactoIdentificadorCanal(contactoId, canal)` (reemplaza a `contactoId` solo). Todos aditivos.

---

## D14 — UI y componentes

- **Indicadores**: `contactos-indicadores.tsx`, mismo markup y tokens de acento que `src/sales/pedidos/components/pedidos-kpi-cards.tsx` (`text-primary bg-primary-muted`, `text-stage-*-text bg-stage-*-muted`), pero como botones con `aria-pressed`. No se extrae un primitivo compartido todavía: los de Pedidos no son interactivos. Si un tercer módulo los necesita, se extraen (anotado para `design-systems`).
- **Tabla**: no se usa `DataTable` (pagina en cliente); se usa `Table` de `src/components/ui/table.tsx` con paginación controlada, como `lista-pedidos.tsx`. En móvil (`< md`) se renderiza una lista de tarjetas.
- **Panel lateral**: `Sheet` (`src/components/ui/sheet.tsx`) del lado derecho; ancho completo en móvil. Su contenido se carga con una Server Action (`obtenerResumenContactoAction`) vía TanStack Query cuando se abre.
- **Selects**: todos los filtros con valor ≠ etiqueta reciben `items` (`docs/selects.md`).
- **Componentes reutilizados que se pasan a tokens**: `panel-perfil-cliente.tsx` (si se muestra en el panel), `avatar-contacto.tsx`.
- **"No contactar" en el compositor**: aviso en `inbox-layout.tsx` y `panel-conversacion.tsx`.

---

## D15 — Eventos de dominio

`ContactoInteresActualizado` y `ContactoPreferenciaContactoActualizada` (pasado, versión 1), contratos en `src/eventos/contratos/`, nombres en `EventosSistema`, documentados en `docs/eventos.md`. Se publican después del commit de la transacción. No hay suscriptores en esta spec; la 042 y los Workflows podrán usarlos.
