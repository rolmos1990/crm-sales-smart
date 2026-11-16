---

description: "Tareas de implementación — Canal de correo electrónico"
---

# Tasks: Canal de correo electrónico

**Input**: Documentos de diseño en `/specs/034-canal-correo-electronico/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: SÍ se incluyen. No es una preferencia de estilo: el principio V de la constitución los exige
proporcionales al riesgo, y esta feature toca cuatro funciones compartidas por **todos** los canales
(`resolverContactoYConversacion`, `enviarMensajeInterno`, el orquestador de IA y el motor de Workflows).
SC-011 exige demostrar cero regresiones, y eso solo se demuestra con tests.

**Organization**: por historia de usuario. Cada historia es una entrega independiente con su checkpoint.

## Format: `[ID] [P?] [Story] Descripción`

- **[P]**: puede ejecutarse en paralelo (archivo distinto, sin dependencia con tareas incompletas)
- **[Story]**: a qué historia pertenece (US1, US2, US3, US4)

---

## Phase 1: Setup

**Purpose**: dependencias y estructura. Nada visible todavía.

- [X] T001 Instalar las dependencias del canal en `package.json`: `imapflow@^2.12`, `mailparser@^3.14`, `nodemailer@^10.6`, `email-reply-parser@^3.0` — las cuatro traen sus propios tipos, **no** instalar paquetes `@types/*` para ellas (ver research.md R1)
- [X] T002 Crear el árbol de carpetas del módulo en `src/integraciones/email/` (`imap/`, `mensaje/`, `aprobacion/`, `components/`) según la estructura de plan.md
- [X] T003 [P] Documentar en `README.md` (sección Variables de entorno) que `TOKENS_CIFRADO_KEY` debe existir **también en el worker**, y que el worker necesita salida de red a los puertos 993/143 y 465/587 (research.md R13 y R14)

---

## Phase 2: Foundational (prerequisito bloqueante de todas las historias)

**⚠️ CRÍTICO**: ninguna historia puede empezar hasta que esta fase esté completa.

### Red de seguridad antes de tocar código compartido

- [X] T004 Escribir en `src/conversaciones/actions.conversacion-por-canal.test.ts` los tests que **fijan el comportamiento actual** de `resolverContactoYConversacion` para WhatsApp, Instagram y Messenger: un contacto con conversación abierta reutiliza esa conversación aunque cambie el `cuentaCanalId` (caso de re-escaneo de QR), una conversación `EN_ESPERA`/`CERRADA` se reabre, y el match por teléfono sigue aplicando solo a canales `whatsapp*`. **Deben pasar contra el código sin modificar** — esta es la línea base de SC-011

### Modelo de datos

- [X] T005 Agregar en `prisma/schema.prisma` el modelo `BuzonCorreoEstado` y las columnas nuevas: `ContactoIdentificadorCanal.aprobadoEn` + `aprobadoPorId`, `Conversacion.bloqueadaPorAprobacion` + `hiloExterno`, `Oportunidad.aprobacionPendiente`, con los índices de data-model.md §3
- [~] T006 **Parcial — falta aplicarla.** La migración quedó escrita y revisada en `prisma/migrations/20261116000000_canal_correo_electronico/migration.sql`, generada con `prisma migrate diff` (sin tocar la base) y verificada: cero `DROP`, solo `ADD COLUMN`/`CREATE`. **No se aplicó**: `DATABASE_URL` apunta a una base de Supabase en la nube y aplicar un cambio de esquema ahí es una acción difícil de revertir que corresponde confirmar primero. Pendiente: `npm run db:migrate` **revisando el diff antes de aceptarlo**: no debe eliminar los índices únicos parciales existentes de `instagram` ni de `facebook_messenger` sobre `CuentaCanal` (el propio modelo deja esa advertencia escrita)
- [X] T007 Agregar a mano en el SQL de esa migración el índice único parcial de correo `CuentaCanal_instanciaId_identificador_email_key ... WHERE "canal" = 'email'`, con la consulta de verificación de duplicados previos de data-model.md §4

### Núcleo del módulo

- [X] T008 [P] Implementar `src/integraciones/email/configuracion.ts`: tipos `ConfiguracionBuzonAlmacenada` y `BuzonParaCliente`, y las funciones de cifrado/descifrado de credenciales apoyadas en `cifrarToken`/`descifrarToken` de `src/shared/lib/cifrado-tokens.ts` (contracts/configuracion-buzon.md)
- [X] T009 [P] Implementar `src/integraciones/email/errores.ts` con `CodigoErrorCorreo` y la traducción de fallos de conexión y de envío a códigos funcionales, sin dejar pasar texto crudo del servidor (research.md R12)
- [X] T010 [P] Implementar `src/integraciones/email/schema.ts` con `SchemaBuzonCorreo` y los esquemas de prueba de conexión y de aprobación, incluido el `superRefine` que exige contraseña al crear y la deja opcional al editar (contracts/configuracion-buzon.md §3)
- [X] T011 [P] Agregar la entrada `"email"` — "Correo electrónico", categoría `mensajeria` — en `src/integraciones/catalog.ts`, con `disponible: true`
- [X] T012 [P] Escribir `src/integraciones/email/configuracion.test.ts`: la configuración guardada cifra ambas contraseñas y `BuzonParaCliente` nunca contiene un valor `enc:v1:` ni la contraseña en claro

**Checkpoint**: la migración está aplicada, el módulo compila, el catálogo muestra la tarjeta y los tests de línea base de T004 pasan.

---

## Phase 3: User Story 1 — Registrar el buzón y recibir correos (P1) 🎯 MVP

**Goal**: el negocio registra su buzón con validación de conexión y cada correo entrante aparece en el
Inbox con su contacto y su oportunidad en la etapa configurada.

**Independent Test**: registrar un buzón de prueba, escribirle desde una dirección externa y verificar en el
Inbox que aparece la conversación con el contenido correcto y una oportunidad en la etapa configurada.

### Conexión y validación

- [X] T013 [US1] Implementar `src/integraciones/email/imap/cliente.ts`: envoltorio de `ImapFlow` con timeout de 15 s, cierre garantizado y traducción de errores vía `errores.ts`. Ningún tipo de `imapflow` sale de este archivo (principio IV)
- [X] T014 [US1] Implementar `src/integraciones/email/conectar.ts`: `probarConexionImap` (conectar, autenticar, abrir `INBOX`) y `probarConexionSmtp` (`verify()` de nodemailer), cada una devolviendo `{ ok, codigo?, mensaje? }` por separado (FR-003, FR-005)
- [X] T015 [P] [US1] Escribir `src/integraciones/email/conectar.test.ts`: cada error típico (credenciales, host inexistente, puerto/seguridad incompatible, timeout) se traduce a su `CodigoErrorCorreo` y **nunca** devuelve el texto crudo del servidor (SC-002)

### Server Actions y lectura del buzón

- [X] T016 [US1] Implementar `src/integraciones/email/actions.ts` con `probarConexionBuzon`, `registrarBuzon`, `actualizarBuzon`, `cambiarEstadoBuzon` y `eliminarBuzon`, validando con Zod y resolviendo `instanciaId` desde la sesión; `registrarBuzon` **rechaza** si la prueba de conexión no pasó (FR-004) y crea el `BuzonCorreoEstado` asociado
- [X] T017 [US1] Implementar `src/integraciones/email/queries.ts` → `obtenerBuzones(instanciaId)` devolviendo `BuzonParaCliente`, **sin seleccionar jamás** las credenciales cifradas (FR-011, FR-042)
- [X] T018 [US1] Implementar `src/integraciones/email/imap/marca-lectura.ts`: anclar `uidValidity`/`ultimoUid` al UID más alto al activar el buzón (FR-023), leer y avanzar la marca, y re-anclar sin reimportar si `uidValidity` cambió (research.md R3)
- [X] T019 [US1] Implementar `src/integraciones/email/imap/polling.ts` con `iniciarPollingCorreo`, `ejecutarCicloCorreo` y `leerBuzon`: lock de aplicación de PostgreSQL por buzón antes de leer, procesamiento en orden de UID, y persistencia de la marca **después** de encolar los correos (contracts/server-actions.md §4)
- [X] T020 [US1] Registrar el arranque del ciclo de correo en `src/worker/disparadores.ts`, junto a `reconectarSesionesWA`, como ciclo propio independiente del `while` de 10 s — **solo en el worker** (research.md R14)
- [X] T021 [US1] Registrar en `BuzonCorreoEstado` el resultado de cada ciclo: éxito limpia error y `fallosSeguidos`; el fallo acumula y expone `errorCodigo`/`errorMensaje` ya traducidos (FR-012), sin tumbar el ciclo de los demás buzones

### Higiene y normalización del correo

- [X] T022 [P] [US1] Implementar `src/integraciones/email/mensaje/filtros.ts` con las ocho señales de descarte de research.md R5 (auto-respuestas, boletines, rebotes, bucle con el propio buzón), devolviendo el motivo del descarte
- [X] T023 [P] [US1] **Ajustado durante la implementación**: `mailparser` ya entrega el HTML como texto legible, con las URLs de los enlaces, porque incluye `html-to-text` entre sus dependencias (verificado el 2026-11-16). No se escribe `html-a-texto.ts`. La tarea pasa a ser: no leer nunca `parsed.html` en `normalizar.ts` y dejar asentada la razón en el código (research.md R10, FR-021)
- [X] T024 [P] [US1] Implementar `src/integraciones/email/mensaje/limpiar-cita.ts` con `email-reply-parser` y el respaldo por marcadores; si el recorte deja el texto vacío, devolver el original (research.md R4, FR-022)
- [X] T025 [US1] Implementar `src/integraciones/email/mensaje/normalizar.ts`: `mailparser` → `ComandoProcesarEntrantePayload`, con dirección del remitente en minúsculas y sin nombre visible, `idExterno` = `Message-ID` normalizado (o `sha256(cuentaCanalId:uidValidity:uid)` si falta), `pushName` desde el nombre visible, y recorte del cuerpo a 100 KB marcando el recorte (contracts/provider-email.md §3, FR-015, FR-019, FR-025)
- [X] T026 [US1] Conectar `polling.ts` con `filtros.ts` y `normalizar.ts` y publicar el comando `ProcesarEntrante` ya existente por RabbitMQ — **sin agregar eventos ni comandos nuevos al catálogo** (contracts/provider-email.md §3)
- [X] T027 [P] [US1] Escribir `src/integraciones/email/mensaje/filtros.test.ts` con un caso por señal de descarte, más un correo normal que **no** debe descartarse (SC-006)
- [X] T028 [P] [US1] Escribir `src/integraciones/email/mensaje/limpiar-cita.test.ts` con respuestas reales de Gmail, Outlook y Apple Mail, y el caso "si queda vacío, no recortar"
- [X] T029 [P] [US1] Escribir `src/integraciones/email/mensaje/normalizar.test.ts`: `"Juan Pérez" <JUAN@X.COM>` → `juan@x.com` + `pushName` "Juan Pérez"; correo sin asunto; correo sin cuerpo de texto; correo sin `Message-ID`

### Resolución de contacto y conversación

- [X] T030 [US1] En `src/conversaciones/actions.ts`, agregar el predicado `requiereConversacionPropiaPorCanal(canal)` (hoy `true` solo para `"email"`) y aplicarlo en `resolverContactoYConversacion` para filtrar la búsqueda de conversación por canal de la cuenta. Con el predicado en `false` la consulta debe quedar **idéntica** a la actual (research.md R9, FR-017, FR-018)
- [X] T031 [US1] En la misma función, extender el emparejamiento de contacto existente: para `canal === "email"` buscar por `Contacto.email` antes de crear uno nuevo, y guardar la dirección en `Contacto.email` al crearlo (FR-016)
- [X] T032 [US1] Verificar que los tests de línea base de T004 **siguen pasando sin modificarlos** y agregar los casos nuevos de correo al mismo archivo: dos canales del mismo contacto → dos conversaciones; dos correos del mismo remitente → una sola conversación y una sola oportunidad

### Interfaz

- [X] T033 [US1] Crear `src/app/integraciones/email/page.tsx` (Server Component que carga los buzones con `obtenerBuzones`) y `src/app/integraciones/email/loading.tsx` con skeleton, siguiendo el patrón de `src/app/integraciones/instagram/`
- [X] T034 [US1] Implementar `src/integraciones/email/components/panel-buzones.tsx` y `tarjeta-buzon.tsx`: lista, estado (activo / inactivo / con error y su motivo), y acciones de editar y activar/desactivar
- [X] T035 [US1] Implementar `src/integraciones/email/components/modal-registrar-buzon.tsx` con React Hook Form + Zod: dirección, nombre, datos de entrada y salida, puertos sugeridos por tipo de seguridad, selección de pipeline y etapa, y botón **Probar conexión** que informa entrada y salida por separado. El `<Select>` de seguridad y los de pipeline/etapa deben recibir la prop `items` (ver `docs/selects.md`)
- [X] T036 [US1] Verificar en el Inbox que una conversación de correo se muestra correctamente con el ícono y la etiqueta ya existentes para `canal === "email"` (`src/conversaciones/components/inbox-layout.tsx`, `selector-cuenta-canal.tsx`) y corregir lo que falte

**Checkpoint US1**: el bloque "Historia 1" de [quickstart.md](./quickstart.md) pasa completo, incluidos los
casos de no-duplicación, de correo descartado y de buzón con credenciales rotas.

---

## Phase 4: User Story 2 — Responder el correo desde el Inbox (P2)

**Goal**: el agente responde desde el Inbox y el cliente recibe la respuesta dentro de su hilo de correo.

**Independent Test**: sobre una conversación recibida en US1, enviar una respuesta desde el Inbox y
confirmar en el cliente de correo del destinatario que llegó dentro del hilo original.

- [X] T036b [US2] **Tarea que faltaba en el plan.** `Conversacion.asunto` no se escribía en ninguna parte: la US1 normalizaba el asunto pero el contrato `ComandoProcesarEntrantePayload` no lo transportaba, así que el `Re: …` de FR-028 era imposible. Se agregaron `asunto` e `hiloExterno` como campos **opcionales** al contrato y a `MensajeEntranteNormalizado` (los canales que ya existían no los mandan y el consumidor los ignora), y `resolverContactoYConversacion` los persiste al crear la conversación, completando el asunto si venía vacío sin pisar uno ya puesto
- [X] T037 [US2] Implementar `src/integraciones/email/mensaje/hilo.ts`: construir `ContextoHiloCorreo` (asunto de la conversación, `In-Reply-To` con el `Message-ID` del último correo entrante, cadena `References` acotada) a partir de los `MensajeConversacion.idExterno` ya guardados, y el asunto `Re: …` sin duplicar el prefijo (research.md R6, FR-028)
- [X] T038 [US2] Reescribir `src/conversaciones/providers/email.ts`: envío SMTP real con nodemailer usando las credenciales descifradas, corrigiendo `capacidades` (`plantillas: false`, `reacciones: false`, `marcarLeidoExterno: false`) y devolviendo el `Message-ID` generado como `idExterno` (contracts/provider-email.md §1 y §2, FR-027, FR-031)
- [X] T039 [US2] Resolver el `ContextoHiloCorreo` en `src/suscriptores/mensajes/enviar-mensaje.suscriptor.ts` **antes** de llamar al provider y pasarlo dentro de `configuracion`, igual que ya se hace con la ventana de mensajería de Meta — sin cambiar la firma de `ICanalProvider`
- [X] T040 [US2] Traducir los fallos SMTP a `EnvioMensajeError` con los códigos de contracts/provider-email.md §2, marcando correctamente cuáles son reintentables, para que el Inbox los muestre como ya muestra los de Meta (FR-029)
- [X] T041 [US2] Verificar que `procesarPrimeraRespuestaProspecto` mueve la oportunidad a `stageIdRespuestaAutomatica` también en correo, sin tocar esa función (FR-030). **Verificado**: la función es agnóstica del canal, solo usa `conversacion.cuentaCanalId`. Pero el campo era **inconfigurable** para correo —el formulario no lo exponía—, así que se sumó el selector "Etapa al responder" en `modal-registrar-buzon.tsx` con su validación en `actions.ts`; sin eso FR-030 no se podía cumplir en la práctica
- [X] T042 [P] [US2] Escribir `src/integraciones/email/mensaje/hilo.test.ts`: `Re:` no se duplica, `In-Reply-To` apunta al último entrante, `References` respeta el orden y el tope, y una conversación sin asunto previo usa el asunto neutro

**Checkpoint US2**: el bloque "Historia 2" de quickstart.md pasa, verificado en **dos clientes de correo
distintos** (SC-007).

---

## Phase 5: User Story 3 — Aprobar remitentes desconocidos (P3)

**Goal**: con la creación automática desactivada, un remitente desconocido llega bloqueado y nadie —humano,
IA ni Workflow— puede responderle hasta que se lo apruebe.

**Independent Test**: con la creación automática desactivada, escribir desde una dirección nueva, verificar
que la conversación aparece bloqueada, aprobarla, y confirmar que se desbloquea y que un segundo correo de
la misma dirección ya no pide aprobación.

> **Las tres tareas de corte (T046, T047, T048) se entregan juntas.** Implementar una sola deja un agujero
> por el que la IA o un Workflow responden un correo no aprobado — exactamente lo que FR-033 prohíbe.

- [ ] T043 [US3] Implementar `src/integraciones/email/aprobacion/reglas.ts`: `requiereAprobacion(buzón, identificador)` y el predicado de bloqueo. Devuelve `false` para todo canal que no sea correo (FR-039)
- [ ] T044 [US3] En `src/conversaciones/actions.ts`, al crear contacto, conversación y oportunidad desde un remitente de correo sin aprobar: crear el contacto con `activo: false`, dejar `aprobadoEn` en `null`, y poner `Conversacion.bloqueadaPorAprobacion` y `Oportunidad.aprobacionPendiente` en `true` (research.md R7 y R8, FR-032)
- [ ] T045 [US3] Garantizar que un correo que llega mientras la aprobación sigue pendiente se suma a la misma conversación bloqueada, **sin** crear otra oportunidad ni otro pendiente (FR-038)
- [ ] T046 [US3] Corte 1 — en `src/conversaciones/envio.ts`, sumar `bloqueadaPorAprobacion` al `select` de la conversación y cortar **antes** de crear el `MensajeConversacion`, devolviendo el mensaje de FR-034
- [ ] T047 [US3] Corte 2 — en `src/suscriptores/ai/orquestar-ia.suscriptor.ts`, sumar el campo al `select` que ya trae `modoAtencion` y cortar junto a ese gate, con log del motivo (FR-033)
- [ ] T048 [US3] Corte 3 — en `src/workflows/motor/disparo.ts`, dentro de `enrutarMensajeEntrante`, sumar el campo al `select` que ya trae `modoAtencion` y devolver `{ atendido: true }` sin tomar la conversación. **Imprescindible**: esta función se evalúa *antes* que la IA en el mismo suscriptor
- [ ] T049 [US3] Implementar `src/integraciones/email/aprobacion/actions.ts` con `aprobarRemitenteConContactoNuevo` y `aprobarRemitenteConContactoExistente`, ambas sobre la única función interna `aprobarRemitenteCorreo` que escribe las tres banderas **en una sola transacción** (contracts/server-actions.md §2, FR-035, FR-036, FR-037)
- [ ] T050 [US3] Implementar la reasignación al aprobar contra un contacto existente: mover `ContactoIdentificadorCanal` y la conversación al contacto elegido y eliminar el contacto provisional, sin dejar huérfanos (FR-035)
- [ ] T051 [US3] Mostrar el estado pendiente en el Inbox (`src/conversaciones/components/inbox-layout.tsx`) con el aviso de bloqueo y las dos acciones de aprobación, y deshabilitar el input de mensaje mientras esté bloqueada (FR-034, FR-040)
- [ ] T052 [US3] Mostrar el distintivo de pendiente en el tablero de pipeline agregando `aprobacionPendiente` al `select` compartido de `src/crm/pipeline/queries.ts` y al componente de tarjeta — sin agregar una consulta por columna (FR-040)
- [ ] T053 [P] [US3] Escribir `src/integraciones/email/aprobacion/reglas.test.ts`: con creación automática activada nunca requiere aprobación; una dirección ya aprobada nunca vuelve a requerirla; ningún canal distinto de correo requiere aprobación jamás
- [ ] T054 [P] [US3] Escribir `src/integraciones/email/aprobacion/actions.test.ts`: la aprobación deja las tres banderas consistentes, y un fallo a mitad de camino no aplica ninguna (transacción)
- [ ] T055 [US3] Escribir los tres tests de corte —uno por archivo tocado en T046, T047 y T048— verificando además que una conversación **no** bloqueada se comporta exactamente como antes

**Checkpoint US3**: el bloque "Historia 3" de quickstart.md pasa completo, incluidos los puntos 4 (la IA no
responde) y 5 (el Workflow no toma la conversación).

---

## Phase 6: User Story 4 — Ajustar la recepción del buzón (P4)

**Goal**: agrupación configurable, adjuntos accesibles y edición completa del buzón.

**Independent Test**: sobre un buzón operativo, cambiar la agrupación y verificar que el siguiente correo se
agrupa según lo elegido; enviar un correo con adjunto y verificar que se puede abrir desde la conversación.

- [ ] T056 [US4] Implementar la agrupación `POR_HILO`: calcular `hiloExterno` (raíz del hilo desde `References`/`In-Reply-To`, con respaldo en el asunto normalizado) en `src/integraciones/email/mensaje/hilo.ts` y usarlo en el filtro de `resolverContactoYConversacion` cuando el buzón lo tenga configurado (FR-007)
- [ ] T057 [US4] Implementar `src/integraciones/email/mensaje/adjuntos.ts`: descarga acotada (≤ 10 MB por adjunto, ≤ 5 por correo), guardado por el servicio de media ya existente (`src/lib/media`) y vínculo a `MensajeConversacion.mediaArchivoId` (FR-024, FR-025)
- [ ] T058 [US4] Dejar constancia en la conversación cuando un correo se recibió recortado por tamaño de cuerpo o por adjuntos descartados (FR-025)
- [ ] T059 [US4] Completar la edición del buzón en `modal-registrar-buzon.tsx` y `actions.ts`: contraseña vacía conserva la actual, cambiar una conexión vuelve a exigir prueba, y desactivar detiene lectura y envío dejando las conversaciones visibles (FR-009, FR-012)
- [ ] T060 [P] [US4] Escribir `src/integraciones/email/mensaje/adjuntos.test.ts`: adjunto dentro del límite se guarda; adjunto que lo excede se descarta y se deja constancia; un correo con solo adjunto y sin texto entra igual

**Checkpoint US4**: el bloque "Historia 4" de quickstart.md pasa completo.

---

## Phase 7: Polish y verificación transversal

- [ ] T061 Ejecutar el bloque **"Cero regresión en los canales existentes"** de quickstart.md: `npm run test:unit`, `npm run test:e2e:conversaciones` y las cinco verificaciones manuales sobre WhatsApp o Instagram (SC-011)
- [ ] T062 Escribir el e2e `tests/e2e/integraciones/correo.spec.ts`: registrar un buzón con credenciales inválidas y ver el error traducido, y el flujo de aprobación de un remitente pendiente
- [ ] T063 Auditar que ninguna credencial ni cuerpo de correo aparece en logs ni en respuestas al cliente: revisar `queries.ts`, `actions.ts`, `polling.ts` y los `console.log` del módulo; lo que se loguea de un correo es `Message-ID`, tamaño y motivo de descarte (FR-011, FR-042)
- [ ] T064 Verificar el aislamiento multi-tenant con dos instancias: ninguna ve el buzón, las credenciales ni las conversaciones de correo de la otra (SC-012, FR-041)
- [ ] T065 Documentar el canal en `README.md` (variables de entorno, requisito de red del worker) y agregar a `CLAUDE.md` una nota breve sobre la separación entre el canal de correo (`src/integraciones/email/`) y el correo transaccional (`src/lib/email/`, Resend), que es la confusión más probable para quien toque esto después
- [ ] T066 Ejecutar `npm run build` y la suite completa de tests; la feature no se cierra con nada en rojo (principio V de la constitución)

---

## Dependencias entre fases

```text
Phase 1 (Setup)
   └─> Phase 2 (Foundational)  ← T004 es la línea base de SC-011: va primero
          ├─> Phase 3 (US1 · P1 · MVP)
          │       └─> Phase 4 (US2 · P2)        ← necesita conversaciones de correo recibidas
          │               └─> Phase 5 (US3 · P3) ← el bloqueo solo tiene sentido si se puede responder
          │                       └─> Phase 6 (US4 · P4)
          └─────────────────────────────────> Phase 7 (Polish)
```

Las historias no son independientes entre sí en el sentido estricto: responder sin recibir no tiene
sentido, y bloquear la respuesta sin poder responder tampoco. Sí son **entregables** por separado: US1
sola ya deja el correo registrado en el CRM.

### Dentro de US1

```text
T013 → T014 → T016 ─┐
T018 → T019 → T020 ─┼─> T026 → T032
T022 ─┐             │
T023 ─┼─> T025 ─────┘
T024 ─┘
T030 → T031 → T032
T033 → T034 → T035 → T036
```

## Oportunidades de paralelización

| Fase | Tareas que pueden correr juntas |
|---|---|
| Phase 2 | T008, T009, T010, T011, T012 (cinco archivos distintos, tras T005-T007) |
| Phase 3 | T022, T023, T024 (tres archivos de `mensaje/`); luego T027, T028, T029 (sus tests) |
| Phase 3 | La rama de interfaz (T033-T036) corre en paralelo a la de lectura (T018-T021) |
| Phase 5 | T053 y T054 |
| Phase 6 | T060 junto a T059 |

## Estrategia de entrega

1. **MVP = Phase 1 + Phase 2 + Phase 3 (US1)**. Deja el correo entrando al CRM con contacto y oportunidad.
   Es demostrable y útil aunque el equipo siga respondiendo desde su cliente de correo.
2. **US2** completa la atención de punta a punta.
3. **US3** habilita el buzón público. Sus tres cortes van juntos, sin excepción.
4. **US4** es ajuste fino: se puede diferir sin bloquear nada.

En cualquier punto donde se corte la entrega, Phase 7 debe ejecutarse igual sobre lo entregado: la
verificación de cero regresión no es opcional.

---

## Desvíos registrados durante la implementación del MVP (2026-11-16)

Lo que cambió respecto del plan, y por qué. Todo verificado contra el código o la librería, no supuesto.

1. **`nodemailer` 7.0.13 en vez de 10.6** — `next-auth@5.0.0-beta.31` declara `peerOptional nodemailer@^7.0.7`
   y la 10.6 hace fallar la resolución de npm. La API de SMTP que usa esta feature es idéntica. Se sumó
   `@types/nodemailer@^8` porque la línea 7 no publica tipos. Registrado en research.md R1.
2. **No se escribió `mensaje/html-a-texto.ts`** — `mailparser` ya incluye `html-to-text` y rellena `text`
   también para correos HTML-only, con las URLs de los enlaces. Un parser menos escrito a mano. Registrado
   en research.md R10. La decisión de seguridad no cambia: `parsed.html` no se lee nunca.
3. **`tipos.ts` nuevo, separado de `configuracion.ts`** — no estaba en el plan y lo exigió el build: los
   componentes cliente necesitan las etiquetas y los puertos sugeridos, y al importarlos de
   `configuracion.ts` webpack arrastraba `node:crypto` al bundle del navegador. Es el principio I de la
   constitución manifestándose como error de compilación. `tipos.ts` no importa nada de Node ni de Prisma.
4. **`requiereConversacionPropiaPorCanal` no se exporta** — `src/conversaciones/actions.ts` lleva
   `"use server"`, y ahí Next.js solo admite exportar funciones async. Se probó exportarla y el build falló.
5. **`filtros.ts` corregido contra la forma real de `mailparser`** — la primera versión buscaba las
   cabeceras `list-id` y `return-path` como texto. mailparser agrupa todas las `List-*` bajo una sola clave
   `list`, parsea `Return-Path` como dirección y `Content-Type` como `{ value, params }`. Cuatro tests
   fallaron y mostraron la diferencia antes de que llegara a producción.
6. **`lista-integraciones.tsx` simplificado** — había tres bloques JSX idénticos para el botón "Configurar"
   (uno por canal); se reemplazaron por un mapa `clave → ruta`. Sumar correo habría sido una cuarta copia.

7. **`Conversacion.asunto` no se escribía (hueco de la US1)** — la normalización lo extraía pero el contrato
   `ProcesarEntrante` no lo transportaba, así que llegaba a la base como `null` y el `Re: …` era imposible.
   Se cerró en la US2 agregando `asunto` e `hiloExterno` como campos opcionales del contrato. Es el tipo de
   hueco que solo aparece al construir la pieza siguiente.
8. **La etapa de respuesta era inconfigurable para correo** — `CuentaCanal.stageIdRespuestaAutomatica` ya
   existía y `procesarPrimeraRespuestaProspecto` ya la respetaba, pero el formulario del buzón no la
   exponía: FR-030 estaba implementado y era inalcanzable. Se agregó el selector.
