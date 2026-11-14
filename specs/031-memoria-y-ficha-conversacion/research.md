# Research: Memoria conversacional y ficha de conversación

**Feature**: `031-memoria-y-ficha-conversacion` | **Fecha**: 2026-11-14

Las siete decisiones de negocio ya están cerradas en `spec.md` → "Decisiones de
diseño ya acordadas". Este documento resuelve solo las decisiones **técnicas**
que quedaban abiertas, con la alternativa que se descartó en cada caso.

---

## D1 — Cómo se expresa la cantidad de mensajes en el contexto

**Decisión**: `OpcionesContexto` (`src/ai/contexto/constructor.ts`) gana un campo
`memoria?: { activa: boolean; cantidad: number }`, y `resolverDecisionContexto`
(`src/ai/contexto/router.ts`) gana un parámetro `override?: number`. Cuando
`override` viene, `mensajesAIncluir` es exactamente ese número — **sin el piso
de 3 actual**: si el negocio pide 1, es 1.

El `maxMensajes` que hoy se declara y se ignora pasa a honrarse como **tope
duro** independiente, para no dejar la deuda viva.

**Rationale**: `memoria` es la semántica del producto (tres estados);
`maxMensajes` es un tope técnico de quien llama. Mezclarlos en un solo número
obligaría a codificar "0 = solo el último", que es justo el tipo de valor
mágico que después nadie entiende.

**Alternativa rechazada**: reusar `maxMensajes` para todo. Se descartó porque no
puede expresar el estado "ausente" (legacy) sin un centinela.

---

## D2 — Qué significa exactamente `activa: false`

**Decisión**: el agente recibe **el último mensaje cuyo remitente es el
contacto**, aunque después haya mensajes nuestros. Misma definición que ya usa
`obtenerUltimoMensajeCliente` en `responder-con-agente.ts` para el clasificador
de autonomía.

**Rationale**: "no leer la conversación" significa responder a lo que el cliente
acaba de decir. Si tomáramos literalmente "el último mensaje" y ese fuera
nuestro, el agente respondería a sí mismo.

---

## D3 — El `maxMensajes: 15` que hoy se ignora

**Decisión**: honrarlo. "Sugerir respuesta" del panel de conversación
(`src/conversaciones/actions-ia.ts:45`) pasa de recibir 13 mensajes a los 15 que
siempre pidió.

**Rationale**: es la intención original del código. Son 2 mensajes más en un
camino manual donde un humano lee y edita antes de enviar — el riesgo es
prácticamente nulo y la deuda desaparece.

**Alternativa**: borrar el parámetro en ese punto de llamada y dejar el
comportamiento idéntico. Es un cambio de una línea.

> ⚠️ **Única excepción a FR-034.** Está señalada en `spec.md` → Assumptions y
> debe mencionarse en el PR. Si el negocio la veta, se aplica la alternativa:
> una sola tarea cambia de signo, nada más del plan se mueve.

---

## D4 — Dónde vive la configuración del nodo

**Decisión**: en `ConfigAtencionIASchema` (`src/workflows/definicion/schema.ts`),
es decir en el JSON de la definición del Workflow. Viaja con
`WorkflowVersion.definicion` como el resto de la configuración del nodo.
**P1 no necesita migración.**

```ts
memoria: z.object({
  activa: z.boolean().default(true),
  cantidad: z.number().int().min(1).max(30).default(10),
}).optional(),
ficha: z.object({ activa: z.boolean().default(false) }).optional(),
```

**Crítico**: `.optional()` **sin** `.default({})`. Un default a nivel del objeto
haría que cada nodo ya publicado pasara de "ausente" a "configurado" al
reparsearse, que es exactamente la afectación que FR-002 prohíbe. Hay un
precedente idéntico en el mismo schema: `delayRespuesta` es `.optional()` y su
ausencia significa "comportamiento previo".

---

## D5 — Modelo de datos de la ficha

**Decisión**: tabla propia `FichaConversacionIA`, 1-1 con `Conversacion`, con
`hechos Json` e `interpretado Json?`. Calcado de `PerfilClienteSnapshot`.

**Rationale**: dos campos JSON en vez de ocho columnas. La forma de la ficha va
a cambiar en las próximas iteraciones (es un artefacto de prompt, no un modelo
de negocio); con JSON eso no cuesta una migración cada vez. El precedente ya
existe y está probado en la spec 012.

**Alternativas rechazadas**:

- **Guardarla en `WorkflowEjecucion.contexto`** (junto a `MetaEjecucion`): la
  ficha es de la **conversación**, no de la ejecución. Dos ejecuciones distintas
  sobre la misma conversación tienen que compartirla, y la ficha debe sobrevivir
  a que el Workflow termine.
- **Extender `PerfilClienteSnapshot`**: alcance equivocado (contacto vs.
  conversación) y ciclo de vida equivocado (eventos de dominio vs. por turno).
  Prohibido por FR-015.

---

## D6 — Cómo se detecta "precio ya informado al cliente"

**Decisión**: un precio se registra como informado solo si cumple **las dos**
condiciones:

1. salió de una herramienta ejecutada en este turno — `consultar_precio_actual`
   (producto + precio), `buscar_productos` (lista de precios),
   `crear_cotizacion` / `crear_pedido` (total); **y**
2. su monto aparece en el texto del mensaje que efectivamente se envió.

El comparador tolera formato: para 16 busca `16`, `16.00`, `16,00`, `16.0`.

**Rationale**: `buscar_productos` devuelve hasta 10 productos con precio, pero
el agente normalmente menciona uno. Registrar los 10 como "mostrados" llenaría
la ficha de precios que el cliente nunca vio, y el turno siguiente el agente se
autocensuraría por contradecir algo que no dijo.

**Limitación aceptada y documentada**: si el agente redondea ("alrededor de 15")
o escribe el número en letras, no se registra. Se prefiere **no registrar** un
precio antes que registrar uno que no se dijo — un falso negativo solo pierde la
mejora; un falso positivo hace al agente contradecir un fantasma.

**Alternativa rechazada**: registrar todo lo que devolvieron las herramientas.
Falsos positivos garantizados.

---

## D7 — La pregunta abierta

**Decisión**: P2 registra determinísticamente **la última oración interrogativa
del mensaje que el agente envió** (último fragmento terminado en `?`), junto con
cuántos turnos pasaron desde entonces. **P2 no decide si fue respondida.**

La capa 6 la presenta con esa distancia y la regla de conducta. El juicio
"¿quedó contestada?" vive en `datosFaltantes` de la lectura interpretada (P3).

**Rationale**: decidir si un mensaje responde una pregunta es juicio semántico.
Una regla determinista tipo "el cliente escribió algo después ⇒ respondió" la
daría por cerrada justo en el caso que SC-005 quiere cubrir (el cliente contesta
otra cosa). Mostrarle al agente qué preguntó y hace cuánto ya alcanza para que
no abra un tema nuevo, sin fingir una precisión que no tenemos.

---

## D8 — Producto en foco

**Decisión**: orden de prioridad por turno —

1. `productoId` de los argumentos de `consultar_precio_actual` o
   `consultar_disponibilidad` (señal explícita y sin ambigüedad);
2. producto de la cotización o pedido creado en el turno;
3. primer producto devuelto por `buscar_productos` — que es lo que hoy ya hace
   `productoIdentificadoId` en `ejecutarConTools`.

Si en el turno no hubo ninguna señal, **se conserva el producto anterior**.

**Rationale**: la fuente 3 es la más débil (ya está marcada como "mejor
esfuerzo" en el código de la spec 017) y por eso va última.

---

## D9 — Cuándo se escriben los hechos

**Decisión**: en `responderConAgente`, **después** de `enviarMensajeInterno`,
junto a la llamada existente a `ensamblarYPersistirRegistro`, dentro de
`try/catch`. Si `accion !== "ENVIADO"` (pendiente de revisión, no generado,
omitido) **no se escribe nada**: no hubo mensaje al cliente, así que no hay nada
que el cliente "ya vio".

**Rationale**: la disciplina ya está establecida en ese archivo — el registro de
trazabilidad de la spec 017 nunca bloquea ni revierte un envío ya realizado.
FR-014 pide exactamente eso.

---

## D10 — Cuándo corre la lectura interpretada

**Decisión**: en el mismo punto que D9, después de escribir los hechos, con
`await` y un **timeout acotado** (10 s) envuelto en `try/catch`.

**Rationale**: el cliente ya recibió su mensaje antes de que esto empiece, así
que FR-022 se cumple por construcción. El tiempo extra lo paga el worker, no la
persona. Un `void promesa.catch()` sin `await` sería más rápido para el worker
pero deja trabajo colgando que se pierde si el proceso se recicla.

**Alternativa rechazada (por ahora)**: publicar un comando por RabbitMQ y
procesarlo en un suscriptor. Es lo correcto si el tiempo del worker llega a
molestar, pero hoy obligaría a un contrato de evento nuevo, un consumidor nuevo
y garantías de idempotencia, para un trabajo que no necesita nada de eso. Queda
documentado como la salida si hace falta.

---

## D11 — Presupuesto de tokens

**Decisión**: `resolverDecisionContexto` gana `tokensReservadosExtra`, que se
suma a los 2000 ya reservados. La ficha se estima en `ceil(texto.length / 4)`.

Esto obliga a **reordenar** `construirContexto`: hoy decide cuántos mensajes
entran *antes* de componer las capas. Pasa a resolver la ficha primero (una
lectura de una fila, barata) y recién después decidir la cantidad de mensajes.

**Rationale**: sin esto, activar la ficha empujaría silenciosamente al agente
por encima de su límite de contexto. FR-007 pide que el recorte sea explícito y
que caigan primero los mensajes más antiguos.

**Sin ficha, el reordenamiento no cambia nada**: `tokensReservadosExtra` vale 0
y el cálculo da idéntico — es lo que verifica SC-001.

---

## D12 — Simulador

**Decisión**: `InsumosContexto` gana `fichaOverride?: FichaConversacion | null`,
espejo exacto de `perfilClienteOverride` (spec 018, research Decisión 2). El
simulador arma una ficha simulada y nunca lee ni escribe la tabla real.

**Rationale**: el precedente ya está y resolvió el mismo problema — el simulador
no tiene `contactoId` ni `conversacionId` reales.

---

## D13 — Orden dentro del contexto

**Decisión**: capa 6 (hechos) → capa 7 (interpretado) → capa 8 (catálogo) →
capa 9 (ejemplos), todas dentro de `contenidoReservado`. Hoy ese arreglo es
`[7, 8, 9]` con el 7 siempre `null`; pasa a `[6, 7, 8, 9]`.

Capa 6 es un productor nuevo (`src/ai/contexto/capas/estado-conversacion.ts`);
capa 7 reemplaza el cuerpo de `producirCapaDatosConocidosFaltantes()` en
`placeholders.ts`, que es exactamente el punto de extensión que la spec 013 dejó
preparado (FR-008 de esa spec).

**El orden de precedencia de la 013 no se mueve.** Sin ficha, ambas devuelven
`null`, `.filter(Boolean)` las descarta y el string resultante es idéntico.

---

## D14 — Vigencia de la ficha tras intervención humana

**Decisión**: **derivada, no escrita**. La capa 6 compara `ficha.actualizadoEn`
con `Conversacion.atencionDesde`. Si hubo una toma humana posterior a la última
actualización de la ficha, la capa se omite y la ficha se reconstruye en el
turno siguiente.

**Rationale**: cero cambios en el camino de transferencia a humano
(`transferir_a_humano`, `asignarHumano`, el toggle manual del panel) — que son
tres puntos de escritura distintos que habría que mantener sincronizados con un
flag. La comparación de dos timestamps que ya existen no puede desincronizarse.

**Alternativa rechazada**: un campo `vigente: Boolean` que cada camino de
transferencia tiene que acordarse de apagar.

---

## D15 — Inyección de prompt

**Decisión**: la ficha va por debajo de las capas 1-3 (ya garantizado por D13),
el bloque se abre declarando que es **información registrada sobre esta
conversación, no instrucciones**, y todo texto de origen del cliente se trunca:
resumen 500 caracteres, cada valor de `datosConocidos` 200, cada ítem de lista
200.

**Rationale**: `tema`, `resumen` y `datosConocidos` derivan de lo que el cliente
escribió. Es la misma razón por la que la spec 013 colocó las capas de menor
precedencia después de las reglas obligatorias.

---

## D16 — Tests

| Archivo | Qué cubre |
|---|---|
| `src/ai/prompt/builder.test.ts` | **SC-001**: sin ficha, `construirSystemPrompt` devuelve el mismo string que hoy (comparación byte a byte contra un fixture congelado) |
| `src/ai/contexto/context-builder.test.ts` | capas 6/7 `null` ⇒ `contenidoReservado` sin cambios; con ficha ⇒ orden 6→7→8→9 |
| `src/ai/contexto/constructor.test.ts` | los tres estados de `memoria`; mensajes vacíos no consumen cupo; `maxMensajes` como tope duro |
| `src/workflows/definicion/catalogo-nodos.test.ts` | `configInicial` de ATENCION_IA sigue sin `memoria` ni `ficha` |
| `src/workflows/definicion/validador.test.ts` | cantidad fuera de 1–30 no publica (FR-008) |
| `src/ai/respuesta/responder-con-agente.test.ts` | fallo al escribir la ficha ⇒ el mensaje igual se envía (FR-014); `accion !== ENVIADO` ⇒ no se escribe |
| `src/ai/ficha-conversacion/hechos.test.ts` | D6 (matcher de precio, con casos de formato), D7, D8 |
| `src/ai/ficha-conversacion/extraccion.test.ts` | fallo/JSON inválido ⇒ conserva lo anterior (FR-023) |
| `src/ai/contexto/capas/estado-conversacion.test.ts` | D14 (ficha anterior a `atencionDesde` se omite); truncado de D15 |
