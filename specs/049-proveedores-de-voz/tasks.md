---

description: "Tareas de implementación — 049 Proveedores de Voz y transcripción de notas de voz"
---

# Tasks: Proveedores de Voz y transcripción de notas de voz

**Input**: Documentos de diseño en `specs/049-proveedores-de-voz/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: SÍ se incluyen. No es opcional acá: el Principio V de la Constitución exige tests
proporcionales al riesgo, y [contracts/alcance-transcripcion.md](./contracts/alcance-transcripcion.md)
declara obligatorios los del invariante de alcance — un incumplimiento no produce ningún error
visible, solo factura de más en silencio.

**Organization**: por historia de usuario, para poder entregar y validar cada una sola.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (archivo distinto, sin dependencias pendientes)
- **[Story]**: US1 / US2 / US3 según `spec.md`
- Toda tarea lleva la ruta exacta del archivo

## Path Conventions

Monolito Next.js: `src/` en la raíz del repo, tests junto al archivo (`*.test.ts`), E2E en
`tests/e2e/`. Migraciones en `prisma/migrations/`.

---

## Phase 1: Setup

**Purpose**: andamiaje del módulo y de la configuración, sin lógica todavía.

- [X] T001 Crear la estructura de `src/voz/` y `src/voz/proveedores/` con los archivos vacíos que declara el árbol de `plan.md` (§Source Code), sin implementación
- [X] T002 [P] Añadir `"voz"` a la unión de recursos (`src/shared/auth/permisos.ts:71`) y una columna `voz` a la matriz de **los 9 roles** (líneas 80-129), con el mismo criterio que `ia`: `rw` para OWNER/ADMIN, `r` donde `ia` es `r`, `none` donde `ia` es `none`
- [X] T003 [P] Crear `src/voz/config-entorno.ts` con esquema Zod que valide `VOZ_TIMEOUT_MS` (default 12000), `VOZ_BARRIDO_INTERVALO_MS` (default 60000) y `VOZ_LOTE` (default 5), siguiendo el patrón de `src/crm/contactos/analisis/config-entorno.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: sin esto ninguna historia es implementable.

**⚠️ CRÍTICO**: T004-T006 son el prerequisito bloqueante de research R1 y van **en su propio
commit**, separados de la feature. `FR-016` no es implementable sin ellos.

### Prerequisito: el vínculo mensaje ↔ archivo

- [X] T004 Añadir `mediaArchivoId: payload.mediaArchivoId` a la llamada de `procesarMensajeEntrante` en `src/suscriptores/mensajes/procesar-entrante.suscriptor.ts` (el contrato ya lo declara en `src/eventos/contratos/procesar-entrante.comando.ts:17`; el suscriptor lo descarta)
- [X] T005 Añadir `mediaArchivoId?: string` a `ComandoProcesarMensajeAppNativaPayload` en `src/eventos/contratos/procesar-mensaje-app-nativa.comando.ts` y propagarlo en `src/suscriptores/mensajes/procesar-mensaje-app-nativa.suscriptor.ts`
- [X] T006 Crear la migración de datos `prisma/migrations/<ts>_vincular_media_archivo_mensajes/migration.sql` con el `UPDATE` de [data-model.md](./data-model.md) §Migraciones paso 1. Verificar antes y después que `SELECT COUNT(*) FROM "MensajeConversacion" WHERE tipo IN ('AUDIO','NOTA_VOZ') AND "mediaArchivoId" IS NULL` pasa de 733 a 0

### Esquema

- [X] T007 Añadir a `prisma/schema.prisma` los enums `ProveedorVozEnum` y `EstadoTranscripcion`, los modelos `ProveedorVoz` y `UsoVoz`, las 8 columnas de transcripción en `MediaArchivo`, `ConfiguracionEmpresa.transcripcionVozHabilitada` y las relaciones inversas en `Instancia` — todo según [data-model.md](./data-model.md)
- [X] T008 Generar la migración `prisma/migrations/<ts>_proveedores_voz_y_transcripcion/` y añadir **a mano** el índice parcial `MediaArchivo_transcripcion_pendiente_idx` (no se declara en el DSL de Prisma; misma convención que `ContactoAnalisisCola`)

### Contrato y registro de adaptadores

- [X] T009 [P] Definir `IProveedorVoz`, `TranscribirParams` y `TranscribirResult` en `src/voz/proveedores/types.ts` según [contracts/proveedor-voz.md](./contracts/proveedor-voz.md)
- [X] T010 [P] Implementar el registro en `src/voz/proveedores/registro.ts` con `registrarProveedorVoz` / `crearProveedorVoz`, fábrica `(apiKey, modelo?, baseUrl?)` — **`baseUrl` debe llegar al adaptador**, a diferencia de `src/ai/proveedores/registro.ts` (research R3)
- [X] T011 [P] Crear `src/voz/proveedores/disponibles.ts` con `PROVEEDORES_VOZ_IMPLEMENTADOS`, `estaImplementado()` y `mensajeProveedorNoImplementado()`, **sin dependencias de servidor** para que lo importen a la vez la Server Action y el formulario cliente
- [X] T012 Crear `src/voz/proveedores/inicializar.ts` que registre los adaptadores, importado una sola vez desde `src/voz/transcribir.ts`

**Checkpoint**: esquema migrado, FK reparado y contrato listo. Puede empezar US1.

---

## Phase 3: User Story 1 — El comercio activa la transcripción y lee sus notas de voz (P1) 🎯 MVP

**Goal**: el comercio carga su credencial, enciende el interruptor, y cada nota de voz que llega
se lee como texto en el inbox sin reproducir el audio.

**Independent Test**: dar de alta un proveedor, activar el toggle, enviar una nota de voz y
verificar que el texto aparece en el inbox. Apagar el toggle, enviar otra, y verificar que no se
transcribe ni se consume saldo. No requiere que la IA exista en esa cuenta.

### Tests for User Story 1 ⚠️

> Escribirlos antes de la implementación y verificar que fallan.

- [X] T013 [P] [US1] **Test del invariante de alcance** en `src/voz/transcribir.alcance.test.ts`: los 7 casos de la tabla de [contracts/alcance-transcripcion.md](./contracts/alcance-transcripcion.md). Los críticos son `video/mp4` + mensaje `VIDEO` ⇒ **cero** llamadas al proveedor, y una fila marcada `PENDIENTE` a mano cuyo mensaje es `VIDEO` ⇒ el segundo corte la pasa a `NO_APLICA`. **Este archivo no se borra**
- [X] T014 [P] [US1] Test del adaptador en `src/voz/proveedores/elevenlabs.test.ts`: mockear `fetch` y asertar los **parámetros enviados** (`model_id: "scribe_v3"`, header `xi-api-key`, multipart con campo `file`), igual que `src/ai/proveedores/openai.test.ts`. Incluir el mapeo de `words[].type === "word"` a `palabras`
- [X] T015 [P] [US1] Test de la decisión de dominio en `src/voz/transcribir.test.ts`: `INAUDIBLE` con texto vacío, con cero palabras (solo `audio_event`) y con `language_probability < 0.5`; `LISTO` en el resto. Más el caso que **`INAUDIBLE` no incrementa intentos ni vuelve a `PENDIENTE`** (FR-017)
- [X] T016 [P] [US1] Test de la cola en `src/voz/cola.test.ts` con `prisma.$executeRaw` mockeado, al estilo de `src/crm/contactos/analisis/cola.test.ts`: `calcularBackoffMs` (30s × 2^intentos, tope 30 min, jitter 0,8–1,2) y que al llegar a `MAX_INTENTOS` la fila pasa a `ERROR`
- [X] T017 [P] [US1] Test en `src/voz/proveedores/inicializar.test.ts` que mantiene `PROVEEDORES_VOZ_IMPLEMENTADOS` sincronizado con el registro real
- [X] T018 [P] [US1] Test en `src/configuracion/voz/actions.test.ts`: alias duplicado rechazado, `proveedor` inmutable al editar, **API key vacía conserva la vigente** (FR-003), y que ninguna query de lectura devuelve `apiKeyEncriptada` (FR-002)

### Implementación — dominio

- [X] T019 [P] [US1] Implementar el adaptador ElevenLabs en `src/voz/proveedores/elevenlabs.ts`: `POST {baseUrl}/v1/speech-to-text`, `multipart/form-data` con `FormData`/`Blob` globales de Node 20, timeout por `AbortSignal`, `estaDisponible()` contra `GET /v1/user`. **No interpreta el resultado**: devuelve texto, idioma, confianza y conteo de palabras
- [X] T020 [P] [US1] Implementar `src/voz/cola.ts` con `marcarPendiente`, `marcarPendienteSinFallar`, `reclamarLote` (`UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED)`), `calcularBackoffMs`, `devolverConBackoff` y `recuperarLeasesVencidos`, copiando la mecánica de `src/crm/contactos/analisis/cola.ts`
- [X] T021 [P] [US1] Implementar `src/voz/auditoria.ts` con `registrarUsoVoz` y el cálculo `costoEstimado = (segundos/3600) × costoPorHora`, devolviendo `null` sin tarifa (research R7)
- [X] T022 [US1] Implementar `seleccionarProveedorVoz(instanciaId)` en `src/voz/orquestador.ts`: proveedores activos ordenados por `prioridad` descendente, salteando los que no tengan `apiKeyEncriptada`, con `descifrarToken` y `crearProveedorVoz(proveedor, apiKey, modelo, baseUrl)` (depende de T010)
- [X] T023 [US1] Implementar `src/voz/transcribir.ts`: **segundo corte de alcance** (revalidar contra la base que el `MediaArchivo` siga referenciado por un mensaje `AUDIO`/`NOTA_VOZ` antes de leer el archivo), tope de 25 MB, lectura con `getStorageProvider().download(key)`, llamada al proveedor, decisión `LISTO`/`INAUDIBLE` de [contracts/proveedor-voz.md](./contracts/proveedor-voz.md), escritura de la fila y `registrarUsoVoz`. Depende de T019-T022
- [X] T024 [US1] Implementar el barrido del worker en `src/voz/barrido.ts` (ciclo con `setTimeout` recursivo, al estilo de `src/crm/contactos/analisis/motor/ciclo.ts`) y arrancarlo desde `src/worker/disparadores.ts`

### Implementación — enganche

- [X] T025 [US1] En `src/conversaciones/actions.ts`, dentro de `procesarMensajeEntrante`: tras el INSERT del mensaje y **antes** de `publicar(MensajeRecibido)`, si el tipo es `AUDIO`/`NOTA_VOZ` y la instancia tiene el toggle activo, marcar `PENDIENTE` y transcribir inline con timeout `VOZ_TIMEOUT_MS`. Vencido o fallido: **publicar igual** y dejar la fila `PENDIENTE` (FR-028, SC-005)
- [X] T026 [US1] En `src/conversaciones/actions.ts`, dentro de `registrarMensajeAppNativa`: marcar `PENDIENTE` sin transcribir inline — nadie espera ese texto (research R5)
- [X] T027 [US1] Añadir `obtenerTranscripcionVozHabilitada(instanciaId)` a `src/configuracion/empresa/queries.ts`, como getter estrecho al estilo de `obtenerMonedaPrincipal`, con caché corta para no pegarle a la base en cada mensaje

### Implementación — configuración (UI)

- [X] T028 [P] [US1] Crear `src/configuracion/voz/schema.ts` con `ProveedorVozSchema` y `ActualizarProveedorVozSchema = ProveedorVozSchema.omit({ proveedor: true })`
- [X] T029 [US1] Crear `src/configuracion/voz/actions.ts` con `crearProveedorVoz`, `actualizarProveedorVoz`, `toggleProveedorVoz`, `eliminarProveedorVoz`, `probarCredencialesVoz` y `guardarTranscripcionVozHabilitada`, todas con el preámbulo `requireSesion()` → `verificarAcceso(sesion, "voz", "modificar")` → Zod → Prisma acotado por `instanciaId` → `revalidatePath("/configuracion")`, según [contracts/eventos-y-server-actions.md](./contracts/eventos-y-server-actions.md)
- [X] T030 [P] [US1] Crear `src/configuracion/voz/queries.ts` con `obtenerProveedoresVoz(instanciaId)` cuyo `select` **excluye explícitamente `apiKeyEncriptada`**
- [X] T031 [P] [US1] Crear `src/configuracion/components/form-proveedor-voz.tsx` (client): dialog + react-hook-form + `zodResolver`, toggle de ojo para la credencial, botón "Probar credenciales". Nunca recibe la API key en modo edición
- [X] T032 [US1] Crear `src/configuracion/components/lista-proveedores-voz.tsx` (client) y `src/configuracion/components/tab-voz.tsx` (server) con el interruptor de transcripción, que debe quedar **deshabilitado mientras no exista un proveedor activo con credencial**
- [X] T033 [US1] Registrar la pestaña `"voz"` en `src/app/configuracion/page.tsx`, con el mismo `requireSesion()` + `verificarAcceso` del resto

### Implementación — inbox

- [X] T034 [US1] Añadir `transcripcion`, `transcripcionEstado` y `transcripcionIdioma` a `MensajeConMeta` en `src/conversaciones/types.ts`, al `mensajeInclude` y a `mapearMensaje` en `src/conversaciones/queries.ts`
- [X] T035 [US1] Arreglar `obtenerMensajesConversacion` (`src/conversaciones/queries.ts:147`) para que use `mensajeInclude` en vez del cast `as unknown as MensajeConMeta` — si no, la transcripción llega `undefined` según qué endpoint sirva la conversación
- [X] T036 [US1] Crear el subcomponente `BurbujaAudio` en `src/conversaciones/components/burbuja-mensaje.tsx`, modelado sobre `BurbujaVideo` (`:130`): conserva el reproductor y añade "Ver transcripción" con `useState`. Estados: `PENDIENTE`/`PROCESANDO` → "Transcribiendo…"; `LISTO` → texto; `INAUDIBLE` → "Inaudible" en cursiva; `ERROR` → nada visible al agente (FR-024). Reemplazar el bloque de audio de `:357` por este componente

**Checkpoint**: US1 completa. El comercio activa, recibe una nota de voz y la lee sin
reproducirla. Validar con los pasos 2-5 de [quickstart.md](./quickstart.md).

---

## Phase 4: User Story 2 — El agente de IA entiende lo que el cliente dijo hablando (P2)

**Goal**: la transcripción llega al prompt del agente y a los Workflows, y una transcripción
tardía refresca la burbuja sola.

**Independent Test**: con un agente de IA habilitado, enviar una nota de voz con una pregunta
concreta y verificar que la respuesta se refiere a lo preguntado. Repetir con un Workflow con
nodo Menú contestado por voz.

### Tests for User Story 2 ⚠️

- [X] T037 [P] [US2] Tests en `src/ai/contexto/constructor.test.ts`: un audio con transcripción entra al prompt identificado como nota de voz; un audio **sin** transcripción entra como marcador `[nota de voz no transcrita]` y **no** se descarta como mensaje vacío (FR-027)
- [X] T038 [P] [US2] Test en `src/workflows/motor/disparo.test.ts`: un nodo Menú contestado con nota de voz transcrita avanza la ejecución; sin transcripción, el comportamiento actual no cambia

### Implementación

- [X] T039 [US2] En `src/ai/contexto/constructor.ts`: añadir `tipo` y `mediaArchivo: { select: { transcripcion, transcripcionEstado } }` al `select` (`:62`), y en el `.filter`/`.map` (`:209-221`) usar `contenido ?? transcripción` con prefijo `[nota de voz] `, o el marcador cuando no haya
- [X] T040 [P] [US2] En `src/ai/respuesta/responder-con-agente.ts:405`, hacer que `obtenerUltimoMensajeCliente` considere la transcripción, para que el gate de autonomía deje de recibir `null` ante un audio
- [X] T041 [P] [US2] En `src/workflows/motor/disparo.ts` (`:42`, `:68`, `:246-262`) y `src/workflows/motor/contexto.ts:152`, usar `contenido ?? transcripcion ?? ""`
- [X] T042 [P] [US2] Crear el contrato `src/eventos/contratos/audio-transcrito.evento.ts` según [contracts/eventos-y-server-actions.md](./contracts/eventos-y-server-actions.md), con `version: 1`
- [X] T043 [US2] Registrar el evento en `src/eventos/catalogo.ts` (`AudioTranscrito: "AUDIO_TRANSCRITO"`), `src/eventos/mapa.ts`, `src/shared/rabbitmq/exchanges.ts` (`RK.EVENTO_AUDIO_TRANSCRITO` + `TIPO_EVENTO_A_RK`) y añadir la routing key a `routingKeys` de `src/suscriptores/sse/sse-relay.suscriptor.ts`. **Ningún suscriptor que marque audios debe escucharlo** — sería un bucle
- [X] T044 [US2] Publicar `AudioTranscrito` al final de `src/voz/transcribir.ts` y consumirlo en el cliente del inbox para refrescar la burbuja sin recargar (FR-025)
- [X] T045 [P] [US2] Incluir la transcripción en el `ultimoMensaje` de `src/conversaciones/queries.ts:120` y en el filtro de búsqueda de `src/conversaciones/components/inbox-layout.tsx:354`

**Checkpoint**: US1 y US2 funcionan de forma independiente.

---

## Phase 5: User Story 3 — El comercio controla y entiende su gasto de voz (P3)

**Goal**: minutos y costo visibles, tope diario, y el adaptador OpenAI como prueba de que la
abstracción no quedó pegada a ElevenLabs.

**Independent Test**: transcribir varios audios y verificar que el resumen del mes refleja lo
consumido; configurar un tope, alcanzarlo, y verificar que se deja de transcribir sin romper la
recepción de mensajes.

### Tests for User Story 3 ⚠️

- [X] T046 [P] [US3] Test en `src/voz/limites.test.ts`: alcanzado `limiteMinutosDia`, `transcribir` no llama al proveedor y la fila queda `PENDIENTE`; el mensaje se recibe igual
- [X] T047 [P] [US3] Test en `src/voz/proveedores/openai.test.ts`, mismo criterio que T014

### Implementación

- [X] T048 [P] [US3] Añadir `obtenerResumenUsoVoz(instanciaId)` a `src/configuracion/voz/queries.ts` agregando `UsoVoz` por día y mes. **Los cortes de día salen de `obtenerZonaNegocio(instanciaId)`**, nunca de la zona del navegador (regla 7 de `CLAUDE.md`)
- [X] T049 [US3] Mostrar minutos y costo del día y del mes en `src/configuracion/components/tab-voz.tsx`
- [X] T050 [P] [US3] Implementar el control de `limiteMinutosDia` en `src/voz/limites.ts` y consultarlo desde `src/voz/transcribir.ts` antes de llamar al proveedor
- [X] T051 [P] [US3] Implementar el adaptador OpenAI (`gpt-4o-transcribe`) en `src/voz/proveedores/openai.ts` y registrarlo — el SDK `openai` ya está en `package.json`
- [X] T052 [P] [US3] En `src/ai/analisis-contactos/contexto.ts:157-168`, cambiar el filtro SQL por `COALESCE(m."contenido", ma."transcripcion")` con el join al `MediaArchivo`
- [X] T053 [P] [US3] Rellenar `MensajeConversacion.mediaDuracion` con `transcripcionSegundos` cuando esté NULL, al cerrar la transcripción en `src/voz/transcribir.ts` — resuelve de paso los 727 audios de Instagram sin duración (research R10)

**Checkpoint**: las tres historias funcionan de forma independiente.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T054 [P] Crear `scripts/049-backfill-transcripciones.ts` con `--instancia` y `--dry-run`, que parte de `MensajeConversacion` filtrando por `tipo` (**nunca de `MediaArchivo`**) e informa audios, minutos y costo estimado antes de escribir
- [X] T055 [P] Documentar el evento `AudioTranscrito` en `docs/eventos.md`
- [X] T056 [P] Crear `docs/proveedores-de-voz.md` con el invariante de alcance, la razón por la que el mime no sirve y el criterio de `INAUDIBLE`; enlazarlo desde `CLAUDE.md` como regla nueva
- [X] T057 [P] Test E2E en `tests/e2e/configuracion/proveedores-voz.spec.ts`: alta, edición y toggle del proveedor, verificando que la API key nunca viaja al cliente
- [X] T058 Evaluar el soporte de audio en Facebook Messenger: 048 dejó `src/conversaciones/providers/facebook-messenger.ts:168-178` con solo `image` y `video` como media directa, y el audio cae en `NO_ADMITIDO` sin `mediaUrl` a propósito. Habilitarlo exige sumar `"audio"` a la media directa **y** a la reubicación del webhook, respetando que ninguna URL de Meta llegue a la base
- [ ] T059 ⚠️ PENDIENTE (requiere migración aplicada + cuenta real de ElevenLabs) — Correr la validación completa de [quickstart.md](./quickstart.md), incluida la consulta del invariante del paso 4 (debe dar 0) y la verificación de que con el toggle apagado `UsoVoz` no crece
- [X] T060 `npm run build` con exit 0 y `npm run test:unit` en verde

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: depende de Setup. **Bloquea todas las historias**
  - Dentro de la fase: T004-T006 (prerequisito, commit propio) → T007-T008 (esquema) → T009-T012 (contrato)
- **US1 (Phase 3)**: depende de Phase 2 completa
- **US2 (Phase 4)**: depende de Phase 2. **Además depende funcionalmente de US1**: sin texto producido no hay nada que leer. Se puede implementar en paralelo, pero no validar
- **US3 (Phase 5)**: depende de Phase 2. Independiente de US2
- **Polish (Phase 6)**: depende de las historias que se entreguen

### Within User Story 1

```
T013-T018 (tests, fallan)
   ↓
T019, T020, T021 [P] ──→ T022 ──→ T023 ──→ T024
                                    ↓
                              T025, T026, T027   (enganche)
T028 ──→ T029, T030 [P] ──→ T031 ──→ T032 ──→ T033   (configuración)
T034 ──→ T035 ──→ T036                                (inbox)
```

Las tres columnas (dominio, configuración, inbox) son independientes entre sí una vez hecho
T007-T012.

### Parallel Opportunities

- **Phase 1**: T002 y T003 en paralelo
- **Phase 2**: T009, T010 y T011 en paralelo tras T008
- **US1 tests**: T013-T018, los seis en paralelo
- **US1 implementación**: tres frentes simultáneos — dominio (T019-T024), configuración (T028-T033) e inbox (T034-T036)
- **US2**: T040, T041, T042 y T045 en paralelo
- **US3**: T048, T050, T051, T052 y T053 en paralelo
- **Phase 6**: T054-T057 en paralelo

---

## Parallel Example: User Story 1

```bash
# Los seis tests de US1, juntos (deben fallar):
Task: "Test del invariante de alcance en src/voz/transcribir.alcance.test.ts"
Task: "Test del adaptador en src/voz/proveedores/elevenlabs.test.ts"
Task: "Test de LISTO/INAUDIBLE en src/voz/transcribir.test.ts"
Task: "Test de backoff y lease en src/voz/cola.test.ts"
Task: "Test de sincronización del registro en src/voz/proveedores/inicializar.test.ts"
Task: "Tests de Server Actions en src/configuracion/voz/actions.test.ts"

# Los tres bloques independientes del dominio:
Task: "Adaptador ElevenLabs en src/voz/proveedores/elevenlabs.ts"
Task: "Cola con lease y backoff en src/voz/cola.ts"
Task: "Auditoría y costo en src/voz/auditoria.ts"
```

---

## Implementation Strategy

### Primero el prerequisito, en su propio commit

T004-T006 se entregan **solos**, antes de tocar la feature. Son un bug con valor propio: hoy
`MediaArchivo` nunca se vincula al contacto ni al mensaje, y 048 construyó toda la cadena del
webhook para producir ese `mediaArchivoId` que el suscriptor descarta. Separarlo mantiene la
migración de datos revisable por sí sola.

### MVP (solo US1)

1. Phase 1 → Phase 2 → Phase 3
2. **Parar y validar** con los pasos 2-5 del quickstart
3. Entregable: el comercio lee sus notas de voz sin escucharlas

### Entrega incremental

1. Prerequisito (T004-T006) → verificable solo
2. Setup + Foundational → base lista
3. US1 → validar → **MVP**
4. US2 → validar → la IA y los Workflows usan el texto
5. US3 → validar → control de gasto
6. Polish

---

## Notes

- `[P]` = archivo distinto, sin dependencias pendientes
- Commit por tarea o por grupo lógico; parar en cada checkpoint a validar
- **T013 no se borra ni se "simplifica"**: es el único test que detecta que se están transcribiendo videos, porque el proveedor los acepta sin error
- **`INAUDIBLE` es terminal.** Tratarlo como fallo lo mete en el backoff y gasta cinco llamadas pagas para obtener cinco veces el mismo silencio
- Toda query nueva lleva `instanciaId`. Ninguna devuelve `apiKeyEncriptada`
- Ningún log puede contener credenciales ni contenido de conversaciones
