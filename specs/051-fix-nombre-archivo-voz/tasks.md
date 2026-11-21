---

description: "Task list — 051 hotfix del nombre de archivo en transcripción"
---

# Tasks: El nombre del archivo deja de impedir la transcripción

**Input**: Design documents from `specs/051-fix-nombre-archivo-voz/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/nombre-archivo.md](./contracts/nombre-archivo.md)

**Tests**: SÍ. `plan.md` § Technical Context los pide y la Constitución (principio V) los exige
proporcionales al riesgo. Acá el riesgo está en dos lugares: la heurística de "¿ya tiene
extensión?" y el valor por defecto del nuevo parámetro de la cola — los dos fallan en silencio.

**Organization**: por historia. **US1 es el hotfix**; US2 es la recuperación de lo ya roto.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (archivo distinto, sin dependencias pendientes)
- **[Story]**: US1 / US2 — solo en las fases de historia

## Path Conventions

Monorepo Next.js + worker. El hotfix vive en `src/voz/`; la recuperación en `scripts/`.

---

## Phase 1: Setup

- [X] T001 Crear la rama `fix/051-nombre-archivo-voz` desde `main` @ `b0949f7`. **No** desde `feature/050-consumo-voz-por-proveedor`: son independientes y no comparten ningún archivo
- [X] T002 Confirmar que `npx prisma migrate status` no reporta nada pendiente y que `prisma/schema.prisma` NO necesita cambios — este hotfix no lleva migración
- [X] T003 Anotar la línea base: los ids de los `MediaArchivo` hoy en `ERROR` y, de cada uno, el código de su fila de `UsoVoz`. En producción son 3, uno solo con el código de formato no soportado. Es el patrón contra el que se valida FR-010 (que la recuperación NO toque los otros dos)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: la función pura que compone el nombre. Las dos historias dependen de ella.

**⚠️ CRITICAL**: US2 no sirve de nada sin esto — recuperar audios sin el arreglo los hace fallar otra vez.

- [X] T004 Escribir `src/voz/nombre-archivo.test.ts` con los ocho casos de `contracts/nombre-archivo.md` § 1: el caso real (`audio-1795275488865` + clave `.mp4`), WhatsApp (`.ogg`), nombre que ya trae extensión (no se duplica ni se reemplaza), clave sin extensión (se degrada al comportamiento actual), `claveStorage` en `null`, nombre vacío (base `audio`), extensión en mayúsculas (se normaliza), y `archivo.de.audio` (la fila que fija qué hace la heurística ante puntos decorativos). Debe fallar antes de T005
- [X] T005 Implementar `nombreConExtension(nombre, claveStorage)` en `src/voz/nombre-archivo.ts`. La extensión sale **de la clave de storage**, nunca del mime: la clave ya codifica lo que `extDesde(mime)` derivó al guardar, parámetros del mime incluidos. Documentar en el encabezado por qué NO se define un mapa propio (segunda lista que se desincroniza) y por qué NO se inventa extensión cuando no hay ninguna (adivinar mal convierte un fallo entendible en uno confuso)
  > **Corrección durante la implementación, detectada por T004.** La regla del contrato —"si el nombre ya tiene extensión, no tocarlo"— **no se puede implementar**: `archivo.de.audio` termina en `.audio`, cinco alfanuméricos, indistinguible de una extensión real. La regla final no usa heurística: la única pregunta es si el nombre ya termina en **la extensión que la clave declara**. Efecto lateral: `nota.mp3` sobre clave `.mp4` pasa a `nota.mp3.mp4`, feo pero correcto, en un caso que no ocurre (0 de 744). Contrato actualizado.

**Checkpoint**: la función existe y está probada. Nada cambió todavía en el flujo real.

---

## Phase 3: User Story 1 — La nota de voz se transcribe aunque llegue sin extensión (Priority: P1) 🎯 EL HOTFIX

**Goal**: con Groq u OpenAI, una nota de voz de Instagram o WhatsApp se transcribe igual que con
ElevenLabs (FR-001, FR-004).

**Independent Test**: con Groq como único proveedor activo, mandar una nota de voz por Instagram
y verificar que aparece transcrita, sin ningún fallo registrado.

### Tests for User Story 1

- [X] T006 [P] [US1] Escribir `src/voz/transcribir.nombre.test.ts` con el invariante de `contracts/nombre-archivo.md` § 2: **todo `nombreArchivo` que llega a `IProveedorVoz.transcribir()` lleva extensión** cuando el archivo tiene clave con extensión. Verificarlo con un proveedor falso que capture lo que recibe —NO leyendo el código de los adaptadores—, para que un adaptador nuevo quede cubierto sin que nadie se acuerde. Cubrir los dos mimes reales (`video/mp4` y `audio/ogg; codecs=opus`). Debe fallar antes de T007

### Implementation for User Story 1

- [X] T007 [US1] En `src/voz/transcribir.ts:123`, pasar `nombreConExtension(media.nombreOriginal, key)` en vez de `media.nombreOriginal`, reutilizando la `key` que la función ya calcula en la línea 90 para descargar el archivo. **No tocar nada más**: `mimeType` sigue siendo `media.mimeOriginal`, los tres cortes de alcance de 049 quedan donde están, el timeout se calcula igual y el registro de uso no cambia (depends on T005, T006)
  > **Verificado también contra los datos reales**: con el arreglo, los 744 audios de producción producen un nombre con extensión; ninguno queda sin ella. El de Ramón pasa a `audio-1795275488865.mp4`, que es el nombre exacto que Groq aceptó al reproducir el fallo.
- [X] T008 [US1] Verificar que `src/voz/proveedores/` quedó **sin diff**: ni el transporte compartido, ni los adaptadores, ni la traducción de errores. Si hubo que tocar un adaptador, el arreglo quedó mal ubicado (FR-004, Decisión 2 de research.md)
- [X] T009 [US1] Verificar que `src/voz/proveedores/groq.ts:76` sigue clasificando el 400 como **permanente**. El arreglo hace que ese código deje de dispararse con formatos válidos; no lo vuelve reintentable. Relajarlo costaría cinco llamadas pagas por cada audio genuinamente inválido (FR-006)

**Checkpoint**: el hotfix está completo y desplegable. Escenarios 1, 2, 3 y 4 del quickstart.

> **El escenario 3 del quickstart es el que más importa de todo el hotfix.** ElevenLabs ya
> funcionaba y ahora recibe un nombre distinto. Si su transcripción cambia de texto, idioma o
> segundos, el arreglo está mal ubicado y hay que moverlo al transporte compartido de
> Groq/OpenAI (ver Decisión 2 de research.md). Eso se prueba con audios reales, no con tests.

---

## Phase 4: User Story 2 — Recuperar las notas que murieron por esta causa (Priority: P2)

**Goal**: devolver a la cola los audios en `ERROR` causados por este problema, sin tocar los que
fallaron por otra (FR-008, FR-010).

**Independent Test**: con el arreglo desplegado, ejecutar la recuperación en modo simulación,
verificar que lista exactamente el audio afectado (1 en producción) y ninguno de los otros dos,
aplicarla, y confirmar que termina transcrito.

### Tests for User Story 2

- [X] T010 [P] [US2] Ampliar `src/voz/cola.test.ts` (o crearlo) con el nuevo parámetro de `marcarPendiente`: **por defecto NO reinicia los intentos** —si el valor por defecto quedara invertido, el tope de cinco deja de existir para todos y nadie lo nota hasta que un proveedor caído genera llamadas sin fin— y con `reiniciarIntentos: true` los pone en cero. Debe fallar antes de T011

### Implementation for User Story 2

- [X] T011 [US2] En `src/voz/cola.ts:46`, agregar `reiniciarIntentos?: boolean` a `marcarPendiente`, por defecto `false`, que añada `"transcripcionIntentos" = 0` al `UPDATE`. **Las guardias no se tocan**: tenant, tipo de mensaje y estados permitidos siguen en el SQL, que es donde 049 las puso a propósito. `marcarPendienteSinFallar` no cambia de firma (depends on T010)
  > **Primera versión duplicaba el `UPDATE`** —uno con reinicio y otro sin— y eso es justo lo que `research.md` Decisión 5 dice evitar. Rehecho como **una sola sentencia** con el reinicio como parámetro booleano dentro de un `CASE`. Las guardias quedan con una sola definición, y hay un test (`el reinicio no afloja ninguna guardia`) que recorre los dos valores.
- [X] T012 [US2] Crear `scripts/051-recuperar-formato-no-soportado.ts` siguiendo la convención de `scripts/049-backfill-transcripciones.ts`: **simula por defecto**, exige `--aplicar` para escribir, acepta `--instancia <id>`. Selecciona `MediaArchivo` en `ERROR` que tengan una fila de `UsoVoz` con el código de formato no soportado — tipado como `CodigoErrorVoz` (`src/voz/proveedores/types.ts:70`), nunca una cadena suelta: si el código se renombrara, el script debe romper al compilar y no devolver un "nada que hacer" falso (depends on T011)
- [X] T013 [US2] En `scripts/051-recuperar-formato-no-soportado.ts`, escribir con `marcarPendiente({ ..., reiniciarIntentos: true })`, una fila a la vez. No transcribe: devuelve a la cola y el worker hace el resto, con el tope diario y el registro de uso de siempre (FR-012) (depends on T012)
- [X] T014 [US2] Ejecutar `scripts/051-recuperar-formato-no-soportado.ts` en modo simulación contra producción y verificar contra la línea base de T003: lista **solo** el audio con el código de formato no soportado, y **no** los dos que fallaron contra ElevenLabs por otra causa (FR-010)
  > **Resultado contra producción**: 1 nota de voz (`cmwqkoalf0…`, la de Ramón), y **ninguno** de los dos `ERROR` de ElevenLabs. Coincide exactamente con la línea base de T003.

**Checkpoint**: escenario 5 del quickstart, incluida la segunda corrida que no debe encontrar nada.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T015 Verificar FR-007 en `src/voz/`: el reclamo con lease, el backoff, el tope de cinco intentos, el tope diario de minutos (`src/voz/limites.ts`), el registro de uso (`src/voz/auditoria.ts`) y la decisión de inaudible quedan sin cambios de comportamiento
- [X] T016 [P] Actualizar `docs/proveedores-de-voz.md`: que hay dos clases de proveedor —los que identifican el formato por el nombre (Groq, OpenAI) y los que lo hacen por el contenido (ElevenLabs)—, que por eso el nombre se compone en `transcribir.ts` y no en cada adaptador, y que la extensión sale de la clave de storage justamente para no tener una segunda lista de mimes
- [X] T017 [P] Verificar que `src/lib/media/` quedó **sin diff**: la extensión se lee de la clave que ese módulo ya produce, sin importar su lógica interna ni exportar nada nuevo
- [X] T018 Correr `npm run test:unit` completo y `npm run build`
- [ ] T019 ⚠️ **PENDIENTE — requiere worker, audios reales y credenciales de Groq + ElevenLabs** Ejecutar [quickstart.md](./quickstart.md) de punta a punta. Los escenarios 1, 2, 3 y 4 necesitan el worker corriendo y credenciales de **Groq y ElevenLabs a la vez**: una para probar el arreglo, otra para probar que no se rompió nada
  > **Verificado sin worker**: el nombre que produce el arreglo sobre los 744 audios reales (ninguno queda sin extensión); que Groq acepta ese nombre exacto (reproducido contra la API durante el diagnóstico); el invariante con proveedor falso; `src/voz/proveedores/` y `src/lib/media/` sin diff; suite completa y build.
  > **Pendiente**: escenarios 1–4 con audios reales, en especial **el 3 — la no-regresión de ElevenLabs**, que es el riesgo asumido al poner el arreglo en `transcribir.ts`. Y el escenario 5 (`--aplicar`), que **no se ejecutó a propósito**: el arreglo todavía no está en producción, y recuperar antes haría fallar los audios otra vez.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: depende de Setup — **BLOQUEA las dos historias**
- **US1 (Phase 3)**: depende de Phase 2
- **US2 (Phase 4)**: depende de Phase 2 **y de que US1 esté desplegada**. Recuperar audios sin el
  arreglo los hace fallar otra vez y gasta llamadas pagas para nada. Es la única dependencia
  dura entre historias de este hotfix
- **Polish (Phase 5)**: depende de lo que se decida entregar

### Within Each User Story

- Los tests marcados [P] se escriben primero y deben fallar antes de implementar
- `nombre-archivo.ts` → `transcribir.ts` → `cola.ts` → el script

### Parallel Opportunities

- **T006 y T010**: tests de archivos distintos, cada uno antes de su implementación
- **T016 y T017**: documentación y verificación, independientes

El resto es secuencial. El hotfix son ~40 líneas de código sobre tres archivos encadenados más un
script; paralelizarlo no ahorraría nada.

---

## Implementation Strategy

### El hotfix solo (US1)

1. Phase 1 → Phase 2 → Phase 3
2. **PARAR y VALIDAR**: escenarios 1, 2, 3 y 4 del quickstart. **El 3 es obligatorio** — es la
   garantía de no-regresión que exige el flujo de Hotfix
3. Desplegar. A partir de ahí ninguna nota de voz nueva se pierde por esta causa

### Después, la recuperación (US2)

4. Phase 4, con el arreglo **ya en producción**
5. Simular, comparar contra la línea base de T003, aplicar, confirmar

Conviene desplegar US1 sola primero y dejar pasar unas notas de voz reales antes de recuperar: si
el arreglo tuviera algún problema, se descubre con audios nuevos y no gastando llamadas en
reintentar los viejos.

---

## Notes

- `[P]` = archivo distinto, sin dependencias pendientes
- **Cero migraciones. Cero dependencias nuevas.**
- Dos tests que no se borran: el invariante de `transcribir.nombre.test.ts` (T006) y el valor por
  defecto de `reiniciarIntentos` (T010). Los dos fallan en silencio si se quitan
- Los dos fallos contra ElevenLabs encontrados en el diagnóstico quedan **fuera de alcance** a
  propósito. Uno de ellos tiene cinco intentos y un solo registro de uso, lo que sugiere que hay
  fallos que no se están registrando: **merece su propio hotfix**
- Commit por tarea o por grupo lógico
