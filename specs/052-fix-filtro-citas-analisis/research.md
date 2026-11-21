# Research: El filtro anti-citas deja de rechazar frases comerciales corrientes

**Feature**: `052-fix-filtro-citas-analisis` | **Date**: 2026-11-21

Cinco decisiones. La primera se resolvió midiendo producción; las demás, leyendo el código.

---

## Decisión 1 — El umbral de cita sube de 25 a 40 caracteres

**Decisión**: `LARGO_CITA` (`src/ai/analisis-contactos/salida.ts:21`) pasa de 25 a 40.

**Rationale**: el número sale de medir, no de estimar.

Se midió el solapamiento máximo de **1284 textos libres** provenientes de **400 evaluaciones de
IA ya aceptadas** (`ContactoEvaluacion.senales/objeciones/motivos`) contra los mensajes de cada
contacto:

| Percentil | Solape máximo |
|---|---|
| p50 | 9 |
| p90 | 15 |
| p95 | 19 |
| p99 | 22 |
| p99.9 | 24 |
| **máximo** | **24** |

**El máximo es exactamente uno menos que el umbral vigente, y eso es la prueba de que el umbral
está mal puesto, no de que esté bien.** La muestra está **censurada por el propio umbral**: todo
texto que habría superado 24 fue rechazado y nunca llegó a `ContactoEvaluacion`, así que no puede
aparecer en la medición. Un umbral holgado dejaría una población con máximo bastante por debajo
de él; acá los textos están apretados contra la pared.

Del otro lado, los cinco rechazos reproducidos contra la API tienen solape **26, 26, 26, 28 y
29**. No hay ningún hueco entre lo aceptado (≤24) y lo rechazado (26–29): es una única
distribución continua de paráfrasis natural, partida al medio por el corte.

**Por qué 40 y no otro número**:
- Deja ~38 % de margen sobre el peor falso positivo medido (29).
- Una cita que importa —una oración entera copiada de un mensaje— supera holgadamente 40. El test
  de cita que ya existe (`salida.test.ts:102`) tiene 48 caracteres de solape y **sigue
  rechazándose**.
- El tope de estos campos es 120 caracteres (`MAX_LARGO`), así que 40 sigue siendo un tercio del
  texto máximo: no es un control simbólico.

**Alternatives considered**:
- *Dejar 25*: mantiene el 5,8 % de rechazos y la pantalla acumulando fallidos inexplicables.
- *30 o 35*: por encima del peor falso positivo medido pero con margen escaso, y la medición de
  los aceptados está censurada — el solapamiento natural real podría llegar más arriba de lo que
  se puede observar. Elegir el límite justo contra una muestra truncada es exactamente el error
  que produjo el 25.
- *Umbral configurable por cuenta*: un control de privacidad que cada cuenta puede aflojar deja de
  ser un control.
- *Comparar por palabras en vez de caracteres*: cambia la semántica de la regla entera y habría
  que recalibrar desde cero, para resolver un problema que es de calibración.
- *Excluir los nombres de producto del catálogo del texto fuente*: atacaría una parte de los
  falsos positivos ("esfera lunar") pero no los otros ("para inicios de diciembre"), y agrega una
  dependencia del catálogo dentro del filtro de privacidad.

---

## Decisión 2 — El filtro devuelve el motivo, no un booleano

**Decisión**: `contieneDatosPrivados` pasa a devolver el motivo del rechazo —`EMAIL`, `URL`,
`SECUENCIA_NUMERICA`, `DIRECCION`, `CITA`— o `null` si el texto es aceptable.

**Rationale**: **es la pregunta que el checklist del spec dejó abierta, y la respuesta es sí,
se separa.** Los cinco controles comparten hoy un `true` indistinguible, y aguas abajo los tres
grandes motivos de rechazo comparten el mismo `RESPUESTA_INVALIDA`. Por eso averiguar qué estaba
pasando exigió reconstruir el pipeline completo —datos del lote, reglas, contexto, prompt— y
volver a llamar a la IA contacto por contacto.

La distinción que hacía falta era precisamente *"cita"* contra *"dato de forma reconocible"*: la
primera es calibración, la segunda es un dato real. Agrupar las cinco en un booleano borra justo
esa diferencia.

El cambio es de tipo de retorno, no de lógica: el orden de evaluación y las expresiones regulares
quedan idénticas, así que **ningún texto cambia de veredicto por esta decisión** (solo por la 1).

**Alternatives considered**:
- *Un segundo parámetro de salida o un objeto `{ rechazado, motivo }`*: más ceremonia para lo
  mismo; `null` o motivo ya es un discriminante completo.
- *Dejar el booleano y loguear el motivo por consola*: el log del worker no sobrevive al
  diagnóstico de la semana que viene, que es cuando hace falta.
- *Un único motivo `PRIVACIDAD`*: no separa cita de dato reconocible — el error original.

---

## Decisión 3 — El motivo se guarda en `item.errorCodigo`, sin tocar el esquema

**Decisión**: `validarSalidaLote` devuelve, por contacto inválido, su motivo; el ejecutor lo
escribe en `EjecucionAnalisisContactosItem.errorCodigo`.

**Rationale**: esa columna ya es `String?` **sin enum** (`prisma/schema.prisma:1053`) y el tipo
de `ItemEjecucion.errorCodigo` ya es `string | null`
(`src/crm/contactos/analisis/motor/auditoria.ts:174`). Admite el motivo fino sin migración y sin
tocar el modelo.

Nada lee hoy ese campo salvo la propia auditoría: la pantalla cuenta fallidos desde la cola, no
desde los ítems. Así que enriquecer el valor no rompe ninguna vista.

**FR-007 se cumple por construcción**: lo que se guarda es un código de un conjunto cerrado, no
un fragmento del texto. El motivo **nombra** la regla; no transcribe lo que la disparó.

**Alternatives considered**:
- *Agregar un enum de Prisma*: migración para un campo de diagnóstico que no se filtra ni se
  agrupa. El proyecto ya usa texto libre acá a propósito.
- *Guardar el tramo que coincidió*: sería lo más útil para diagnosticar y es **exactamente lo que
  FR-007 prohíbe** — ese tramo es texto del cliente. Se descarta sin discusión.
- *Una tabla nueva de motivos*: desproporcionado.

---

## Decisión 4 — El código a nivel ejecución sigue siendo `RESPUESTA_INVALIDA`

**Decisión**: `EjecucionAnalisisContactos.errorCodigo` no cambia. El motivo fino vive solo en el
ítem, que es por contacto.

**Rationale**: una ejecución agrupa varios contactos y puede tener contactos rechazados por
motivos distintos; un único código a ese nivel mentiría. Además `CodigoErrorAnalisis`
(`motor/auditoria.ts:23`) es un tipo cerrado que usan la recuperación y el resumen diario:
ampliarlo arrastra cambios sin aportar nada, porque el detalle ya está donde corresponde.

**Alternatives considered**:
- *Propagar el motivo dominante a la ejecución*: inventa una agregación que no significa nada.

---

## Decisión 5 — La recuperación de los 7 fallidos usa lo que ya existe

**Decisión**: no se construye nada. Se usa `reintentarFallidos`
(`src/crm/contactos/analisis/cola.ts:245`), que la pantalla de análisis ya expone.

**Rationale**: ya hace exactamente lo que hace falta —`FALLIDO` → `PENDIENTE`, intentos en cero,
`elegibleDesde` ahora, acotado por `instanciaId`—. Escribir un script sería duplicar una
capacidad existente para usarla una vez.

A diferencia de 051 —donde la recuperación tenía que **distinguir la causa** del fallo y por eso
necesitaba lógica propia—, acá se recuperan **todos** los fallidos: los 7 son del mismo caso, y
si alguno fallara por otra razón, volvería a fallar y quedaría marcado otra vez. El costo de
equivocarse es una evaluación de más, no un dato mal escrito.

**Importante**: ejecutarlo **antes** de desplegar el arreglo no sirve — los contactos volverían a
caer en el mismo filtro y consumirían otras cinco llamadas pagas.

**Alternatives considered**:
- *Un script como el de 051*: innecesario, la capacidad existe y es accesible desde la UI.
- *Recuperación automática al desplegar*: ningún proceso debería resucitar errores solo; los
  errores definitivos lo son por buenas razones.
