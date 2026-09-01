---

description: "Task list template for feature implementation"
---

# Tasks: Registrar en Karia los mensajes enviados desde la app nativa del canal

**Input**: Design documents from `/specs/020-fix-mensajes-app-nativa/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Se incluyen tareas de test unitario (Vitest) para la lógica pura y determinística señalada en `research.md`/`quickstart.md` — exigido por la Constitución V ("tests proporcionales al riesgo"). No se automatiza el webhook real de Meta ni una sesión real de Baileys (no hay entorno accesible en CI); esos casos quedan como validación manual (`quickstart.md`).

**Organization**: Tasks agrupadas por historia de usuario (US1 = Instagram/Messenger, US2 = WhatsApp), con una fase Foundational compartida porque ambos canales alimentan el mismo comando/suscriptor/server-action nuevo (ver plan.md, "Structure Decision").

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: A qué historia de usuario pertenece (US1, US2)
- Cada tarea incluye la ruta de archivo exacta

## Path Conventions

Proyecto único (Next.js App Router) — rutas bajo `src/` y `prisma/` en la raíz del repo, según `plan.md`.

---

## Phase 1: Setup

**Purpose**: Cambio de esquema que todo lo demás necesita.

- [X] T001 Agregar el valor `AGENTE_CANAL_NATIVO` al enum `RemitenteMsg` en `prisma/schema.prisma` (junto a `CONTACTO`, `AGENTE`, `SISTEMA`, `BOT` — ver data-model.md) y generar+aplicar la migración (`npm run db:migrate`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura de comando/cola/suscriptor/acción compartida por Instagram, Facebook Messenger y WhatsApp (ver data-model.md, "Nuevo comando asíncrono"). Ningún trabajo de US1/US2 puede empezar sin esto.

**⚠️ CRITICAL**: Completar toda la fase antes de tocar cualquier tarea de US1 o US2.

- [X] T002 Agregar `ProcesarMensajeAppNativa: "PROCESAR_MENSAJE_APP_NATIVA"` a `ComandosSistema` en `src/eventos/catalogo.ts`
- [X] T003 [P] Agregar `PROCESAR_MENSAJE_APP_NATIVA: "PROCESAR_MENSAJE_APP_NATIVA"` a `TIPOS_COMANDO` en `src/shared/eventos/registro.ts` (re-export de compatibilidad, mismo patrón que las entradas existentes)
- [X] T004 [P] Agregar `QUEUES.MENSAJE_APP_NATIVA = "crm.comando.mensaje.app-nativa"`, `RK.COMANDO_MENSAJE_APP_NATIVA = "comando.mensaje.app-nativa"` y la entrada `PROCESAR_MENSAJE_APP_NATIVA: RK.COMANDO_MENSAJE_APP_NATIVA` en `TIPO_EVENTO_A_RK`, en `src/shared/rabbitmq/exchanges.ts`
- [X] T005 [P] Crear `src/eventos/contratos/procesar-mensaje-app-nativa.comando.ts` re-exportando `ComandoProcesarEntrantePayload` de `./procesar-entrante.comando` como `ComandoProcesarMensajeAppNativaPayload` (mismo shape — sin DTO duplicado, ver research.md R6)
- [X] T006 Refactorizar `src/conversaciones/actions.ts`: extraer los pasos 1-4 de `procesarMensajeEntrante` (resolver/crear `Contacto`, resolver/crear/reabrir `Conversacion`, incluida la actualización de nombre/avatar/handle) a una función privada compartida `resolverContactoYConversacion(payload)`, y hacer que `procesarMensajeEntrante` la use sin cambiar su comportamiento observable (FR-007)
- [X] T007 [US-shared] Implementar `registrarMensajeAppNativa(payload)` en `src/conversaciones/actions.ts`: usa `resolverContactoYConversacion` (T006), verifica dedup por `idExterno` antes y después de resolver (mismo patrón de doble verificación que `procesarMensajeEntrante`), inserta `MensajeConversacion` con `remitente: "AGENTE_CANAL_NATIVO"`, `estado: "ENTREGADO"`, `enviadoEn: new Date()`; publica `EventosSistema.MensajeEnviado` (NO `MensajeRecibido`); NO crea/actualiza `Oportunidad` (ver research.md R3, R8; data-model.md reglas 1-4) — depende de T006
- [X] T008 Crear `src/suscriptores/mensajes/procesar-mensaje-app-nativa.suscriptor.ts`: `ProcesarMensajeAppNativaSuscriptor extends ConsumidorBase<ComandoProcesarMensajeAppNativaPayload>`, `queue = QUEUES.MENSAJE_APP_NATIVA`, `routingKeys = [RK.COMANDO_MENSAJE_APP_NATIVA]`, `manejar()` llama a `registrarMensajeAppNativa` (mismo patrón que `procesar-entrante.suscriptor.ts`) — depende de T004, T005, T007
- [X] T009 Registrar `new ProcesarMensajeAppNativaSuscriptor()` en el arreglo `suscriptores` de `src/suscriptores/registrar.ts` — depende de T008
- [X] T010 [P] Actualizar `src/conversaciones/components/burbuja-mensaje.tsx`: incluir `"AGENTE_CANAL_NATIVO"` junto a `"AGENTE"` y `"SISTEMA"` en `esPropioONota` (línea ~187, alineación a la derecha) y agregar una etiqueta corta bajo la burbuja cuando `remitente === "AGENTE_CANAL_NATIVO"` indicando que se envió desde la app nativa del canal (FR-004/SC-003, ver data-model.md "UI — distinción visual")

**Checkpoint**: Comando, cola, suscriptor, server action y UI base listos — US1 y US2 pueden implementarse en paralelo a partir de acá.

---

## Phase 3: User Story 1 - Mensaje nativo de Instagram/Messenger queda registrado (Priority: P1) 🎯 MVP

**Goal**: Un mensaje enviado desde la app nativa de Instagram o Facebook Messenger (no desde Karia) queda registrado en el historial de la conversación, distinguible y sin duplicar el eco de mensajes que Karia sí envió.

**Independent Test**: Con la integración de Instagram (o Messenger) activa y una conversación existente, responder al cliente desde la app nativa (no desde Karia) y confirmar que el mensaje aparece en el historial de Karia, en orden cronológico, distinguible de un mensaje enviado por un agente desde Karia — ver quickstart.md Escenarios 1-3.

### Tests for User Story 1

- [X] T011 [P] [US1] Test unitario en `src/conversaciones/providers/instagram.test.ts` (nuevo): `mapearEntrante` con `message.is_echo = true` debe usar `event.recipient.id` como `identificadorContacto`, no `event.sender.id` (ver research.md R4); agregar también un caso `is_echo` ausente/false que siga usando `sender.id` (comportamiento actual, sin regresión)
- [X] T012 [P] [US1] Test unitario en `src/conversaciones/providers/facebook-messenger.test.ts` (extender el archivo existente): mismo caso que T011 para `FacebookMessengerProvider.mapearEntrante`

### Implementation for User Story 1

- [X] T013 [US1] En `src/conversaciones/providers/instagram.ts`, `mapearEntrante`: cuando `message?.is_echo === true`, usar `event.recipient.id` como `identificadorContacto` en el objeto devuelto; en caso contrario mantener `event.sender.id` (comportamiento actual sin cambios) — hace pasar T011
- [X] T014 [US1] Mismo cambio que T013 en `src/conversaciones/providers/facebook-messenger.ts`, `mapearEntrante` — hace pasar T012
- [X] T015 [US1] En `src/app/api/webhooks/instagram/route.ts`, reemplazar la línea `if (event.message?.is_echo || event.read) continue;` (línea ~309) por: `if (event.read) continue;` (sin cambios) seguido de la resolución existente de `cuentaCanal`/`canalResuelto`/reacciones/`mid` sin alterar ese orden, y luego: si `event.message?.is_echo`, verificar `mid` contra `MensajeConversacion.idExterno` — si existe, `continue` (ya lo registró Karia, sin cambios respecto a hoy); si no existe, mapear el evento con `provider.mapearEntrante` (ahora corregido por T013/T014), descargar/almacenar adjuntos igual que el flujo entrante existente, y publicar `TIPOS_COMANDO.PROCESAR_MENSAJE_APP_NATIVA` (no `PROCESAR_ENTRANTE`) con el payload normalizado — depende de T013, T014, y de la infraestructura de Phase 2 (T002-T009)
- [ ] T016 [US1] Validación manual: ejecutar los Escenarios 1, 2 y 3 de `quickstart.md` (Instagram, Facebook Messenger, no-duplicado del eco de un mensaje enviado desde Karia) contra un entorno con webhook de Meta accesible (ngrok o túnel equivalente) — confirmar además que no se dispara una respuesta de IA para el mensaje registrado por esta vía

**Checkpoint**: User Story 1 funcional y validable de forma independiente (Instagram + Facebook Messenger).

---

## Phase 4: User Story 2 - Mensaje nativo de WhatsApp queda registrado (Priority: P1)

**Goal**: Un mensaje enviado desde la app o WhatsApp Web del número vinculado (no desde Karia) queda registrado en el historial de la conversación, en los dos puntos de código donde hoy se descarta (`reconectar.ts` y `sesion/route.ts`).

**Independent Test**: Con una sesión de WhatsApp vinculada y una conversación existente, responder al cliente desde la app/WhatsApp Web de ese número y confirmar que el mensaje aparece en el historial de Karia — ver quickstart.md Escenarios 4-5, validando ambos puntos de código (FR-006).

### Tests for User Story 2

- [X] T017 [P] [US2] Test unitario en `src/integraciones/whatsapp-lite/encolar-mensaje.test.ts` (nuevo): el helper de extracción de contenido/media compartido (T018) NO debe incluir `pushName` en el payload cuando se invoca para un mensaje `fromMe` (ver research.md R5); el mismo helper invocado para un mensaje entrante normal SÍ debe seguir incluyendo `pushName` (sin regresión sobre `encolarMensajeEntrante`)

### Implementation for User Story 2

- [X] T018 [US2] Refactorizar `src/integraciones/whatsapp-lite/encolar-mensaje.ts`: extraer la lógica de extracción de contenido/tipo/adjuntos/descarga de media (líneas ~20-154, todo lo que no sea publicar el comando) a una función compartida reutilizable por `encolarMensajeEntrante` (sin cambios de comportamiento) y por una nueva `encolarMensajeAppNativaWA(msg, cuentaCanalId, instanciaId)` que: deriva `identificadorContacto` igual que hoy (a partir de `msg.key.remoteJid`, sin swap — ver research.md R4/R5), reutiliza la extracción de contenido/media, **omite `pushName`** (research.md R5), conserva `avatarUrl` vía `profilePictureUrl`, y publica `TIPOS_COMANDO.PROCESAR_MENSAJE_APP_NATIVA` en vez de `PROCESAR_ENTRANTE` — hace pasar T017
- [X] T019 [US2] En `src/integraciones/whatsapp-lite/reconectar.ts` (línea ~135), reemplazar `if (msg.key.fromMe) continue;` por: verificar `msg.key.id` contra `MensajeConversacion.idExterno` — si existe, `continue` (ya lo registró Karia); si no existe, llamar a `encolarMensajeAppNativaWA(msg, cuentaCanalId, instanciaId)` (T018) — depende de T018
- [X] T020 [US2] Mismo cambio que T019 en `src/app/api/integraciones/whatsapp-lite/sesion/route.ts` (línea ~180) — cumple FR-006 (ambos puntos de código deben ajustarse, no solo uno) — depende de T018
- [ ] T021 [US2] Validación manual: ejecutar los Escenarios 4 y 5 de `quickstart.md` — un mensaje nativo justo tras vincular sesión (`sesion/route.ts`) y otro tras una reconexión del servidor (`reconectar.ts`) — confirmando que ambos puntos de código quedan corregidos

**Checkpoint**: User Story 2 funcional y validable de forma independiente; US1 y US2 funcionan en simultáneo sin interferirse (comparten la infraestructura de Phase 2 pero no archivos entre sí).

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Confirmar que no se rompió nada existente y cerrar los edge cases del spec que no quedaron cubiertos por una historia específica.

- [ ] T022 Validación manual de los edge cases restantes de `quickstart.md`: contacto completamente nuevo iniciado desde la app nativa (se crea conversación, **no** se crea `Oportunidad` — ver research.md R8) y reacciones/recibos de lectura enviados desde la app nativa (deben seguir procesándose exactamente igual que hoy, sin pasar por el nuevo flujo)
- [X] T023 Ejecutar `npm run build` y la suite de Vitest (`npx vitest run`) para confirmar que no hay regresiones de tipos ni de los tests existentes de `instagram.ts`/`facebook-messenger.ts`/`whatsapp-lite` antes de dar la feature por completa

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — empezar de inmediato
- **Foundational (Phase 2)**: depende de Phase 1 (T001) — BLOQUEA Phase 3 y Phase 4 completas
- **User Story 1 (Phase 3)** y **User Story 2 (Phase 4)**: ambas dependen de Phase 2 completa; entre sí son independientes (tocan archivos distintos) y pueden avanzar en paralelo
- **Polish (Phase 5)**: depende de que Phase 3 y Phase 4 estén completas

### Dentro de cada historia

- Tests (T011/T012, T017) antes que la implementación que hacen pasar (T013-T015, T018)
- Cambio en los providers (T013, T014) antes que el cambio en el webhook que los consume (T015)
- Helper compartido de WhatsApp (T018) antes que los dos call sites que lo usan (T019, T020)

### Parallel Opportunities

- T003, T004, T005 (Phase 2) en paralelo entre sí — archivos distintos, sin dependencia mutua
- T010 (UI) en paralelo con T006/T007/T008/T009 — archivo distinto, sin dependencia
- T011 y T012 (tests US1) en paralelo entre sí
- Una vez cerrada Phase 2: toda la Phase 3 (US1) en paralelo con toda la Phase 4 (US2) si hay más de una persona disponible

---

## Parallel Example: cierre de Phase 2

```bash
# En paralelo, una vez aplicada la migración de T001:
Task: "Agregar TIPOS_COMANDO.PROCESAR_MENSAJE_APP_NATIVA en src/shared/eventos/registro.ts"        # T003
Task: "Agregar QUEUES/RK/TIPO_EVENTO_A_RK en src/shared/rabbitmq/exchanges.ts"                      # T004
Task: "Crear src/eventos/contratos/procesar-mensaje-app-nativa.comando.ts"                          # T005
```

## Parallel Example: User Story 1 vs User Story 2

```bash
# Una vez cerrado el Checkpoint de Phase 2, en paralelo:
Task: "Implementar Phase 3 completa (Instagram/Messenger) — T011 a T016"
Task: "Implementar Phase 4 completa (WhatsApp) — T017 a T021"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Completar Phase 1 (T001) y Phase 2 (T002-T010)
2. Completar Phase 3 (US1 — Instagram/Messenger)
3. **Detener y validar**: correr Escenarios 1-3 de quickstart.md
4. Esto ya resuelve el síntoma reportado para dos de los tres canales

### Entrega incremental

1. Setup + Foundational → infraestructura lista
2. US1 (Instagram/Messenger) → validar independientemente → ya es un fix desplegable
3. US2 (WhatsApp) → validar independientemente → cierra el tercer canal (FR-005: los tres canales deben quedar consistentes)
4. Polish → confirma que no se rompió nada y cierra los edge cases transversales

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes
- [Story] mapea cada tarea a US1/US2 para trazabilidad; Phase 2 no lleva label porque es compartida por ambas
- Verificar que los tests (T011, T012, T017) fallan antes de implementar los cambios correspondientes (T013/T014, T018)
- Commitear después de cada tarea o grupo lógico
- No mezclar en un mismo commit el refactor de `procesarMensajeEntrante` (T006, que no debe cambiar comportamiento — FR-007) con la nueva funcionalidad (T007) — facilita revertir si el refactor introdujera una regresión no relacionada
