---

description: "Task list for 041 — Segmentación comercial de Contactos"
---

# Tasks: Segmentación comercial de Contactos

**Input**: Design documents from `specs/041-contactos-segmentacion-comercial/`

**Prerequisites**: plan.md, spec.md, research.md (D1–D15), data-model.md, contracts/server-actions.md, contracts/eventos.md, quickstart.md

**Tests**: incluidos. La constitución (principio V) exige tests proporcionales al riesgo, y quickstart.md enumera los unit tests obligatorios.

**Organization**: tareas agrupadas por historia de usuario. Antes de cada tarea que toque UI, aplicar los skills `react-best-practices`, `design-systems` y `nextjs-best-practices`. Antes de tocar fechas, leer `docs/fechas-y-zonas-horarias.md`; antes de un `<Select>`, leer `docs/selects.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (otro archivo, sin dependencias pendientes)
- **[Story]**: US1, US2, US3 = Historias 1, 2, 3 de spec.md

---

## Phase 1: Setup

**Purpose**: esquema de datos y constantes compartidas.

- [X] T001 Agregar a `prisma/schema.prisma` los enums `NivelInteres` (en este orden: ALTO, MEDIO, BAJO, SIN_EVALUAR), `OrigenClasificacion` (MANUAL, REGLA, IA) y `DimensionClasificacion` (INTERES, PREFERENCIA_CONTACTO); en `Contacto`, los campos `nivelInteres` (default SIN_EVALUAR), `nivelInteresOrigen?`, `nivelInteresFijado` (default false), `nivelInteresActualizadoEn?`, `noContactarDesde?`, `noContactarOrigen?`, `noContactarPorId?`, `ultimaInteraccionEn?`, `esperandoRespuestaDesde?` y los índices `[instanciaId, ultimaInteraccionEn]`, `[instanciaId, nivelInteres]`, `[instanciaId, esperandoRespuestaDesde]`, `[instanciaId, noContactarDesde]`; el modelo nuevo `ContactoClasificacionHistorial` (campos e índices según data-model.md, con `onDelete: Cascade` hacia Contacto e Instancia y las relaciones inversas en `Contacto` e `Instancia`); en `ConfiguracionEmpresa`, `diasSeguimientoPendiente Int @default(3)`, `diasSeguimientoRecuperar Int @default(7)`, `diasSeguimientoInactivo Int @default(60)`; y los índices aditivos `Pedido[contactoId]`, `Cotizacion[contactoId]`, `OportunidadContacto[contactoId]`, `Actividad[contactoId, completada, fecha]`, y `ContactoIdentificadorCanal[contactoId, canal]` en lugar de `[contactoId]`.
- [X] T002 Generar la migración con `npx prisma migrate dev --name contactos_segmentacion_comercial` y revisar el SQL en `prisma/migrations/<ts>_contactos_segmentacion_comercial/migration.sql`: solo `CREATE TYPE`, `ADD COLUMN` con default o nulable, `CREATE TABLE` y `CREATE INDEX` (más el `DROP INDEX` del índice simple de `ContactoIdentificadorCanal` que se reemplaza). Nada destructivo.
- [X] T003 [P] Crear `src/crm/contactos/segmentacion/canales.ts` con el mapa de grupos de canal → valores de `ContactoIdentificadorCanal.canal` (`WHATSAPP` → `whatsapp`, `whatsapp_lite`; `INSTAGRAM` → `instagram`; `FACEBOOK_MESSENGER` → `facebook_messenger`; `EMAIL` → `email`), la función inversa valor → grupo y las etiquetas visibles ("WhatsApp", "Instagram", "Messenger", "Email").

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: reglas puras, hechos materializados, autor del mensaje y datos iniciales. Ninguna historia funciona sin esto.

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase.

### Reglas puras (research D1, D2; data-model "Conceptos derivados")

- [X] T004 [P] Crear `src/crm/contactos/segmentacion/cortes.ts`: `calcularCortes(zonaNegocio, umbrales, ahora)` devuelve `{ ahora, pendiente, recuperar, inactivo }` como `Date`, donde `corte X = inicio del día de hoy en la zona − díasX días`, usando los helpers de `src/shared/fechas/rangos.ts`; incluir `UMBRALES_SEGUIMIENTO_DEFECTO = { pendiente: 3, recuperar: 7, inactivo: 60 }` y `obtenerUmbralesSeguimiento(instanciaId)` que lee `ConfiguracionEmpresa` y cae a los defaults. Agregar también los rangos de "Última actividad" (HOY, ULTIMOS_7, ULTIMOS_30, MAS_DE_30, SIN_ACTIVIDAD) como filtros `{ gte, lt }` semiabiertos.
- [X] T005 [P] Crear `src/crm/contactos/segmentacion/condiciones.ts` (solo `import type` de Prisma, como `src/sales/pedidos/condicion-venta.ts`) con constructores de `Prisma.ContactoWhereInput`: `condicionCliente(etapas)` (reutiliza `construirCondicionVenta`), `condicionSenalObjetiva()` (oportunidad vinculada con `fechaGanada` y `fechaPerdida` nulas, o cotización en BORRADOR/REVISADA/APROBADA/ENVIADA), `condicionInteresado()`, `condicionLead(etapas)`, `condicionSeguimiento(estado, cortes)` para AL_DIA / PENDIENTE / POR_RECUPERAR / INACTIVO según la tabla de precedencia de data-model.md (con `NOT` de las reglas previas, de modo que los cuatro estados sean excluyentes y cubran a todos), `condicionTramo(1|2|3|4, cortes)` y `condicionSegmento(segmento, etapas, cortes)`. La referencia de fecha es `ultimaInteraccionEn` o, si es nula, `creadoEn`. Comentar por qué Cliente no se persiste (regla 10 de CLAUDE.md).
- [X] T006 [P] Crear `src/crm/contactos/segmentacion/recomendacion.ts`: función pura `calcularRecomendacion({ noContactar, esperandoRespuesta, seguimiento, esCliente, esInteresado, interes })` → una de NO_CONTACTAR, RESPONDER, RETOMAR_CONVERSACION, CONTACTAR_HOY, DAR_SEGUIMIENTO, OFRECER_NOVEDADES, EVALUAR, SIN_URGENCIA, en el orden de FR-031 (research D12: NO_CONTACTAR va antes que RESPONDER). Agregar también `calcularSeguimientoFila(...)`, la versión en memoria de la misma precedencia para una fila ya cargada, que debe coincidir con `condicionSeguimiento`.
- [X] T007 [P] Tests en `src/crm/contactos/segmentacion/condiciones.test.ts`: todos los casos de reglas de la tabla de unit tests de quickstart.md (Cliente con y sin flujo, flujo sin etapas marcadas → `{ in: [] }`, BAJO fijado / no fijado con señal, Cliente ∩ Interesado, cortes 4/9/70 días, actividad pendiente futura, No contactar, bordes `gte`/`lt`). Verificar también, con una matriz de filas sintéticas, que `calcularSeguimientoFila` y `condicionSeguimiento` asignan el mismo estado.
- [X] T008 [P] Tests en `src/crm/contactos/segmentacion/recomendacion.test.ts`: un caso por cada recomendación, más la precedencia (No contactar con mensaje sin responder → NO_CONTACTAR; Pendiente con ALTO → CONTACTAR_HOY; Cliente inactivo sin interés → OFRECER_NOVEDADES).

### Hechos materializados y autor del mensaje (research D3, D4)

- [X] T009 Crear `src/crm/contactos/interaccion.ts` con `registrarInteraccion(contactoId, fecha, tx?)` (`updateMany` con `where: { id, OR: [{ ultimaInteraccionEn: null }, { ultimaInteraccionEn: { lt: fecha } }] }`; nunca retrocede), `registrarMensajeEntrante(contactoId, fecha, tx?)` (llama a la anterior y pone `esperandoRespuestaDesde = fecha` solo si es null) y `registrarRespuesta(contactoId, tx?)` (`esperandoRespuestaDesde = null`). Agregar `src/crm/contactos/interaccion.test.ts` que cubra que la fecha no retrocede y que se conserva el primer mensaje sin respuesta.
- [X] T010 En `src/conversaciones/envio.ts`, reemplazar `origen?: "WORKFLOW"` por `autor: "PERSONA" | "IA" | "WORKFLOW"` obligatorio en `EnviarMensajeInternoInput`; mantener el comportamiento de `procesarPrimeraRespuestaProspecto` (se llama cuando `autor !== "WORKFLOW"`). Después de crear un mensaje que no es nota interna: llamar siempre a `registrarRespuesta(conversacion.contactoId)` y, solo si `autor === "PERSONA"`, a `registrarInteraccion(conversacion.contactoId, ahora)`.
- [X] T011 Actualizar los llamadores de `enviarMensajeInterno` según contracts/server-actions.md §6: `src/conversaciones/actions.ts` (`enviarMensaje`: `autor: "PERSONA"` y `usuarioId` tomado de la sesión, ignorando el del input); `src/ai/respuesta/responder-con-agente.ts:312` (`autor: params.origen?.tipo === "WORKFLOW" ? "WORKFLOW" : "IA"`); `src/workflows/motor/adaptadores.ts:15` (`autor: "WORKFLOW"`); `src/ai/autonomia/actions.ts:25` (`autor: "WORKFLOW"`). `npx tsc --noEmit` no debe reportar llamadores sin `autor`.
- [X] T012 En `src/conversaciones/actions.ts`, después de crear el mensaje entrante (`remitente: "CONTACTO"`, ~línea 514), llamar a `registrarMensajeEntrante(contactoId, mensaje.creadoEn)`. Después del eco desde la app nativa (`AGENTE_CANAL_NATIVO`, ~línea 616), llamar a `registrarInteraccion` y `registrarRespuesta`. No llamar en el camino de deduplicación (`existente`).
- [X] T013 [P] Llamar a `registrarInteraccion(contactoId, actividad.creadoEn)` cuando la actividad tiene contacto en `src/crm/actividades/actions.ts:30`. **No** hacerlo en `crm/pipeline/disparadores/ejecutor.ts`, `workflows/motor/adaptadores.ts` ni `crm/datos/actions.ts`: son automáticas o de importación (research D3).
- [X] T014 [P] Llamar a `registrarInteraccion(contactoId, pedido.creadoEn)` cuando hay contacto, dentro de la misma transacción si existe, en `src/sales/pedidos/actions.ts:143`, `src/sales/cotizaciones/services/generar-pedido-desde-cotizacion.service.ts:116` y `src/ai/tools/providers/crear-pedido.tool.ts:203`.

### Perfil 012 con la condición de venta (research D11, FR-027)

- [X] T015 [P] En `src/ai/perfil-cliente/calculo-objetivo.ts:27`, reemplazar `estado: "ENTREGADO"` por `...construirCondicionVenta(await obtenerEtapasFlujoActivo(instanciaId))` (de `src/sales/pedidos/condicion-venta.ts` y `src/sales/flujo-venta/queries.ts`), y tomar la fecha de última compra de `fechaVenta ?? fechaEntrega ?? creadoEn`. Ampliar `src/ai/perfil-cliente/calculo-objetivo.test.ts` con flujo con etapa marcada, flujo sin ninguna marcada (0 compras) e instancia sin flujo (cae a ENTREGADO).

### Datos iniciales (research D10, data-model "Migración de datos")

- [X] T016 Crear `scripts/041-sembrar-interes-contactos.ts`, idempotente, por instancia y en lotes de 500. Pasos: (1) backfill de `ultimaInteraccionEn` con el máximo de mensajes CONTACTO/AGENTE_CANAL_NATIVO no nota, actividades no creadas por Workflows ni disparadores (por `metadata`) y pedidos, solo donde es null; (2) backfill de `esperandoRespuestaDesde` (último mensaje no nota y no SISTEMA del contacto; si es CONTACTO, su `creadoEn`), solo donde es null; (3) siembra de `nivelInteres` desde `PerfilClienteSnapshot.datosInterpretados.intencionComercialActual` con la tabla de equivalencias de research D10 documentada en el archivo, origen IA, `fijado = false`, una fila de `ContactoClasificacionHistorial` por contacto, solo donde `nivelInteresOrigen` es null. Usar `Prisma.sql` parametrizado, nunca SQL concatenado. Agregar a `package.json` el script `"db:backfill:contactos-segmentacion": "tsx scripts/041-sembrar-interes-contactos.ts"`.

**Checkpoint**: migración aplicada, script ejecutado dos veces sin cambios en la segunda corrida, `npm run test:unit` en verde, `npx tsc --noEmit` limpio.

---

## Phase 3: User Story 1 — Entender mi cartera y encontrar contactos rápido (Priority: P1) 🎯 MVP

**Goal**: lista paginada en el servidor con cinco indicadores interactivos, pestañas, búsqueda, filtros visibles y orden por prioridad.

**Independent Test**: quickstart.md escenarios 1–4, 9 y la medición de rendimiento; `npm run test:e2e:contactos` (casos US1).

### Tests for User Story 1

- [X] T017 [P] [US1] Crear `src/crm/contactos/vista.test.ts` para la paginación por tramos (research D2), con `cargarVistaContactos` usando doble de Prisma o base de test según el patrón de los tests existentes del repo: página dentro de un tramo, página que cruza T1→T2 y T3→T4, última página, página fuera de rango (devuelve la última), sin duplicados ni huecos al recorrer todas las páginas; y que los indicadores ignoren los filtros de la barra (research D7).
- [X] T018 [P] [US1] En `tests/e2e/crm/contactos.spec.ts`, agregar los escenarios de US1: indicadores con conteos correctos sobre datos sembrados por el test, clic en indicador ↔ pestaña sincronizados, búsqueda por fragmento de teléfono y de email, filtros conservados al paginar, "Limpiar", orden por prioridad por defecto, menú Ver/Editar/Eliminar intacto y viewport de 375 px sin scroll horizontal. Ajustar los tests existentes que dependían de la columna "Estado" o del buscador viejo.

### Implementation for User Story 1

- [X] T019 [US1] Agregar a `src/crm/contactos/schema.ts` el `FiltrosVistaContactosSchema` de contracts/server-actions.md §1 con `FILTROS_VISTA_CONTACTOS_DEFECTO`, y en `src/crm/contactos/types.ts` los tipos `FiltrosVistaContactos`, `VistaContactos` y `FilaContacto` derivados con `z.infer<>` o según el contrato.
- [X] T020 [US1] Crear `src/crm/contactos/vista.ts` con `cargarVistaContactos(instanciaId, zonaNegocio, filtros, etapas)`. Construir el `where` base (instancia + búsqueda OR `contains` insensitive sobre nombre, apellido, email, telefonoPrincipal, telefonoSecundario + tipo + interés + canal vía `canales.ts` + rango de última actividad + seguimiento + preferencia + segmento). En `Promise.all`: los 5 conteos de indicadores sin filtros de barra; el `count` total filtrado; y, si el orden es PRIORIDAD, los 4 conteos de tramos. Paginación: PRIORIDAD por tramos (D2, orden interno `ultimaInteraccionEn desc nulls last`, desempate `id`); NOMBRE (`nombre`, `apellido`, `id`); ULTIMA_ACTIVIDAD; INTERES (enum asc = Alto primero). Por cada fila de la página, una sola consulta adicional en lote (no N+1) para saber si es Cliente, si tiene señal objetiva, si tiene actividad pendiente vencida o vigente y su canal de la última conversación; con eso, calcular `tipo`, `esInteresado`, `seguimiento` (`calcularSeguimientoFila`) y `recomendacion`. Devolver `VistaContactos`.
- [X] T021 [US1] En `src/crm/contactos/actions.ts`, agregar `consultarVistaContactosAction(entrada)`: sesión, permiso `contactos` lectura, `FiltrosVistaContactosSchema.parse`, `obtenerEtapasFlujoActivo`, `cargarVistaContactos` con `sesion.zonaNegocio`; ante un error, log en el servidor y respuesta genérica (mismo patrón que `consultarVistaPedidosAction` en `src/sales/pedidos/actions.ts:829`).
- [X] T022 [P] [US1] Crear `src/crm/contactos/components/insignias-contacto.tsx`: `InsigniaTipo`, `InsigniaInteres` (punto de color + texto), `InsigniaNoContactar` e `InsigniaRecomendacion` con `Badge` y los tokens `stage-*`/`primary`/`muted` de `src/app/globals.css`, pequeñas y suaves, con `data-slot` y `className` vía `cn()`.
- [X] T023 [P] [US1] Crear `src/crm/contactos/components/contactos-indicadores.tsx`: cinco tarjetas compactas (mismo markup y acentos que `src/sales/pedidos/components/pedidos-kpi-cards.tsx`) como `<button aria-pressed>`, resaltado sutil de la seleccionada, ícono de información con `Tooltip` que explica la superposición (FR-004), grid responsive sin scroll horizontal en 375 px y sin tendencias (FR-005).
- [X] T024 [P] [US1] Crear `src/crm/contactos/components/contactos-filtros.tsx`: pestañas rápidas con conteo (comparten el `segmento`), buscador con debounce, `Select` de Tipo, Interés, Canal y Última actividad, todos con prop `items` (docs/selects.md), y acción "Limpiar" visible solo con filtros activos. Dejar el hueco para "Más filtros" (lo llena US3).
- [X] T025 [US1] Crear `src/crm/contactos/components/tabla-contactos.tsx` con `Table` de `src/components/ui/table.tsx`: columnas Contacto (`AvatarContacto` + nombre + dato secundario), Tipo, Interés, Última actividad (`<FechaHora>` relativo, "Sin actividad" si es null), Canal (ícono + etiqueta o "—") y Acciones (reutilizar `AccionesContacto` extraído de `lista-contactos.tsx`, con su `ConfirmacionDialog` y sus permisos). La columna Recomendación se deja preparada pero oculta hasta US3. Encabezados ordenables (Nombre, Última actividad, Interés) y opción de volver a "Prioridad". Pie "Mostrando X–Y de N contactos" con selector de 20/50/100 y paginación. En `< md`, lista de tarjetas compactas (nombre, tipo, interés, última actividad). Estado "Sin resultados para estos filtros" con "Limpiar". Fila clicable con `onSeleccionar(id)` para US2.
- [X] T026 [US1] Crear `src/crm/contactos/components/vista-contactos.tsx` (`'use client'`): `useVistaFiltrada` con `clave`, `filtros`, `esDefecto`, `inicial` y `consultar: consultarVistaContactosAction` (patrón de `src/sales/pedidos/components/vista-pedidos.tsx`), estado de filtros compartido entre indicadores, pestañas y barra, y `ZonaResultados` para el estado "actualizando".
- [X] T027 [US1] Reescribir `src/app/crm/contactos/page.tsx`: `requireSesion` + `verificarAcceso(contactos, ver)`; en `Promise.all`, `obtenerEtapasFlujoActivo` y `cargarVistaContactos` con los filtros por defecto; si `indicadores.total === 0`, mostrar el `EmptyState` actual; si no, `PageHeader` (descripción "Conoce y gestiona tus contactos, clientes y oportunidades comerciales", botón "Nuevo contacto" con permiso) + `<VistaContactos inicial=…>`. `export const dynamic = "force-dynamic"`. Sin botón "Analizar con IA" (FR-038) y sin casillas de selección (FR-039).
- [X] T028 [P] [US1] Actualizar `src/app/crm/contactos/loading.tsx` con un skeleton de 5 indicadores, la barra de filtros y filas de tabla (patrón de `src/shared/ui/skeletons-pagina.tsx`).
- [X] T029 [US1] En `src/crm/contactos/components/lista-contactos.tsx`, dejar solo `AccionesContacto` exportado (o moverlo a `acciones-contacto.tsx`) y retirar `ListaContactos` y la columna "Estado" (FR-016), verificando con grep que no queden importaciones. No tocar `obtenerContactos` ni `buscarContactos` en `queries.ts` (FR-036).

**Checkpoint**: US1 funciona sola: indicadores, pestañas, filtros, búsqueda, orden por prioridad (con umbrales por defecto) y paginación. Correr la medición de rendimiento de quickstart.md y anotar el resultado en research.md (DT-01).

---

## Phase 4: User Story 2 — Ver el contexto de un contacto y corregir su clasificación (Priority: P2)

**Goal**: panel lateral, interés editable con historial, "No contactar" con bloqueo de envíos automáticos y aviso a las personas.

**Independent Test**: quickstart.md escenarios 5, 6, 7 y 10; `npm run test:e2e:contactos` (casos US2) y `npm run test:e2e:conversaciones`.

### Tests for User Story 2

- [X] T030 [P] [US2] Crear `src/crm/contactos/clasificacion.test.ts`: fijar interés (escribe contacto e historial en una transacción y publica `ContactoInteresActualizado`), liberar (vuelve a SIN_EVALUAR con `fijado=false`), mismo valor (no escribe), escritura automática sobre un valor fijado (rechazada), No contactar → Contactable con origen IA (rechazada), instancia ajena (no encontrado).
- [X] T031 [P] [US2] Agregar tests de envío en `src/conversaciones/envio.test.ts` (crear el archivo si no existe): `autor: "IA"` y `"WORKFLOW"` a un contacto No contactar → `ok: false` sin crear mensaje; `autor: "PERSONA"` → `ok: true`; y en `src/workflows/motor/` (archivo de test de adaptadores existente o nuevo) que `MENSAJE_NO_CONTACTAR` se convierte en `ErrorDefinitivoWorkflow`.
- [ ] T032 [P] [US2] (parcial: los escenarios de Contactos están en `tests/e2e/crm/contactos-segmentacion.spec.ts`; falta el del aviso en el inbox, que necesita una conversación sembrada) En `tests/e2e/crm/contactos.spec.ts`, agregar los escenarios de US2: abrir el panel con clic en una fila (filtros y página conservados), contenido del panel, cambio de interés reflejado en la fila y en los conteos, historial visible, marcar y desmarcar No contactar, y usuario de solo lectura sin controles. En `tests/e2e/conversaciones/inbox.spec.ts`: aviso visible en el compositor y envío manual permitido.

### Implementation for User Story 2

- [X] T033 [P] [US2] Crear los contratos `src/eventos/contratos/contacto-interes-actualizado.event.ts` y `src/eventos/contratos/contacto-preferencia-contacto-actualizada.event.ts` (payloads de contracts/eventos.md), registrarlos en `src/eventos/catalogo.ts` (`ContactoInteresActualizado`, `ContactoPreferenciaContactoActualizada`) y en `src/eventos/mapa.ts`/`src/eventos/index.ts` si los demás eventos están ahí, y documentarlos en `docs/eventos.md` (sección Contactos, mismo formato que `ContactoActualizado`).
- [X] T034 [US2] Crear `src/crm/contactos/clasificacion.ts`: `actualizarInteres({ instanciaId, contactoId, accion, origen, usuarioInstanciaId })` y `actualizarPreferenciaContacto({ instanciaId, contactoId, noContactar, origen, usuarioInstanciaId })`, cada una en `prisma.$transaction` (contacto + `ContactoClasificacionHistorial`), con las reglas de transición de data-model.md (rechazar un valor automático sobre uno fijado; rechazar No contactar → Contactable con origen ≠ MANUAL) y publicación del evento después del commit.
- [X] T035 [US2] Agregar a `src/crm/contactos/schema.ts` los esquemas de contracts §3 y §4. En `src/crm/contactos/actions.ts`, agregar `actualizarInteresContactoAction` y `actualizarPreferenciaContactoAction`: permiso `contactos` modificación, origen MANUAL, `usuarioInstanciaId` de la sesión, `revalidatePath("/crm/contactos")`, `revalidatePath("/crm/contactos/[id]", "page")` y, para la preferencia, también `revalidatePath("/inbox")`.
- [X] T036 [US2] Agregar `obtenerResumenContacto(contactoId, instanciaId, etapas, cortes)` en `src/crm/contactos/queries.ts` con la forma de contracts §2: última compra con condición de venta, hasta 5 oportunidades abiertas, hasta 5 actividades pendientes con `vencida`, canales, etiquetas, conversación más reciente e historial de los últimos 10 cambios con nombre de usuario. Sumar `obtenerResumenContactoAction(contactoId)` en `actions.ts` (permiso lectura; contacto ajeno → "Contacto no encontrado").
- [X] T037 [P] [US2] Crear `src/crm/contactos/components/control-clasificacion.tsx`: `Select` de interés (con `items`) que fija el valor, acción "Liberar" visible solo si está fijado, `Switch` o botón "No contactar" con `ConfirmacionDialog` al marcar, `toast` con el resultado y `queryClient.invalidateQueries` del resumen y de la vista. Se oculta sin permiso de modificación (`useSesion().puedeModificar("contactos")`).
- [X] T038 [US2] Crear `src/crm/contactos/components/panel-contacto.tsx` con `Sheet` del lado derecho (pantalla completa en móvil): encabezado con avatar, nombre e insignias (tipo, interés, No contactar); secciones "Información general", "Actividad comercial", "Análisis de IA" (estado "Sin analizar", FR-019), "Historial de clasificación" (colapsable) y "Acciones rápidas" (Abrir conversación → `/inbox?conversacion=<id>` o la ruta existente del inbox, Crear actividad → `/crm/actividades/nueva?contactoId=<id>`, Ver oportunidades, Abrir ficha completa → `/crm/contactos/<id>`) con `ControlClasificacion`. Datos con `useQuery(["contacto-resumen", id], obtenerResumenContactoAction)`. Si la respuesta es "no encontrado", cerrar con un toast y refrescar la vista. Usar solo tokens semánticos.
- [X] T039 [US2] Conectar en `src/crm/contactos/components/vista-contactos.tsx` el estado `contactoSeleccionadoId` con `onSeleccionar` de la tabla y `<PanelContacto>`, sin resetear filtros ni página al abrir o cerrar (FR-013). Mostrar `InsigniaNoContactar` en la fila de la tabla.
- [X] T040 [US2] Corte principal de "No contactar" en `src/conversaciones/envio.ts`: exportar `MENSAJE_NO_CONTACTAR`; justo después del corte de `bloqueadaPorAprobacion`, si `conversacion.contacto.noContactarDesde` existe y `autor !== "PERSONA"`, devolver `{ ok: false, error: MENSAJE_NO_CONTACTAR }` antes de crear el mensaje. Comentario que explique el corte y que remita a los cortes tempranos (como en 034).
- [X] T041 [P] [US2] Cortes tempranos: en `src/suscriptores/ai/orquestar-ia.suscriptor.ts`, agregar `contacto: { select: { noContactarDesde: true } }` al `select` de la conversación y retornar con log si está marcado, junto al corte de `bloqueadaPorAprobacion` (~línea 82); en `src/workflows/motor/disparo.ts`, lo mismo junto al corte 3 de 3 (~línea 54), devolviendo `{ atendido: true }`.
- [X] T042 [P] [US2] En `src/workflows/motor/adaptadores.ts:20`, tratar `r.error === MENSAJE_NO_CONTACTAR` como `ErrorDefinitivoWorkflow`.
- [X] T043 [P] [US2] Aviso en el compositor (FR-025): exponer `contacto.noContactarDesde` en los datos de conversación que ya cargan `src/conversaciones/components/inbox-layout.tsx` y `src/conversaciones/components/panel-conversacion.tsx` (ajustar la query o acción de origen) y mostrar un aviso persistente y discreto sobre el compositor ("Este contacto pidió no ser contactado. Puedes enviar igual."). No bloquear el envío.
- [X] T044 [P] [US2] Pasar a tokens semánticos los colores escritos a mano de `src/crm/contactos/components/avatar-contacto.tsx` y, si el panel lo reutiliza, de `src/crm/contactos/components/panel-perfil-cliente.tsx` (`stone-*`/`purple-*` → `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `stage-purple-*`).

**Checkpoint**: US1 + US2 funcionan juntas; la IA y los Workflows no escriben a contactos No contactar; las personas ven el aviso.

---

## Phase 5: User Story 3 — Saber a quién dar seguimiento y qué hacer (Priority: P3)

**Goal**: umbrales configurables, filtros de seguimiento y preferencia, y columna Recomendación.

**Independent Test**: quickstart.md escenario 8; `npm run test:e2e:contactos` (casos US3) y `npm run test:e2e:configuracion`.

### Tests for User Story 3

- [X] T045 [P] [US3] En `tests/e2e/crm/contactos.spec.ts`, agregar los escenarios de US3: Por recuperar con 9 días, Al día con actividad futura, "Responder" con mensaje sin respuesta, Lead de 70 días Inactivo (no Por recuperar), filtro de seguimiento combinado con otro filtro y columna Recomendación. En `tests/e2e/configuracion/configuracion.spec.ts`: guardar umbrales válidos, rechazar 7/3/60 y verificar el efecto en el indicador Por recuperar.

### Implementation for User Story 3

- [X] T046 [US3] Agregar `guardarUmbralesSeguimientoAction` en `src/configuracion/empresa/actions.ts` con el esquema de contracts §5 (permiso `configuracion` modificación, `upsert` de `ConfiguracionEmpresa` por `instanciaId`, `revalidatePath("/configuracion")` y `revalidatePath("/crm/contactos")`), y la lectura de los valores actuales donde `tab-preferencias` obtiene sus datos.
- [X] T047 [US3] En `src/configuracion/components/tab-preferencias.tsx`, agregar la sección "Seguimiento de contactos" con tres inputs numéricos (Pendiente, Por recuperar, Inactivo), ayuda breve de qué significa cada uno, validación con el mismo esquema Zod en el cliente, botón Guardar deshabilitado sin cambios y `toast` del resultado (mismo patrón que la preferencia de catálogo existente).
- [X] T048 [US3] Asegurar que `cargarVistaContactos` (`src/crm/contactos/vista.ts`) y `obtenerResumenContacto` usan `obtenerUmbralesSeguimiento(instanciaId)` en vez de los defaults fijos (si T020/T036 ya lo hacen, verificarlo con un test en `vista.test.ts`).
- [X] T049 [US3] En `src/crm/contactos/components/contactos-filtros.tsx`, agregar el botón "Más filtros" (`Popover`) con `Select` de Seguimiento (Al día, Pendiente de seguimiento, Por recuperar, Inactivo) y de Preferencia (Contactable, No contactar), con `items`, un contador de filtros avanzados activos en el botón, e incluirlos en "Limpiar".
- [X] T050 [US3] Mostrar la columna Recomendación en `src/crm/contactos/components/tabla-contactos.tsx` (ícono + texto con `InsigniaRecomendacion`; en móvil, una línea en la tarjeta) y mostrar el seguimiento y la recomendación en el panel (`panel-contacto.tsx`), sección "Actividad comercial".

**Checkpoint**: las tres historias funcionan; los umbrales cambian el seguimiento en la siguiente visita.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T051 [P] Revisar todos los componentes nuevos con los skills `design-systems` y `react-best-practices`: tokens semánticos en dark y light, verde solo como acento, sin hex/rgb ni valores arbitrarios, `data-slot` en los componentes reutilizables, `memo` en las filas si la tabla re-renderiza de más, sin waterfalls en la página.
- [X] T052 [P] Accesibilidad: `aria-pressed` en indicadores, `aria-sort` en encabezados ordenables, foco devuelto a la fila al cerrar el `Sheet`, contraste de las insignias en ambos temas.
- [ ] T053 Correr la medición de rendimiento de quickstart.md con 20.000 contactos; registrar los tiempos y, si no cumple SC-003, los `EXPLAIN ANALYZE` en research.md (DT-01).
- [ ] T054 [P] Regresión FR-036: `npm run test:e2e:pipeline`, `npm run test:e2e:pedidos`, `npm run test:e2e:cotizaciones` y `npm run test:e2e:actividades` en verde.
- [ ] T055 Ejecutar quickstart.md completo (escenarios 1–10), `npm run test:unit`, `npm run test:e2e:contactos`, `npm run test:e2e:conversaciones`, `npm run test:e2e:configuracion` y `npm run build`.
- [X] T056 [P] Actualizar CLAUDE.md, sección "Reglas generales de desarrollo", con una regla breve sobre 041: Cliente y seguimiento se derivan en `src/crm/contactos/segmentacion/condiciones.ts` y no se persisten; `ultimaInteraccionEn` y `esperandoRespuestaDesde` solo se escriben por `src/crm/contactos/interaccion.ts`; todo envío declara `autor`; "No contactar" corta en `enviarMensajeInterno` más los dos cortes tempranos. Apuntar a `specs/041-contactos-segmentacion-comercial/`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sin dependencias. T002 depende de T001.
- **Foundational (Fase 2)**: depende de Setup. **Bloquea todas las historias.**
- **US1 (Fase 3)**: depende de la Fase 2.
- **US2 (Fase 4)**: depende de la Fase 2 y de la tabla y la vista de US1 (T025, T026) para abrir el panel. Los cortes de envío (T040–T043) solo dependen de la Fase 2 y pueden adelantarse.
- **US3 (Fase 5)**: depende de la Fase 2 y de US1 (filtros y tabla). No depende de US2.
- **Polish (Fase 6)**: depende de las historias que se vayan a publicar.

### Dentro de la Fase 2

- T004, T005, T006 en paralelo → T007, T008 (tests).
- T009 → T010 → T011 → T012. T013 y T014 dependen solo de T009.
- T015 es independiente.
- T016 depende de T002.

### Dentro de cada historia

- Tests primero (deben fallar), después esquemas y servicios, después acciones, después UI.
- US1: T019 → T020 → T021 → (T022, T023, T024 en paralelo) → T025 → T026 → T027 → T029.
- US2: T033 → T034 → T035; T036 → T038; T037 → T038 → T039; T040 → T041, T042, T043.
- US3: T046 → T047; T048; T049 y T050 en paralelo.

## Parallel Example: User Story 1

```text
# Después de T021:
T022 insignias-contacto.tsx
T023 contactos-indicadores.tsx
T024 contactos-filtros.tsx
T028 loading.tsx
# Mientras tanto, los tests:
T017 vista.test.ts
T018 contactos.spec.ts (US1)
```

## Parallel Example: User Story 2

```text
T033 contratos de eventos + docs/eventos.md
T037 control-clasificacion.tsx
T041 cortes tempranos (orquestador IA + disparo)
T042 adaptadores Workflow
T043 aviso en el compositor
T044 tokens en avatar / perfil
```

## Implementation Strategy

### MVP (solo US1)

1. Fase 1 + Fase 2 (incluye el fix 012 y el cambio de `autor`, que también son correcciones por sí mismos).
2. Fase 3 (US1). La columna Recomendación queda oculta; el seguimiento usa los umbrales por defecto.
3. **Validar**: quickstart escenarios 1–4 y 9, y la medición de rendimiento. Publicable.

### Entrega incremental

1. MVP (US1) → responde "¿cuántos clientes reales?", "¿cuántos interesados?", "¿quién me escribió y no le respondí?".
2. + US2 → panel, clasificación manual y "No contactar" efectivo.
3. + US3 → seguimiento configurable y recomendación.

Cada paso pasa sus tests y `npm run build` antes de seguir.

## Notes

- [P] = otro archivo, sin dependencias pendientes.
- Hacer commit al cerrar cada tarea o grupo lógico, con un mensaje en español y en pasado del cambio de dominio.
- No "simplificar" la condición de Cliente a `{}` cuando el flujo no tiene etapas marcadas (CLAUDE.md regla 10; test en T007).
- No escribir `ultimaInteraccionEn` ni `esperandoRespuestaDesde` fuera de `src/crm/contactos/interaccion.ts`.
