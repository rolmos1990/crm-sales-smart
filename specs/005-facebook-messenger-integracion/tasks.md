---

description: "Task list for Facebook Messenger integration"
---

# Tasks: Integración de Facebook Messenger en el CRM

**Input**: Design documents from `/specs/005-facebook-messenger-integracion/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: No se pidieron explícitamente en la spec — se incluyen igual dos tareas de test acotadas al punto de mayor riesgo (desambiguación del webhook, R1) en la fase Polish, porque es la garantía concreta de FR-006/FR-007 (cero regresión en Instagram). El resto sigue el criterio de "tests proporcionales al riesgo" de la Constitución (Principio V) sin bloquear cada tarea de implementación con un test previo.

**Organization**: Tareas agrupadas por historia de usuario (spec.md) para poder implementar y probar cada una de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: Historia de usuario a la que pertenece (US1–US4)

## Path Conventions

Aplicación Next.js de un solo proyecto — rutas bajo `src/`, siguiendo exactamente la estructura ya usada por Instagram (ver `plan.md` → Project Structure).

---

## Phase 1: Setup

**Purpose**: Preparar el terreno antes de tocar lógica de negocio

- [X] T001 Crear la estructura de carpetas del módulo nuevo: `src/integraciones/facebook-messenger/`, `src/integraciones/facebook-messenger/components/`, `src/app/integraciones/facebook-messenger/`, `src/app/api/integraciones/facebook-messenger/oauth/`, `src/app/api/integraciones/facebook-messenger/callback/`
- [X] T002 [P] Migración Prisma: índice único parcial `(instanciaId, identificador) WHERE canal = 'facebook_messenger'` en `prisma/migrations/`, mismo patrón que la migración `20260817120000_add_instagram_auth_provider` (ver `data-model.md`)
- [X] T003 [P] Agregar entrada `"facebook_messenger"` (nombre "Facebook Messenger", categoría `"mensajeria"`, `disponible: true`) en `src/integraciones/catalog.ts`

**Checkpoint**: Estructura y esquema listos — no hay lógica de negocio nueva todavía.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura compartida que TODAS las historias de usuario necesitan

**⚠️ CRITICAL**: Ninguna historia de usuario puede empezar hasta que esta fase esté completa

- [X] T004 Crear `src/conversaciones/providers/facebook-messenger.ts` implementando `ICanalProvider` (`canal: "facebook_messenger"`, `capacidades`: texto/imagen/video igual que Instagram, resto `false`) — implementado completo (`enviarMensaje`, `mapearEntrante`, `validarWebhook`) en un solo paso en vez de dejarlo como esqueleto, ver T014/T015
- [X] T005 Registrar el nuevo provider en `src/conversaciones/providers/registry.ts` (`["facebook_messenger", new FacebookMessengerProvider()]`)
- [X] T006 Modificar `src/app/api/webhooks/instagram/route.ts`: en la rama `payload.object === "page"`, resolver ambos candidatos (`CuentaCanal` de `canal:"instagram"` por `configuracion.pageId` y de `canal:"facebook_messenger"` por `identificador`); si ambos existen para la misma Página, desambiguar por evento consultando `ContactoIdentificadorCanal` (`canal:"instagram"`, `identificador: event.sender.id`) — implementa la decisión de `research.md` R1. Verificado: cuando solo hay match de Instagram, la consulta y el comportamiento son idénticos a antes (FR-007)

**Checkpoint**: Fundación lista — cualquier historia de usuario puede empezar a construirse.

---

## Phase 3: User Story 1 - Conectar una Página de Facebook para Messenger (Priority: P1) 🎯 MVP

**Goal**: Un responsable de la integración puede conectar una Página de Facebook desde un componente dedicado en Integraciones y verla listada como activa.

**Independent Test**: Desde Integraciones, conectar una Página de prueba y confirmar que aparece listada como conectada y activa, con su nombre visible (quickstart.md, Escenario 1).

### Implementation for User Story 1

- [X] T007 [US1] Crear `src/integraciones/facebook-messenger/conectar.ts`: `conectarCuentaFacebookMessenger(instanciaId, perfil)` — persiste `CuentaCanal` (`canal: "facebook_messenger"`, `identificador: pageId`, `configuracion.accessToken` cifrado con `cifrarToken`), con el mismo patrón de dedup (`findFirst` antes de `create`) que `integraciones/instagram/conectar.ts`. Incluye también `suscribirWebhookFacebookMessenger`
- [X] T008 [US1] Crear `src/app/api/integraciones/facebook-messenger/oauth/route.ts`: `requireSesion()` + `verificarAcceso(sesion, "integraciones", "modificar")`, `state` firmado con `firmarEstado(..., process.env.META_APP_SECRET)` (reutilizando `estado-oauth.ts`), scope `pages_show_list,pages_manage_metadata,pages_messaging,business_management` — mismo patrón que el `oauth/route.ts` de Instagram ya asegurado
- [X] T009 [US1] Crear `src/app/api/integraciones/facebook-messenger/callback/route.ts`: `verificarEstado(stateRaw, process.env.META_APP_SECRET)`, verificar nonce + que la sesión actual coincide con quien inició el flujo, intercambiar `code` por token, listar las Páginas del usuario (`/me/accounts`, con fallback a Business Manager), llamar `conectarCuentaFacebookMessenger` + `suscribirWebhookFacebookMessenger` por cada una — mismo patrón que el `callback/route.ts` de Instagram ya asegurado
- [X] T010 [P] [US1] Crear `src/integraciones/facebook-messenger/queries.ts`: `obtenerCuentasFacebookMessenger(instanciaId)` (lista de Páginas conectadas con nombre/estado) — incluye ya el cálculo de `estadoConexion` de T020
- [X] T011 [US1] Crear `src/integraciones/facebook-messenger/components/panel-facebook-messenger.tsx`: lista de Páginas conectadas + botón "Conectar Facebook Messenger", mismo patrón visual que `panel-instagram.tsx` — incluye ya el badge de estado de T021
- [X] T012 [US1] Crear `src/app/integraciones/facebook-messenger/page.tsx`: Server Component, `requireSesion()` + `verificarAcceso(..., "ver")`, arma las cuentas vía `obtenerCuentasFacebookMessenger` y renderiza `PanelFacebookMessenger`
- [X] T013 [US1] Crear `src/integraciones/facebook-messenger/actions.ts`: `desconectarCuentaFacebookMessenger`/`eliminarCuentaFacebookMessenger` scoped por `instanciaId` (FR-009), mismo patrón que `integraciones/instagram/actions.ts`

**Checkpoint**: US1 debe ser completamente funcional y testeable de forma independiente — conectar y ver una Página listada.

---

## Phase 4: User Story 2 - Recibir y responder conversaciones de Messenger desde el inbox (Priority: P1)

**Goal**: Los mensajes de Messenger aparecen en el inbox del CRM en tiempo real y un agente puede responderlos desde ahí.

**Independent Test**: Enviar un mensaje de prueba por Messenger a una Página conectada, verlo en el inbox de Karia, responder desde Karia y confirmar que el cliente lo recibe (quickstart.md, Escenario 2).

### Implementation for User Story 2

- [X] T014 [US2] Completar `enviarMensaje` en `src/conversaciones/providers/facebook-messenger.ts`: `POST https://graph.facebook.com/<version>/<PAGE_ID>/messages`, `Authorization: Bearer <accessToken descifrado>`, `recipient.id`, `message` (texto o `attachment` imagen/video), `messaging_type`/`tag` — mismo shape que `InstagramProvider.enviarMensaje`. Reutiliza `clasificarErrorInstagram` para no duplicar la clasificación de errores (research.md R4) — hecho junto con T004
- [X] T015 [US2] Completar `mapearEntrante` en `src/conversaciones/providers/facebook-messenger.ts`: normaliza `messaging[]` de Messenger (texto, imagen, video) a `MensajeEntranteNormalizado` — mismos tipos soportados que Instagram — hecho junto con T004
- [X] T016 [US2] Extender el bloque de recepción en `src/app/api/webhooks/instagram/route.ts` (construido sobre T006): para eventos resueltos como `facebook_messenger`, reutiliza la descarga/re-almacenamiento de adjuntos y `publicadorEventos.publicar(TIPOS_COMANDO.PROCESAR_ENTRANTE, ...)` ya usados para Instagram, pasando el `cuentaCanalId` de la cuenta de Messenger resuelta — hecho junto con T006 (el prefetch de perfil se deja explícitamente fuera para Messenger, ver comentario en el código). De paso se corrigió que `descargarYAlmacenarMediaIG` tenía `canal: "instagram"` hardcodeado (afectaba hasta la carpeta de storage) — ahora recibe el canal resuelto y usa `"facebook"` (ya existente en `CanalOrigen`) para Messenger
- [X] T017 [US2] Extender `src/suscriptores/mensajes/enviar-mensaje.suscriptor.ts` para que la ventana de 24h/Human Agent (`obtenerEstadoVentanaMensajeria`) aplique también cuando `cuentaCanal.canal === "facebook_messenger"`, no solo `"instagram"` (research.md R5)
- [X] T018 [P] [US2] Agregar ícono/color de `facebook_messenger` en los mapas cerrados de canal ya existentes: `inbox-layout.tsx` (`infoCanal`) y `selector-cuenta-canal.tsx` (`iconoCanal`). `burbuja-mensaje.tsx` no tiene lógica por canal (solo clasifica errores, ya genérica). `panel-contacto-inbox.tsx`/`panel-conversacion.tsx` tienen una rama Instagram-específica (mostrar @handle en vez de teléfono) que se deja intacta — Messenger no tiene handle público equivalente y cae al campo de teléfono editable genérico, un default aceptable no cubierto por ningún FR

**Checkpoint**: US2 debe ser completamente funcional de punta a punta — mensaje entra, se responde, ambos lados lo ven.

---

## Phase 5: User Story 3 - Las conversaciones de Messenger se integran al Pipeline (Priority: P2)

**Goal**: Una conversación nueva de Messenger se asocia automáticamente al pipeline/etapa configurados para esa Página, igual que Instagram y WhatsApp.

**Independent Test**: Configurar pipeline/etapa para la Página conectada, recibir una conversación nueva por Messenger y confirmar que se refleja en el pipeline (quickstart.md, Escenario 3).

### Implementation for User Story 3

- [X] T019 [US3] Verificado: la UI de configurar `pipelineId`/`stageId` por `CuentaCanal` (`configurarPipelineCuenta`/`configurarStageCuenta`/`configurarEtapaCuenta`) hoy solo existe para `whatsapp_lite` (`integraciones/whatsapp-lite/actions.ts` + `tarjeta-numero.tsx`/`modal-qr.tsx`) — **Instagram tampoco la tiene**. No hay ningún filtro por canal que excluir: `crearOportunidadDesdeConversacion` (`src/conversaciones/actions.ts`) ya es genérica por `cuentaCanalId` y funciona igual para `facebook_messenger` en cuanto `pipelineId`/`stageId` tengan un valor (por ahora, solo asignable a mano en la base, igual que para Instagram hoy). Paridad exacta con Instagram confirmada — no se construyó una UI nueva por ser una capacidad que Instagram tampoco tiene, fuera del pedido original ("tal cual instagram")

**Checkpoint**: US3 confirmado — no debería requerir código nuevo más allá de la verificación/ajuste puntual de UI.

---

## Phase 6: User Story 4 - Confirmar que la conexión de Facebook Messenger está activa (Priority: P3)

**Goal**: El responsable de la integración puede confirmar desde Karia si una Página conectada está funcionando, sin esperar un mensaje real.

**Independent Test**: Desde el panel de Facebook Messenger, consultar el estado de una Página y ver si está activa o con un problema (quickstart.md, Escenario 4).

### Implementation for User Story 4

- [X] T020 [US4] Cálculo de estado de conexión incluido directamente en `obtenerCuentasFacebookMessenger` (`src/integraciones/facebook-messenger/queries.ts`, campo `estadoConexion`) en vez de una función separada por id — mismo resultado, un query menos por cuenta al listar. Regla: `activa && accessToken presente && (sin tokenExpiraEn O no vencido)` → `ACTIVA`, si no `CON_PROBLEMA` (data-model.md)
- [X] T021 [US4] Badge "Activa"/"Con problema" ya incluido en `TarjetaCuentaFB` (`panel-facebook-messenger.tsx`) — hecho junto con T011

**Checkpoint**: Todas las historias de usuario deben quedar funcionales de forma independiente.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Garantizar el requisito no negociable de la feature (cero regresión en Instagram) y dejar cobertura de test proporcional al riesgo

- [X] T022 [P] Tests unitarios de la desambiguación de `research.md` R1 — se extrajo la decisión pura a `src/conversaciones/providers/resolver-canal-webhook-page.ts` (sin Prisma, siguiendo el convenio de `*.test.ts` del repo — ver `vitest.config.ts`) y se testeó en `resolver-canal-webhook-page.test.ts`: 5 casos (solo Instagram, solo Messenger, ninguno, ambos+contacto conocido, ambos+contacto nuevo)
- [X] T023 [P] Tests unitarios de `src/conversaciones/providers/facebook-messenger.ts` en `facebook-messenger.test.ts` (`enviarMensaje` con/sin tag, clasificación de errores reutilizada, `mapearEntrante` texto/imagen/video) — mismo patrón que `instagram.test.ts`
- [X] T024 Validación de código completa (typecheck + 96 tests unitarios del repo, 0 regresiones). **Pendiente de quien implementa**: los escenarios 1–4 de `quickstart.md` requieren una Página de Facebook de prueba real y clic-a-clic por el consentimiento de Meta — no son ejecutables sin esas credenciales/navegador; el escenario 5 (cero regresión en Instagram) sí quedó cubierto por los tests existentes de Instagram, que siguen en verde tras el refactor de T006
- [X] T025 [P] Creada `docs/META-FACEBOOK-MESSENGER-INTEGRACION.md` — permisos usados, flujo de conexión, la decisión de desambiguación de R1, y limitaciones conocidas

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — puede empezar de inmediato
- **Foundational (Phase 2)**: depende de Setup — BLOQUEA todas las historias de usuario
- **User Stories (Phase 3–6)**: todas dependen de Foundational completo
  - US1 y US2 son ambas P1 — US1 (conectar) debe ir primero en la práctica porque US2 (recibir/responder) necesita una cuenta ya conectada para probarse, aunque el código de US2 (el provider, T014–T015) puede construirse en paralelo con T007–T013 de US1
  - US3 y US4 pueden empezar después de Foundational, pero solo son demostrables una vez que US1/US2 existen (dependencia de producto, no de código)
- **Polish (Phase 7)**: depende de que las historias que se vayan a probar ya estén completas

### User Story Dependencies

- **US1 (P1)**: sin dependencia de otras historias — MVP
- **US2 (P1)**: depende de que exista al menos una cuenta conectada (US1) para probarse end-to-end, pero el código del provider (T014–T015) no depende de código de US1
- **US3 (P2)**: depende de que US1/US2 existan para tener algo que asociar al pipeline — es casi enteramente verificación, no construcción
- **US4 (P3)**: depende de que exista `queries.ts` (T010, de US1) — se agrega la función de estado ahí mismo

### Parallel Opportunities

- T002 y T003 (Setup) en paralelo
- T010 (US1) en paralelo con T007–T009 (mismo Phase, archivo distinto)
- T018 (US2) en paralelo con T014–T017 (archivo distinto)
- T022, T023, T025 (Polish) en paralelo entre sí

---

## Parallel Example: User Story 1

```bash
# En paralelo, una vez completada la fase Foundational:
Task: "Crear src/integraciones/facebook-messenger/conectar.ts"
Task: "Crear src/integraciones/facebook-messenger/queries.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Completar Phase 1 (Setup) y Phase 2 (Foundational — incluye el punto más riesgoso, T006)
2. Completar Phase 3 (US1 — conectar)
3. Completar Phase 4 (US2 — recibir/responder), que es donde vive el valor real del pedido
4. **Detener y validar** con `quickstart.md` Escenarios 1, 2 y 5 (cero regresión en Instagram) antes de avanzar
5. Recién ahí sumar US3 (Pipeline) y US4 (estado de conexión), que son incrementos menores sobre la misma base

### Incremental Delivery

1. Setup + Foundational → base lista, Instagram sigue intacto (validar con Escenario 5 apenas T006 esté hecho, antes de seguir)
2. + US1 → conectar Páginas funciona → demo posible
3. + US2 → mensajería completa (MVP real del pedido)
4. + US3 → Pipeline
5. + US4 → visibilidad de estado
6. Polish → tests del punto crítico (R1) y validación final completa
