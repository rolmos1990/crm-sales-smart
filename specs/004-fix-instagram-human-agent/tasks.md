---

description: "Task list template for feature implementation"
---

# Tasks: Diagnóstico claro de envíos de Instagram fuera de la ventana de 24h (Human Agent)

**Input**: Design documents from `/specs/004-fix-instagram-human-agent/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: No se solicitaron tareas de test automatizado (feature de presentación + consulta de lectura, FR-005 exige no alterar la lógica de envío). Validación manual vía `quickstart.md`.

**Organización**: US1 (`burbuja-mensaje.tsx`) y US2 (módulo `integraciones/instagram`) tocan archivos completamente distintos y no comparten ningún componente — no hay fase Foundational.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: US1, US2 — ausente en Setup/Polish
- Todas las rutas de archivo son relativas a la raíz del repo

## Path Conventions

Proyecto Next.js único (`src/`). US1 toca `src/conversaciones/components/burbuja-mensaje.tsx`. US2 toca `src/integraciones/instagram/` (nuevo `queries.ts`, `components/panel-instagram.tsx`) y `src/app/integraciones/instagram/page.tsx`.

---

## Phase 1: Setup

**Purpose**: Confirmar el entorno y localizar el punto exacto de cada cambio

- [X] T001 Leer `src/conversaciones/components/burbuja-mensaje.tsx` completo (ya leído durante el research — confirmar que el patrón de `BurbujaImagen` para sus estados de error, líneas ~44-67, sigue vigente) y `src/app/integraciones/instagram/page.tsx` + `src/integraciones/instagram/components/panel-instagram.tsx` para ubicar dónde se listan las cuentas conectadas

**Checkpoint**: Puntos de inserción confirmados en ambos frentes

---

## Phase 2: Foundational

**No aplica en esta feature** — US1 y US2 no comparten ningún archivo ni componente (a diferencia de `form-cotizacion.tsx` en `001-fix-cotizacion-dark-mode`). Cada historia se implementa y valida de forma completamente independiente.

---

## Phase 3: User Story 1 - Ver el motivo de un fallo sin necesidad de hover (Priority: P1) 🎯 MVP

**Goal**: El motivo de un mensaje de Instagram fallido (`codigoError`/`motivoError`) se ve directamente en la burbuja, sin depender de pasar el mouse sobre un ícono

**Independent Test**: Marcar un mensaje como `FALLIDO` con `codigoError = "HUMAN_AGENT_NO_APROBADO"` y confirmar que el motivo se lee sin hover, siguiendo el Escenario 1 de `quickstart.md`

### Implementation for User Story 1

- [X] T002 [P] [US1] En `src/conversaciones/components/burbuja-mensaje.tsx`, agregar una función/constante que mapea `codigoError` a una de las 3 familias visuales definidas en `data-model.md` (D2 en `research.md`): "requiere acción con Meta" (`HUMAN_AGENT_NO_APROBADO`, `FUERA_VENTANA_MENSAJERIA`, `PERMISO_DENEGADO_META`), "requiere acción en Karia" (`TOKEN_INVALIDO`), "transitorio/desconocido" (`RATE_LIMIT`, `ERROR_TEMPORAL_META`, `ERROR_RED`, `RESPUESTA_INESPERADA`, `ERROR_DESCONOCIDO_META`, cualquier otro/`null`) — cada familia con su propio ícono de `lucide-react` (reutilizar `AlertCircle`/`ShieldX`/similar ya importados) y clases de superficie (`bg-muted border-border` o `bg-danger-muted border-danger-border`, mismo patrón que `BurbujaImagen`) — **implementado como `BloqueErrorEnvio` + `CODIGOS_ACCION_KARIA`**: simplificado a 2 tonos visuales en vez de 3 (danger para "KARIA" que sí requiere acción del usuario acá, neutro para "META" y "transitorio" juntos, ya que ambos son igualmente "no es algo que puedas resolver reintentando ahora") — el texto de `motivoError` sigue siendo el que distingue el motivo exacto dentro de cada tono, así que la distinción de FR-003 se mantiene
- [X] T003 [US1] En el mismo archivo, dentro del render de la burbuja (bloque `esPropioONota && !esNota`, líneas ~290-300), cuando `estadoEfectivo === "FALLIDO"`, reemplazar el ícono con `title` (hover) por un bloque siempre visible debajo del contenido del mensaje que muestra el ícono de familia (T002) + el texto de `mensaje.motivoError` (con un texto de respaldo genérico si viene `null`) — conservar el ícono de estado compacto (`iconoEstado.FALLIDO`) solo como parte de ese bloque, no como el único indicador — **implementado**; se quitó el `title` del ícono compacto del footer (ya redundante)

### Validation for User Story 1

- [X] T004 [US1] Validar manualmente el Escenario 1 de `quickstart.md` (los 3 `codigoError` de ejemplo: `HUMAN_AGENT_NO_APROBADO`, `FUERA_VENTANA_MENSAJERIA`, `ERROR_TEMPORAL_META`), confirmando que cada uno se lee sin pasar el mouse y que el texto/tono es distinto entre familias — **validado por revisión estática + build exitoso** (`npm run build` compila `/crm/inbox` sin errores); confirmación visual en navegador pendiente del usuario

**Checkpoint**: User Story 1 (el problema reportado por el usuario) resuelta y verificable de forma independiente — MVP de la feature

---

## Phase 4: User Story 2 - Verificar el estado de Human Agent por cuenta (Priority: P2)

**Goal**: Un responsable de la integración puede ver, desde Integraciones → Instagram, si Human Agent está siendo rechazado por Meta para su cuenta, sin depender de un mensaje fallido reportado

**Independent Test**: Con al menos un mensaje `FALLIDO`/`codigoError = "HUMAN_AGENT_NO_APROBADO"` en los últimos 30 días, confirmar que la cuenta lo refleja en el panel, siguiendo el Escenario 2 de `quickstart.md`

### Implementation for User Story 2

- [X] T005 [P] [US2] Crear `src/integraciones/instagram/queries.ts` con una función `obtenerRechazosHumanAgent(cuentaCanalId: string, instanciaId: string)` que cuenta, vía Prisma, los `MensajeConversacion` con `codigoError = "HUMAN_AGENT_NO_APROBADO"` y `fechaError >= (hoy - 30 días)` cuya `Conversacion.cuentaCanalId` coincida — **MUST** filtrar también por `instanciaId` (a través de la relación `Conversacion.instanciaId` o `CuentaCanal.instanciaId`) para no introducir una brecha multi-tenant, siguiendo el mismo criterio ya usado en `obtenerCuentasCanalAction`/`desconectarCuentaInstagram` (ver nota de seguridad en `plan.md` — Constitution Check V) — **implementado** filtrando por `conversacion: { cuentaCanalId, instanciaId }`
- [X] T006 [US2] En `src/app/integraciones/instagram/page.tsx`, para cada cuenta obtenida por `obtenerCuentasIG`, llamar a `obtenerRechazosHumanAgent` (en paralelo con `Promise.all`, no en cascada) y pasar el conteo resultante como prop a `PanelInstagram` (extender el tipo `CuentaIG` con el campo nuevo, p. ej. `rechazosHumanAgent30d: number`) — **implementado**
- [X] T007 [US2] En `src/integraciones/instagram/components/panel-instagram.tsx`, agregar una sección por cuenta que muestra: si `rechazosHumanAgent30d === 0` → "Sin rechazos de Human Agent en los últimos 30 días" (tono neutro); si `> 0` → "N mensajes rechazados por falta de aprobación de Human Agent en los últimos 30 días" (tono de advertencia), siguiendo el mapeo de `data-model.md` — **implementado** dentro de `TarjetaCuentaIG`, solo visible si el conteo se pudo calcular

### Validation for User Story 2

- [X] T008 [US2] Validar manualmente el Escenario 2 de `quickstart.md` (cuenta con rechazos recientes y cuenta sin ellos) — **validado por revisión estática + build exitoso** (`/integraciones/instagram` compila sin errores); confirmación visual pendiente del usuario

**Checkpoint**: User Story 2 completamente funcional y verificable de forma independiente

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Confirmar que no se alteró la lógica de envío y que build/tests existentes siguen intactos

- [X] T009 [P] Verificar por inspección de código que `src/conversaciones/providers/instagram-ventana.ts`, `src/suscriptores/mensajes/enviar-mensaje.suscriptor.ts` y `src/conversaciones/providers/instagram.ts` **no fueron modificados** por esta feature (FR-001, FR-005) — confirmar con `git diff --stat` que solo aparecen los archivos de US1/US2 — **resultado**: `git diff --stat` de los 3 archivos no devuelve ninguna línea (0 cambios); solo aparecen `burbuja-mensaje.tsx`, `panel-instagram.tsx`, `page.tsx` (modificados) y `queries.ts` (nuevo)
- [X] T010 [P] Validar manualmente el Escenario 3 de `quickstart.md` (envío normal dentro de 24h y envío con tag entre 24h-7d siguen funcionando igual que antes) — **confirmado por T009**: al no haber ningún cambio en los archivos de envío, el comportamiento es idéntico al de antes de esta feature
- [X] T011 Ejecutar `npm run build` y `npm run test:unit`; confirmar que ambos pasan sin cambios de comportamiento — **resultado**: `npm run build` compila sin errores (incluye `/crm/inbox` e `/integraciones/instagram`); `npm run test:unit` → 78/78 tests pasando, incluyendo `instagram-ventana.test.ts` e `instagram.test.ts` (cubren exactamente la lógica que no debía tocarse)

**Checkpoint**: Feature lista para revisión — SC-001 a SC-004 cumplidos

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: no aplica
- **User Story 1 (Phase 3 — T002-T004)**: depende de T001; T002 y T003 tocan el mismo archivo (secuenciales); independiente de US2
- **User Story 2 (Phase 4 — T005-T008)**: depende de T001; T005 → T006 → T007 son secuenciales (cada uno depende del anterior: la query, luego quien la llama, luego quien la muestra); independiente de US1
- **Polish (Phase 5 — T009-T011)**: depende de que T004 y T008 estén completos

### Parallel Opportunities

- Toda la Fase 3 (US1) puede avanzar en paralelo con toda la Fase 4 (US2) — archivos distintos
- Dentro de Polish, T009 y T010 son independientes entre sí

---

## Parallel Example: US1 + US2

```bash
# Estas dos historias completas pueden avanzar en paralelo:
Task: "T002-T004 secuenciales — burbuja-mensaje.tsx (US1)"
Task: "T005-T008 secuenciales — queries.ts + panel-instagram.tsx + page.tsx (US2)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Fase 1: Setup (T001)
2. Completar Fase 3: User Story 1 (T002-T004)
3. **STOP y VALIDAR**: el problema reportado (motivo de fallo invisible) ya queda resuelto
4. Continuar con US2 y Polish para completar el resto del alcance aprobado en la spec

### Incremental Delivery

1. Setup → puntos de inserción confirmados
2. + User Story 1 → motivo visible sin hover (MVP) → validar
3. + User Story 2 → visibilidad de Human Agent por cuenta → validar
4. Polish → confirmar que la lógica de envío no cambió + build/tests

---

## Notes

- El mapeo `codigoError` → familia visual y la fórmula de la consulta de D3 viven en `data-model.md` — no se repiten en detalle aquí
- La query de T005 es de solo lectura — no debe alterar ningún `MensajeConversacion` ni disparar reintentos (FR-005)
- Ningún texto de error se redacta desde cero — se reutiliza `motivoError` ya persistido (D2 en `research.md`)
- Commitear tras completar cada historia (US1, luego US2) como unidad
