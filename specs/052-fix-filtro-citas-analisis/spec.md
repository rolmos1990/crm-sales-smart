# Feature Specification: El filtro anti-citas deja de rechazar frases comerciales corrientes

**Feature Branch**: `fix/052-filtro-citas-analisis`

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "necesito verificar por que tengo 7 contactos no se pudieron analizar después de varios intentos, en el analisis de contacto para ver si puedo corregir algo o es datos que estan invalidos?"

## Diagnóstico previo (investigación de código + reproducción contra la API real)

### Qué se investigó y dónde

- Base de datos de producción: `ContactoAnalisisCola` por estado, `EjecucionAnalisisContactos`,
  `EjecucionAnalisisContactosItem` y el perfil de datos de los 7 contactos afectados.
- `src/crm/contactos/analisis/motor/ejecutor.ts:397-407` — de dónde sale el estado `INVALIDO`.
- `src/ai/analisis-contactos/salida.ts:85-99,120-185` — las tres validaciones de la salida de la IA.
- **Reproducción contra la API real de DeepSeek**: se reconstruyó el pipeline completo —datos del
  lote, reglas, contexto de conversación, prompt, llamada al proveedor— y se corrió **cada
  validación por separado** sobre los 7 contactos, para ver cuál rechaza.
- **Medición sobre producción** de cuánto se solapan de forma legítima los textos ya aceptados.

### Qué se confirmó que SÍ funciona (y no se toca)

- **No es un problema de datos.** Los 7 contactos no tienen nada anómalo: una conversación cada
  uno, entre 3 y 60 mensajes, sin notas, sin campos raros.
- **Dos de los 7 ya tenían una evaluación de IA previa exitosa**: funcionaron antes y fallaron
  después, con los mismos datos.
- **Dos de los 7 pasaron limpio al reproducirlos ahora**, sin cambiar nada. Es azar de redacción.
- **La IA responde bien.** En los 7 casos devolvió un JSON completo, bien formado y con una
  evaluación sensata del contacto. Nada que ver con una respuesta cortada o ininteligible.
- **La cola, los reintentos y el registro de auditoría funcionan.** El fallo se detecta, se
  reintenta cinco veces y queda visible en la pantalla, como corresponde.

### La causa raíz exacta

**El filtro que impide que la IA copie textualmente lo que escribió el cliente rechaza, con un
umbral de 25 caracteres, cualquier resumen fiel escrito en español corriente.**

Si el cliente escribe *"¿me das el precio de las esferas?"* y la IA resume *"Pregunta el precio
de las esferas"*, 26 caracteres coinciden literalmente. No porque la IA esté citando: porque es
la única forma natural de decirlo.

Los cinco textos rechazados, con el tramo exacto que coincide:

| La IA escribió | Caracteres que coinciden con la conversación |
|---|---|
| "Pregunta el precio de las esferas" | 26 — `a el precio de las esferas` |
| "Pidió encargar una esfera lunar" | 26 — `  encargar una esfera lunar` |
| "Pide ver todos los modelos nuevos" | 29 — `  ver todos los modelos nuevos` |
| "Consulta por opciones de personalización" | 28 — `  opciones de personalizacion` |
| "Menciona fecha límite para inicios de diciembre" | 26 — `  para inicios de diciembre` |

Ninguno es un dato personal. Son nombres de producto y frases comerciales.

### El umbral está mal elegido, y se puede demostrar

Se midió el solapamiento de **1284 textos libres de 400 evaluaciones ya aceptadas**:

| Percentil | Solape máximo |
|---|---|
| p50 | 9 caracteres |
| p90 | 15 |
| p95 | 19 |
| p99 | 22 |
| p99.9 | 24 |
| **máximo observado** | **24** |

**El máximo observado es exactamente uno menos que el umbral.** Eso no significa que 25 sea
holgado: significa que la muestra está **censurada por el propio umbral** — todo lo que habría
pasado de 24 fue rechazado y no quedó para medir. Ejemplos aceptados que rozan el límite: *"Pidió
ver los nuevos modelos"* (24), *"Se mostró receptivo a los modelos disponibles"* (24), *"Plazo
definido para la próxima semana"* (24).

Del otro lado, los textos rechazados se solapan **entre 26 y 29**. No hay ningún hueco entre lo
aceptado y lo rechazado: el umbral corta por el medio de la distribución natural de la paráfrasis.

### Por qué el síntoma se explica por esta causa y no por otra

- Las tres validaciones comparten el mismo código de error, así que había que separarlas para
  saberlo: **5 de 5 fallan en esta, ninguna en las otras dos**.
- La IA devolvió un JSON válido y completo en los 7 casos: no es una respuesta cortada.
- Los mismos contactos pasan o fallan según cómo redacte la IA esa vez, no según sus datos.
- La tasa histórica —**1612 evaluaciones aceptadas contra 99 rechazadas, un 5,8 %**— es
  consistente con un filtro que se dispara por coincidencia de redacción, no con datos corruptos
  que serían siempre los mismos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Las evaluaciones válidas dejan de rechazarse (Priority: P1)

El comercio activa el análisis de contactos y espera que cada contacto quede evaluado. Hoy, uno
de cada diecisiete se cae porque la IA describió al cliente usando las mismas palabras que el
cliente usó —que es lo que hace un resumen—. Tras cinco intentos el contacto queda marcado como
fallido y nadie sabe por qué.

Con el arreglo, un resumen fiel deja de confundirse con una cita textual, y esos contactos se
evalúan como el resto.

**Why this priority**: es el fallo reportado y lo que bloquea el valor del análisis. Sin esto, la
pantalla acumula fallidos que nadie puede explicar ni corregir.

**Independent Test**: tomar los contactos hoy en estado fallido, volver a analizarlos y verificar
que se evalúan correctamente.

**Acceptance Scenarios**:

1. **Given** un contacto cuya descripción natural reutiliza entre 25 y 29 caracteres seguidos de
   lo que escribió el cliente, **When** se lo analiza, **Then** la evaluación se acepta y queda
   guardada.
2. **Given** una evaluación en la que la IA copia una oración entera de un mensaje del cliente,
   **When** se la valida, **Then** se **sigue rechazando** — la protección no se pierde.
3. **Given** cualquiera de las 1284 descripciones ya aceptadas en producción, **When** se las
   revalida con el umbral nuevo, **Then** las 1284 siguen aceptándose.
4. **Given** una evaluación que contiene un correo, una dirección web, un número de teléfono o
   una dirección postal, **When** se la valida, **Then** se **sigue rechazando** exactamente como
   hoy.
5. **Given** la misma evaluación que hoy se rechaza, **When** se la valida con el umbral nuevo,
   **Then** el contacto queda evaluado sin consumir los cinco reintentos.

---

### User Story 2 - Saber por qué se rechazó una evaluación (Priority: P2)

Cuando una evaluación se rechaza, el registro dice únicamente "la respuesta no era válida". Hay
tres motivos posibles y comparten ese mismo texto, así que descubrir cuál fue exigió reconstruir
el pipeline entero a mano y volver a llamar a la IA contacto por contacto.

Con el arreglo, el registro dice cuál de los tres controles rechazó, y la próxima investigación
empieza con la respuesta en vez de terminar con ella.

**Why this priority**: no arregla ningún contacto, pero es la diferencia entre diagnosticar el
próximo caso en un minuto o en una tarde. Es exactamente el costo que se acaba de pagar.

**Independent Test**: forzar cada uno de los tres motivos de rechazo y verificar que el registro
los distingue.

**Acceptance Scenarios**:

1. **Given** una evaluación rechazada por parecerse demasiado a lo que escribió el cliente,
   **When** se consulta el registro, **Then** dice que el motivo fue ese y no otro.
2. **Given** una evaluación rechazada por no respetar el formato esperado, **When** se consulta el
   registro, **Then** se distingue del caso anterior.
3. **Given** una evaluación rechazada porque la IA evaluó dos veces al mismo contacto, **When** se
   consulta el registro, **Then** se distingue de las otras dos.
4. **Given** cualquier rechazo, **When** se consulta el registro, **Then** **no** contiene el texto
   que la IA generó ni fragmento alguno de la conversación — el motivo se nombra, no se transcribe.

---

### User Story 3 - Recuperar los contactos que ya quedaron fallidos (Priority: P3)

Los 7 contactos que agotaron sus reintentos siguen marcados como fallidos. Con el arreglo
desplegado, su evaluación funcionaría; solo hace falta volver a encolarlos.

**Why this priority**: el valor es real pero acotado a 7 contactos, y **la capacidad ya existe**:
la pantalla de análisis tiene un botón para reintentar los fallidos. Esta historia es verificar
que alcanza, no construir nada.

**Independent Test**: con el arreglo desplegado, usar el reintento desde la pantalla y comprobar
que los 7 quedan evaluados.

**Acceptance Scenarios**:

1. **Given** contactos en estado fallido y el arreglo desplegado, **When** se usa el reintento
   existente, **Then** vuelven a la cola y quedan evaluados.
2. **Given** ese mismo reintento, **When** se ejecuta, **Then** **no** se agrega ningún mecanismo
   nuevo si el existente ya resuelve el caso.

---

### Edge Cases

- **Resumen fiel que reutiliza un sintagma del cliente** (25–29 caracteres): el caso que motiva el
  hotfix. Pasa a aceptarse.
- **Cita textual larga de un mensaje del cliente**: se sigue rechazando.
- **Texto con correo, dirección web, teléfono o dirección postal**: se sigue rechazando, sin
  cambios.
- **Texto más corto que el umbral**: no puede ser una cita; no se evalúa como tal.
- **Contacto sin conversación**: no hay fuente contra la cual comparar; el control no aplica.
- **Nombre de producto largo que el cliente escribió igual**: deja de contar como cita. Es
  deliberado — un nombre de producto no es dato de nadie.
- **Dato sensible corto** (por ejemplo una condición de salud mencionada al pasar): **nunca lo
  atrapó este control** y sigue sin atraparlo. Vive en las instrucciones fijas que se le dan a la
  IA, y este hotfix no lo cambia ni pretende cubrirlo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El control que impide copiar texto del cliente MUST exigir una coincidencia
  **sustancialmente más larga** que la que produce un resumen fiel, con margen demostrable sobre
  el solapamiento natural medido.
- **FR-002**: El umbral elegido MUST quedar documentado junto a la medición que lo justifica
  —percentiles de los textos aceptados y solapamiento de los rechazados—, de modo que bajarlo
  exija repetir la medición y no una corazonada.
- **FR-003**: Las 1284 descripciones ya aceptadas en producción MUST seguir siendo aceptadas.
- **FR-004**: El control MUST seguir rechazando correos, direcciones web, secuencias largas de
  dígitos y direcciones postales, **sin ningún cambio**.
- **FR-005**: El control MUST seguir rechazando una copia textual larga de un mensaje del cliente.
- **FR-006**: El registro de cada evaluación rechazada MUST indicar **cuál** de los tres controles
  la rechazó.
- **FR-007**: Ese registro MUST NOT contener el texto generado por la IA ni fragmento alguno de la
  conversación: nombra el motivo, no lo transcribe.
- **FR-008**: El resto del análisis —las reglas, el puntaje, la cola, los reintentos, el consumo
  de IA y su costo, y qué se guarda en el contacto— MUST quedar sin cambios de comportamiento.
- **FR-009**: La IA MUST seguir sin poder escribir hechos del contacto ni marcarlo como "no
  contactar"; el nivel de interés se sigue aplicando por el único camino que ya existe.
- **FR-010**: Los contactos hoy en estado fallido MUST poder recuperarse con la capacidad de
  reintento que ya existe, sin construir un mecanismo nuevo.

### Key Entities

- **Evaluación de la IA**: lo que la IA devuelve por contacto. Incluye campos de opción cerrada
  (intención, urgencia) y **textos libres** —señales, objeciones, motivos— que son los únicos que
  pasan por este control.
- **Fuentes de la conversación**: los mensajes que la IA vio al evaluar. Son el texto contra el
  que se compara para detectar una copia. Cuanto más larga la conversación, más superficie para
  una coincidencia casual.
- **Registro de evaluación rechazada**: la fila de auditoría por contacto. Hoy guarda un único
  código para los tres motivos; con el arreglo los distingue (FR-006).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Las cinco evaluaciones reproducidas en el diagnóstico pasan a aceptarse.
- **SC-002**: Las 1284 descripciones ya aceptadas siguen aceptándose: ninguna regresión.
- **SC-003**: La proporción de evaluaciones rechazadas cae muy por debajo del 5,8 % histórico.
- **SC-004**: Un texto que copia una oración entera de un mensaje del cliente se sigue
  rechazando.
- **SC-005**: Ante un rechazo, el motivo concreto se identifica **leyendo el registro**, sin
  reproducir el pipeline ni llamar de nuevo a la IA.
- **SC-006**: Los contactos hoy en estado fallido quedan evaluados usando el reintento existente.

## Assumptions

- **El umbral sube a 40 caracteres.** El falso positivo más largo medido es 29, así que 40 deja
  un margen de ~38 %; y una cita que importe —una oración entera de un mensaje— supera
  holgadamente los 40, dentro del tope de 120 caracteres que ya tienen estos campos. El número
  sale de la medición, no de una intuición.
- **El umbral sigue siendo uno solo, igual para todas las cuentas.** No se vuelve configurable: un
  control de privacidad que cada cuenta puede aflojar deja de ser un control.
- **No se agregan listas de palabras** para detectar datos sensibles. El propio diseño original
  las descartó porque dan falsos positivos sobre señales legítimas ("pregunta por formas de
  pago"), y este hotfix trata justamente un exceso de falsos positivos.
- **Los 99 rechazos históricos no se reprocesan.** Casi todos terminaron evaluándose en un
  reintento posterior; solo quedaron 7 fallidos, y esos se recuperan con lo que ya existe.
- **Sin cambios en el modelo de datos.** Distinguir el motivo del rechazo se apoya en el campo de
  código de error que la fila de auditoría ya tiene.
- **El cambio es de validación, no de prompt.** No se toca lo que se le pide a la IA ni cómo se
  construye su contexto: lo que cambia es qué respuestas se aceptan.
