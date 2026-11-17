# Research: Inbox agrupado por contacto

**Feature**: 035-inbox-agrupado-contacto | **Fecha**: 2026-11-16

Esta feature no tenía incógnitas tecnológicas que resolver —no hay dependencias nuevas ni integraciones—,
pero sí ocho decisiones de diseño con consecuencias reales. Cada una está apoyada en el código actual, con
archivo y línea, para que la implementación no tenga que re-descubrirlo.

---

## Decisión 1 — La lógica de agrupación va en un módulo puro, no en el componente

**Decisión**: crear `src/conversaciones/agrupacion.ts` sin ninguna importación de React, y dejar
`inbox-layout.tsx` como consumidor.

**Rationale**: el corredor de unitarios del proyecto es Vitest con `environment: "node"` e
`include: ["src/**/*.test.ts", "scripts/**/*.test.ts"]` (`vitest.config.ts`). No incluye `.tsx`, no hay DOM,
y el proyecto no tiene React Testing Library entre sus dependencias. Si la agrupación vive dentro del
componente, **no existe forma de testearla** salvo un Playwright contra datos reales. Como toda la
complejidad de esta feature es exactamente esa lógica (agrupar, agregar badges sobre hijos visibles, elegir
qué aviso mostrar), dejarla sin cobertura sería el peor reparto posible. El Principio V de la constitución
pide tests proporcionales al riesgo: acá el riesgo está concentrado en funciones puras, y las funciones
puras son justo lo que este corredor sí puede probar.

**Alternativas consideradas**:
- *Lógica dentro del `useMemo` del componente*: es lo más corto de escribir y lo que haría un primer
  borrador, pero deja sin cobertura la única parte riesgosa.
- *Agregar React Testing Library + jsdom*: dependencia nueva, configuración nueva de Vitest y un segundo
  entorno que mantener, para testear componentes que son casi todo markup. Desproporcionado, y además choca
  con "nuevas dependencias requieren una necesidad concreta" de la constitución.

---

## Decisión 2 — El campo de identidades se recupera en el mapeo, no con una consulta nueva

**Decisión**: agregar `identificadoresCanal` a `ContactoResumen` y poblarlo en `mapearConversacion`.

**Rationale**: `contactoSelect` ya le pide a Postgres `identificadoresCanal: { select: { identificador,
canal, handle } }` (`src/conversaciones/queries.ts:12-14`), y ese arreglo viaja en **todas** las queries del
Inbox porque `conversacionInclude` lo comparte. Hoy `mapearConversacion` lo usa solo para derivar
`identificadorCanal`/`handleCanal` del canal actual y descarta el resto
(`src/conversaciones/queries.ts:78-80, 95-102`). Mostrar la lista completa es, literalmente, dejar de tirar
un dato que ya se pagó: **cero consultas adicionales, cero cambios en el `select`**, apenas unos bytes más
en la serialización por conversación.

**Alternativas consideradas**:
- *Una server action que traiga las identidades al abrir el panel*: una consulta por conversación abierta,
  para traer algo que ya estaba en memoria. Viola FR-019 sin ganar nada.
- *Incluir también las conversaciones de cada identidad*: requeriría consultar conversaciones fuera del
  universo del Inbox. Se descarta por FR-018, que resuelve el caso mostrando la identidad sin fecha.

---

## Decisión 3 — Los contadores de filtro siguen contando conversaciones

**Decisión**: `conteos` sigue calculándose como hoy, sobre conversaciones
(`src/conversaciones/components/inbox-layout.tsx:308-321`), y la cabecera de cada grupo cuenta sus
conversaciones **visibles bajo el filtro activo**.

**Rationale**: los números de las pestañas son los que el agente usa todos los días para saber cuánto
trabajo tiene pendiente, y el trabajo pendiente se mide en conversaciones a responder, no en personas.
Cambiarlos a personas haría que "Abiertas 3" pase a "Abiertas 2" sin que nada haya cambiado en la realidad.
Contar los hijos visibles —y no todos los hijos— mantiene la propiedad de que la suma de los grupos cuadra
con el contador de la pestaña, que es lo que hace que el número se sienta correcto.

Nota: el contador de "Atención humana" ya es transversal a propósito (una conversación suma a la vez en su
estado y ahí, ver el comentario en `FILTROS`, `inbox-layout.tsx:117-120`). Ese comportamiento se preserva.

**Alternativas consideradas**:
- *Contar personas*: más coherente con la nueva lista, pero rompe la lectura operativa del número.
- *Mostrar ambos ("3 conversaciones · 2 personas")*: ruido en una barra de filtros que ya tiene cinco
  pestañas con número.

---

## Decisión 4 — El estado de expansión vive en el componente, indexado por contacto

**Decisión**: un `useState<Set<string>>` de contactos colapsados (no expandidos), clave `contactoId`.

**Rationale**: el auto-refresco **reemplaza el arreglo completo** cada 30 segundos
(`refrescarConversaciones` → `setConversaciones(frescas)`, `inbox-layout.tsx:409-416`). Si el estado de
expansión viviera dentro de los datos, se perdería en cada tick y los grupos se cerrarían solos mientras el
agente trabaja — exactamente el tipo de regresión que FR-006 prohíbe. Guardar el conjunto aparte, indexado
por `contactoId`, lo hace inmune a los reemplazos del arreglo y a la llegada de conversaciones nuevas por
SSE.

Se guarda el conjunto de **colapsados** y no de **expandidos** para que el default sea "expandido": un grupo
nuevo que aparece por SSE se muestra abierto, con sus conversaciones a la vista, sin que el agente tenga que
ir a buscarlas.

**Alternativas consideradas**:
- *Persistir en `localStorage`*: el Inbox ya persiste ahí el intervalo de auto-refresco, así que el patrón
  existe. Se descarta por ahora: el estado de expansión es efímero por naturaleza y persistirlo obliga a
  limpiar entradas de contactos que ya no están.
- *Expandir solo el grupo seleccionado (acordeón)*: cierra grupos que el agente dejó abiertos a propósito
  para vigilarlos.

---

## Decisión 5 — El aviso de otro canal se calcula contra el último mensaje, y se descarta por mensaje

**Decisión**: hay aviso cuando otra conversación del mismo contacto tiene un último mensaje **del contacto,
no leído, y más reciente** que el último mensaje de la conversación abierta. El descarte se guarda en un
`Set<string>` de ids de mensaje.

**Rationale**: el criterio de "no leído" ya existe y es uno solo en todo el Inbox —
`ultimoMensaje.remitente === "CONTACTO" && ultimoMensaje.estado !== "LEIDO"`
(`inbox-layout.tsx:742`). Reutilizarlo evita que la lista y el aviso discrepen sobre qué cuenta como no
leído. Comparar contra el último mensaje de la conversación abierta es lo que evita el falso positivo del
caso "ya le contesté por allá hace rato".

Descartar **por id de mensaje** (y no por conversación) es lo que cumple FR-014 sin esconder información
nueva: si el cliente vuelve a escribir por el otro canal, hay un mensaje distinto y el aviso reaparece. Si
se descartara por conversación, el agente perdería el siguiente aviso real.

**Alternativas consideradas**:
- *Avisar siempre que exista otra conversación*: ruido permanente para contactos con correo, que casi
  siempre tienen dos.
- *Persistir el descarte*: exige escribir en base de datos y está fuera del alcance (Assumptions del spec).

---

## Decisión 6 — Orden del grupo: el mismo criterio de hoy, aplicado a su conversación más prioritaria

**Decisión**: cada grupo toma la prioridad y la fecha de su conversación "líder" (la más prioritaria según
`PRIORIDAD`, desempatando por `actualizadoEn` más reciente), y la lista de grupos se ordena con el mismo
criterio que hoy ordena las conversaciones (`inbox-layout.tsx:298-306`).

**Rationale**: conserva la intuición actual —lo que requiere acción primero, lo más reciente arriba— y
garantiza que una persona con algo abierto nunca quede enterrada debajo de una persona con todo cerrado. La
misma conversación líder sirve para derivar el estado que muestra la fila colapsada.

**Alternativas consideradas**:
- *Ordenar por la actividad más reciente de la persona sin mirar estado*: sube conversaciones cerradas por
  encima de abiertas, al revés de lo que el filtro "Todos" hace hoy.

---

## Decisión 7 — El canal del chat pasa a etiqueta fija, conservando la derivación de `instanciaId`

**Decisión**: reemplazar `SelectorCuentaCanal` por una etiqueta no interactiva en la barra del compositor,
**manteniendo** el estado `cuentaSeleccionadaId` con su valor por defecto actual.

**Rationale**: el selector es decorativo —el envío siempre sale por `conversacion.cuentaCanalId`
(`src/conversaciones/envio.ts:104-131`), y elegir otra cuenta no cambia el destino—, así que presentarlo
como un selector le miente al agente (FR-020). Pero tiene un efecto colateral que **no** se puede perder:
`cuentaSeleccionadaId` es de donde sale `instanciaId` en el compositor
(`src/conversaciones/components/input-mensaje.tsx:105-108`), y ese `instanciaId` habilita la consulta de
plantillas y la visibilidad del botón "Generar respuesta con IA" (`input-mensaje.tsx:110-115, 252-256`).
Quitarlo sin más apagaría las plantillas y la sugerencia de IA — una regresión seria disfrazada de cambio
cosmético.

La derivación es segura porque `obtenerCuentasCanal(sesion.instanciaId)` filtra por la instancia de la
sesión (`src/conversaciones/queries.ts:147-154`, `src/app/crm/inbox/page.tsx:22`): **todas** las cuentas que
llegan al componente comparten `instanciaId`, así que el valor por defecto actual
(`conv.cuentaCanalId ?? cuentas[0]?.id`, `inbox-layout.tsx:750`) resuelve siempre al mismo tenant.

**Alternativas consideradas**:
- *Dejar el selector tal cual*: la vista agrupada hace más visible el multicanal y vuelve más probable que
  alguien intente usarlo para elegir por dónde responder. La mentira se vuelve más cara, no menos.
- *Hacer que el selector enrute de verdad*: es la feature siguiente (tiene que escribir
  `conversacion.cuentaCanalId` y respetar las reglas de cada canal). Fuera de alcance por FR-020.

---

## Decisión 8 — `data-testid` estables para el recorrido Playwright

**Decisión**: marcar la fila de persona como `data-testid="grupo-contacto"` y cada conversación hija como
`data-testid="conversacion-item"`.

**Rationale**: `tests/e2e/conversaciones/inbox.spec.ts` ya busca `[data-testid="conversacion-item"]` en seis
tests (IN-05, IN-06, IN-07, IN-08, IN-09, IN-11, IN-12) y **ese atributo no existe en el markup actual** —
los tests sobreviven solo por sus `.or(...)` y sus guardas `if (count > 0)`, es decir, hoy pasan sin probar
nada. Agregarlo como parte de esta feature convierte media docena de tests decorativos en tests reales, con
el ítem de conversación —que sigue siendo la unidad que se abre y se responde— como ancla correcta.

**Alternativas consideradas**:
- *No agregar testids*: deja el recorrido del Inbox igual de ciego que hoy, justo cuando su markup cambia.
- *Anclar los tests al grupo*: equivocado — lo que los tests abren y responden es una conversación, no una
  persona.
