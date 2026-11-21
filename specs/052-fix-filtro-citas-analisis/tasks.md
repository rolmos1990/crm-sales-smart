---

description: "Task list — 052 hotfix del filtro anti-citas del análisis de contactos"
---

# Tasks: El filtro anti-citas deja de rechazar frases comerciales corrientes

**Input**: Design documents from `specs/052-fix-filtro-citas-analisis/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/filtro-privacidad.md](./contracts/filtro-privacidad.md)

**Tests**: SÍ. `plan.md` los pide y la Constitución (principio V) los exige proporcionales al
riesgo. Acá el riesgo es doble: se **afloja un control de privacidad** —hay que fijar en un test
que los otros cuatro controles no se movieron— y el umbral exacto tiene que quedar clavado, o el
próximo que lo vea lo baja "por las dudas".

**Organization**: por historia. **US1 es el hotfix**; US2 es la trazabilidad que evita repetir la
investigación; US3 es verificar que lo que ya existe alcanza.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (archivo distinto, sin dependencias pendientes)
- **[Story]**: US1 / US2 / US3 — solo en las fases de historia

## Path Conventions

Monorepo Next.js + worker. La validación vive en `src/ai/analisis-contactos/`; el motor que la
consume, en `src/crm/contactos/analisis/motor/`.

---

## Phase 1: Setup

- [X] T001 Crear la rama `fix/052-filtro-citas-analisis` desde `main` @ `f1271c5` (ya incluye 050 y 051) — **hecho**
- [X] T002 Confirmar que `npx prisma migrate status` no reporta nada pendiente y que `prisma/schema.prisma` NO necesita cambios: `EjecucionAnalisisContactosItem.errorCodigo` ya es `String?` sin enum (`prisma/schema.prisma:1053`)
- [X] T003 Anotar la línea base: los ids de los contactos hoy en estado `FALLIDO` en `ContactoAnalisisCola` (7 en producción) y la tasa histórica de ítems inválidos en `EjecucionAnalisisContactosItem` (99 de 1711, 5,8 %). Son el patrón contra el que se valida US3 y SC-003

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: cambiar el **tipo de retorno** del filtro, sin cambiar ningún veredicto.

**⚠️ CRITICAL**: va primero a propósito. US1 y US2 editan la misma función; hacer el cambio de
tipo —que es invisible— antes que el de umbral evita tocarla dos veces y deja el diff del hotfix
reducido a una constante.

- [X] T004 Escribir en `src/ai/analisis-contactos/salida.test.ts` los casos del nuevo retorno: cada uno de los cinco controles devuelve **su** motivo (`EMAIL`, `URL`, `SECUENCIA_NUMERICA`, `DIRECCION`, `CITA`), un texto aceptable devuelve `null`, y un texto que dispara dos controles devuelve el **primero** según el orden de `contracts/filtro-privacidad.md` § 1. Debe fallar antes de T005
- [X] T005 Cambiar `contieneDatosPrivados` en `src/ai/analisis-contactos/salida.ts:95` para devolver `MotivoPrivacidad | null` en vez de `boolean`, exportando el tipo. **Sin tocar ninguna expresión regular, ningún umbral ni el orden de evaluación**: es cambio de tipo, no de lógica (depends on T004)
  > El original evaluaba correo, URL y secuencia numérica en un solo `if`; separarlos en tres preserva el orden y el veredicto exactos. **Ningún texto cambió de resultado en esta fase** — se verificó con la batería de T006 intacta.
- [X] T006 Adaptar la batería de privacidad que ya existe en `src/ai/analisis-contactos/salida.test.ts:78-100` al nuevo retorno (`toBe(true)` → `not.toBeNull()`, `toBe(false)` → `toBeNull()`). **Los casos no cambian**: son la prueba de que los cuatro controles de forma reconocible siguen intactos (FR-004) (depends on T005)

**Checkpoint**: el filtro dice por qué rechaza. Ningún texto cambió de veredicto todavía.

---

## Phase 3: User Story 1 — Las evaluaciones válidas dejan de rechazarse (Priority: P1) 🎯 EL HOTFIX

**Goal**: un resumen fiel deja de confundirse con una cita textual (FR-001, FR-003, FR-005).

**Independent Test**: pasar por el filtro los cinco textos del diagnóstico y verificar que los
cinco se aceptan, y que la cita de 48 caracteres de `salida.test.ts:102` se sigue rechazando.

### Tests for User Story 1

- [X] T007 [P] [US1] Agregar a `src/ai/analisis-contactos/salida.test.ts` los casos del umbral: solape de 39 se acepta y de 40 se rechaza (fija el límite exacto); los **cinco textos reales del diagnóstico** con sus fuentes se aceptan; la cita de 48 caracteres se sigue rechazando; un texto más corto que el umbral nunca es cita. Debe fallar antes de T008
  > **El test atrapó un error mío**: la cadena de 39/40 caracteres que escribí contenía `0123 456789`, diez dígitos, y disparaba `SECUENCIA_NUMERICA` antes de llegar al control de cita. Reescrita sin dígitos; queda anotado en el propio test por qué.

### Implementation for User Story 1

- [X] T008 [US1] Subir `LARGO_CITA` de 25 a 40 en `src/ai/analisis-contactos/salida.ts:21` (depends on T007)
- [X] T009 [US1] Documentar el número en el comentario de la constante en `src/ai/analisis-contactos/salida.ts`: la tabla de percentiles de los 1284 textos aceptados (p50 9, p90 15, p95 19, p99 22, máx 24), el solape de los rechazados (26–29), la cita real (48) y **el argumento de la muestra censurada** — que el máximo aceptado sea 24 con umbral 25 no prueba holgura, prueba truncamiento. Sin esto, el próximo lo baja "por las dudas" y reintroduce el bug (depends on T008)
- [X] T010 [US1] Revalidar contra producción, con el filtro de `src/ai/analisis-contactos/salida.ts`, los 1284 textos libres de las 400 evaluaciones de origen IA (`ContactoEvaluacion.senales/objeciones/motivos`) con el filtro nuevo, usando los mensajes de cada contacto como fuente. **1284 de 1284 deben seguir aceptándose** (FR-003). Verificación de un solo uso: no se agrega un script al repo
  > **Resultado: 1284 de 1284 siguen aceptándose.** Verificación de un solo uso, sin dejar script en el repo.

**Checkpoint**: el hotfix está completo y desplegable. Escenarios 1 a 4 del quickstart.

> **Este es el punto donde se afloja un control de privacidad.** T006 y el escenario 4 del
> quickstart son la contraparte: correo, URL, dígitos y dirección tienen que seguir rechazándose
> exactamente igual. Si alguno cambió de veredicto, se tocó algo de más.

---

## Phase 4: User Story 2 — Saber por qué se rechazó una evaluación (Priority: P2)

**Goal**: la fila de auditoría dice cuál de los controles rechazó, en vez de un código único para
los tres motivos (FR-006, FR-007).

**Independent Test**: forzar un rechazo de cada tipo y verificar que el registro los distingue, y
que no contiene texto generado ni fragmentos de la conversación.

### Tests for User Story 2

- [X] T011 [P] [US2] Ampliar `src/ai/analisis-contactos/salida.test.ts` para el nuevo `invalidos`: referencia duplicada ⇒ `REF_DUPLICADA`; evaluación que no pasa el esquema ⇒ `FORMATO_INVALIDO`; texto con dato privado ⇒ `PRIVACIDAD_<motivo>`; referencia ausente ⇒ sigue en `omitidos` y **no** en `invalidos`; con dos textos problemáticos manda el primero en orden `senales → objeciones → motivos → motivoNoContactar`. Ajustar las tres aserciones `expect(r.invalidos).toEqual([...])` de las líneas 55, 74 y 114 a la forma nueva. Debe fallar antes de T012

### Implementation for User Story 2

- [X] T012 [US2] Cambiar `invalidos` de `string[]` a `Map<string, MotivoRechazo>` en `ResultadoValidacion` y propagar el motivo en `validarSalidaLote` (`src/ai/analisis-contactos/salida.ts:120-185`), exportando `MotivoRechazo`. **`loteInvalido`, `omitidos` y el descarte silencioso de referencias ajenas no cambian** (depends on T011)
- [X] T013 [US2] Propagar el tipo nuevo en `src/crm/contactos/analisis/types.ts:134` (`RespuestaLoteIA.invalidos`) y en `src/ai/analisis-contactos/evaluar-lote.ts:72`, que solo reenvía lo que devuelve la validación (depends on T012)
- [X] T014 [US2] En `src/crm/contactos/analisis/motor/ejecutor.ts:403-408`, usar el motivo concreto como `errorCodigo` del ítem inválido en vez de la constante `"RESPUESTA_INVALIDA"`. El contacto **omitido** conserva `"RESPUESTA_INVALIDA"`. No tocar `devolverConBackoff` ni el conteo de intentos (depends on T013)
  > También hizo falta ajustar el fixture de `src/crm/contactos/analisis/motor/ejecutor.ia.test.ts:128` (`invalidos: []` → `new Map()`): el tipo cambió y TypeScript lo marcó.
- [X] T015 [US2] Verificar que `EjecucionAnalisisContactos.errorCodigo` sigue siendo `"RESPUESTA_INVALIDA"` en `src/crm/contactos/analisis/motor/ejecutor.ts:381` y que `CodigoErrorAnalisis` (`motor/auditoria.ts:23`) no se amplió: el motivo fino vive solo en el ítem, que es por contacto (Decisión 4)
- [X] T016 [US2] Verificar FR-007 en `src/crm/contactos/analisis/motor/ejecutor.ts`: el `errorCodigo` pertenece a un conjunto cerrado de códigos. **Ni el texto generado por la IA, ni el tramo que coincidió, ni fragmento alguno de la conversación.** Guardar el tramo sería lo más útil para diagnosticar y es exactamente lo prohibido: son palabras del cliente

**Checkpoint**: escenario 5 del quickstart.

---

## Phase 5: User Story 3 — Recuperar los contactos ya fallidos (Priority: P3)

**Goal**: los 7 contactos en estado fallido quedan evaluados (FR-010, SC-006).

**Independent Test**: con el arreglo desplegado, usar el reintento de la pantalla y verificar que
el contador de fallidos baja a 0.

- [X] T017 [US3] Verificar que `reintentarFallidos` (`src/crm/contactos/analisis/cola.ts:245`) ya hace lo necesario —`FALLIDO` → `PENDIENTE`, intentos en cero, elegible ahora, acotado por `instanciaId`— y que la pantalla de Análisis de Contactos lo expone. **Si alcanza, no se construye nada** (Decisión 5)
  > **Confirmado: alcanza y no se construye nada.** `reintentarFallidos` hace `FALLIDO` → `PENDIENTE`, intentos en cero, elegible ahora y acotado por `instanciaId`; `reintentarFallidosAction` le pone la sesión y `boton-reintentar-fallidos.tsx` lo expone en la pantalla.
- [ ] T018 ⚠️ **PENDIENTE — requiere el arreglo desplegado** [US3] Con el arreglo **ya desplegado**, usar el reintento que expone `src/configuracion/components/analisis-contactos/panel-avance.tsx` y confirmar contra la línea base de T003 que los 7 quedan evaluados. Ejecutarlo antes del despliegue no sirve: vuelven a caer en el mismo filtro y consumen otras cinco llamadas pagas

**Checkpoint**: escenario 6 del quickstart.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T019 Verificar FR-008 en `src/crm/contactos/analisis/`: reglas, puntaje, cola, backoff, tope de cinco intentos, consumo y costo de IA, y qué se escribe en el contacto quedan sin cambios de comportamiento
- [X] T020 [P] Verificar que el camino de lote ininteligible sigue intacto en `src/crm/contactos/analisis/motor/ejecutor.ts:372-394`: el lote se parte en mitades hasta llegar a uno. Comparte archivo con lo que sí se tocó
- [X] T021 [P] Actualizar `docs/analisis-contactos.md` con el umbral, su medición y los cinco motivos de rechazo: por qué 40 y no 25, qué significa que la muestra estuviera censurada, y que separar `PRIVACIDAD_CITA` del resto es lo que permite saber en una consulta si una subida de rechazos es calibración o información personal entrando de verdad
- [X] T022 Correr `npm run test:unit` completo y `npm run build`
- [ ] T023 ⚠️ **PARCIAL — requiere worker y cuenta con IA** Ejecutar [quickstart.md](./quickstart.md) de punta a punta. Los escenarios 5 y 6 necesitan el worker corriendo y una cuenta con IA utilizable
  > **Verificado sin worker**: escenario 1 (1284 de 1284 revalidados contra producción), escenario 2 (los cinco textos reales, en el test), escenario 3 (la cita de 48 caracteres se sigue rechazando) y escenario 4 (los cuatro controles de forma reconocible, batería intacta).
  > **Pendiente**: escenario 5 (el motivo en la fila de auditoría, con rechazos reales) y escenario 6 (reintentar los 7, que exige el despliegue).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: depende de Setup — **BLOQUEA US1 y US2**, que editan la misma función
- **US1 (Phase 3)**: depende de Phase 2
- **US2 (Phase 4)**: depende de Phase 2. Es independiente de US1 en lógica, pero conviene después
  para no cruzar diffs en `salida.ts`
- **US3 (Phase 5)**: depende de que **US1 esté desplegada**, no solo implementada. Es la única
  dependencia dura entre historias
- **Polish (Phase 6)**: depende de lo que se decida entregar

### Within Each User Story

- Los tests marcados [P] se escriben primero y deben fallar antes de implementar
- El flujo del dato: `salida.ts` → `evaluar-lote.ts` → `types.ts` → `ejecutor.ts`

### Parallel Opportunities

- **T007 y T011**: tests de distinto alcance sobre el mismo archivo; escribirlos juntos es
  posible, implementarlos no
- **T020 y T021**: verificación y documentación, independientes

Poco más. Las tres historias tocan `salida.ts` en cadena; paralelizarlas cuesta más en conflictos
que lo que ahorra.

---

## Implementation Strategy

### El hotfix solo (Phase 2 + US1)

1. Phase 1 → Phase 2 → Phase 3
2. **PARAR y VALIDAR**: escenarios 1 a 4 del quickstart. **El 1 es obligatorio** —revalidar los
   1284 textos aceptados— y **el 4 también**: es la prueba de que aflojar la regla de cita no
   aflojó las otras cuatro
3. Desplegar. A partir de ahí ningún contacto nuevo se cae por esta causa

### Después, la trazabilidad y la recuperación

4. US2: el motivo concreto en la auditoría
5. US3, con el arreglo **ya en producción**: reintentar los 7 desde la pantalla

Conviene desplegar US1 sola primero y dejar pasar unas evaluaciones reales antes de recuperar: si
el umbral quedara mal, se descubre con contactos nuevos y no gastando llamadas en los viejos.

---

## Notes

- `[P]` = archivo distinto, sin dependencias pendientes
- **Cero migraciones. Cero dependencias nuevas.**
- Tres tests que no se borran: el límite exacto del umbral (T007), la batería de los cuatro
  controles que **no** se tocan (T006) y los motivos por contacto (T011)
- T009 no es documentación decorativa: es lo único que impide que alguien baje el umbral sin
  repetir la medición
- Commit por tarea o por grupo lógico
