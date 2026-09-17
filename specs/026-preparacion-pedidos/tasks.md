---

description: "Task list for 026-preparacion-pedidos"
---

# Tasks: Preparación de pedidos — tablero operativo con estados configurables

**Input**: Design documents from `/specs/026-preparacion-pedidos/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: SÍ se incluyen. La constitución del proyecto (principio V, NO NEGOCIABLE) exige tests
proporcionales al riesgo, y `research.md` Decisión 11 define el reparto: Vitest para lógica pura, Playwright
para recorridos críticos y no-regresión.

**Organization**: Tareas agrupadas por historia de usuario. Cada historia es un incremento entregable y
testeable por separado.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: A qué historia pertenece (US1, US2, US3, US4)
- Cada tarea incluye la ruta exacta del archivo

## Path Conventions

Proyecto web monolítico con Next.js App Router (ver `plan.md` → Structure Decision):

- Dominio: `src/sales/preparacion/`
- Rutas: `src/app/sales/preparacion/`
- Esquema: `prisma/schema.prisma`
- E2E: `tests/e2e/sales/`
- Unit: junto al código, `*.test.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dejar el entorno en condiciones de compilar y testear antes de tocar código.

- [X] T001 Instalar dependencias con `npm install` — el repositorio no tiene `node_modules` (verificado: el directorio no existe), por lo que sin esto no corre ni `tsc`, ni Vitest, ni Playwright, ni el dev server
- [X] T002 Establecer la línea base verde ejecutando `npm run build`, `npm run test:unit` y `npx playwright test tests/e2e/sales/pedidos.spec.ts`, y registrar cualquier fallo preexistente para no atribuirlo después a esta feature

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Esquema, permisos, navegación y servicios base que todas las historias necesitan.

**⚠️ CRITICAL**: ninguna historia puede empezar hasta terminar esta fase.

- [X] T003 Agregar a `prisma/schema.prisma` los 5 modelos nuevos (`FlujoPreparacion`, `FlujoPreparacionEntrada`, `EstadoPreparacion`, `PreparacionPedido`, `PreparacionHistorial`), los 2 enums (`AgrupacionPreparacion`, `RangoPreparacion`), los 3 campos nuevos de `PedidoLinea` (`cantidadPreparada`, `preparadaEn`, `preparadaPorId` + relación `preparadaPor`) y las relaciones inversas en `Pedido`, `Instancia`, `Usuario` y `FlujoVentaEtapa`, exactamente como los define `data-model.md` (un solo archivo, no paralelizable)
- [X] T004 Generar y aplicar la migración con `npm run db:migrate` (nombre sugerido: `preparacion_pedidos`) y verificar que es puramente aditiva: ninguna columna existente cambia de tipo ni de nombre, todos los campos nuevos son nullables o con default, sin script de backfill
- [X] T005 [P] Agregar el módulo `"preparacion"` al type `Modulo` en `src/shared/auth/permisos.ts` y completar la matriz `PERMISOS` para todos los roles (OWNER/ADMIN: modificar; AGENTE_VENTAS: ver) — el compilador exige cubrir cada rol, así que ningún rol queda sin definir por olvido
- [X] T006 [P] Agregar el ítem "Preparación" a la sección VENTAS de `src/shared/ui/app-sidebar.tsx` con `href: "/sales/preparacion"`, ícono de Lucide y `modulo: "preparacion"`, ubicado entre Pedidos y Flujo de venta
- [X] T007 [P] Agregar los 3 nombres de evento (`PreparacionIniciada`, `PreparacionCompletada`, `LineaPedidoPreparada`) al bloque nuevo `// Preparación` de `EventosSistema` en `src/eventos/catalogo.ts`, con los valores definidos en `contracts/eventos.md`
- [X] T008 [P] Crear `src/sales/preparacion/constantes.ts` con las etiquetas de rango (`HOY`/`MANANA`/`SEMANA`/`PERSONALIZADO`) y de agrupación (`POR_PEDIDO`/`POR_PRODUCTO`)
- [X] T009 Crear `src/sales/preparacion/schema.ts` con `EstadoPreparacionSchema`, `AvanceLineaSchema` y `PreferenciasTableroSchema` según `contracts/server-actions.md`, y `src/sales/preparacion/types.ts` derivando los tipos con `z.infer<>` (sin `any`)
- [X] T010 Implementar `src/sales/preparacion/servicios/asegurar-flujo-preparacion.ts` — crea idempotentemente el flujo por defecto de la instancia con 2 estados ("Por preparar" `esInicial` + `marcaInicio`, "Preparado" `esFinal`) y sin etapas de entrada configuradas, devolviendo la configuración vigente (research Decisión 5)
- [X] T011 Implementar `src/sales/preparacion/servicios/asegurar-preparacion-pedido.ts` — materializa perezosamente la `PreparacionPedido` de un pedido que está en etapa de entrada, con `upsert` por `pedidoId` para que sea idempotente, sellando `iniciadaEn` si ningún estado tiene `marcaInicio` (research Decisión 1, data-model tabla de transiciones fila 1)

**Checkpoint**: esquema migrado, permisos y navegación listos, servicios de arranque disponibles. Las historias pueden comenzar.

---

## Phase 3: User Story 1 - Operar el tablero de preparación con los estados que mi empresa necesita (Priority: P1) 🎯 MVP

**Goal**: tablero funcionando con estados configurables, movimiento de pedidos, sellado de fechas y responsable, historial y resolución de conflictos.

**Independent Test**: configurar 4 estados, abrir el tablero con pedidos reales, arrastrar un pedido de la primera a la última columna y verificar inicio, fin, responsable e historial completo.

### Tests for User Story 1 ⚠️

> Escribir estos tests primero y verificar que fallan antes de implementar.

- [X] T012 [P] [US1] Crear `src/sales/preparacion/servicios/mover-preparacion.test.ts` (Vitest) cubriendo las cuatro reglas de sellado de `data-model.md`: sella `iniciadaEn` al entrar al estado con `marcaInicio`; **no** lo re-sella en entradas posteriores; sella `completadaEn` + `asignadaAId` al entrar al estado final; limpia ambos al retroceder desde el final
- [X] T013 [P] [US1] Agregar a `src/sales/preparacion/servicios/mover-preparacion.test.ts` los casos de las 5 invariantes de `data-model.md` (en particular: `completadaEn` no nulo ⟺ estado actual es `esFinal`, y `asignadaAId` no nulo ⟹ `completadaEn` no nulo)
- [X] T014 [P] [US1] Crear `tests/e2e/sales/preparacion.spec.ts` (Playwright) con el recorrido completo: abrir `/sales/preparacion` sin configuración previa, ver 2 columnas por defecto, mover un pedido al estado final y verificar inicio/fin/responsable en el detalle del pedido

### Implementation for User Story 1

- [X] T015 [US1] Implementar el motor `src/sales/preparacion/servicios/mover-preparacion.ts`: compare-and-swap con `prisma.preparacionPedido.updateMany({ where: { id, estadoId: estadoEsperadoId } })` devolviendo `{ ok: false, motivo: "CONFLICTO" }` cuando `count === 0`, sellado de fechas y responsable según la tabla de transiciones, y creación de la fila de `PreparacionHistorial` en la misma transacción (research Decisión 2, hace pasar T012/T013)
- [X] T016 [US1] Publicar los eventos de dominio **después** del commit dentro de `mover-preparacion.ts`: `PreparacionIniciada` al sellar el inicio (una sola vez por preparación) y `PreparacionCompletada` al entrar al estado final, sin emitir nada en movimientos intermedios (constitución III, `contracts/eventos.md`)
- [X] T017 [P] [US1] Crear `src/eventos/contratos/preparacion-iniciada.event.ts` con `PreparacionIniciadaPayload` según `contracts/eventos.md`
- [X] T018 [P] [US1] Crear `src/eventos/contratos/preparacion-completada.event.ts` con `PreparacionCompletadaPayload` según `contracts/eventos.md`, incluyendo `avanceCompleto`
- [X] T019 [US1] Implementar en `src/sales/preparacion/queries.ts` la query `obtenerTableroPreparacion` con las columnas del flujo, las tarjetas agrupadas por estado, exclusión de pedidos en etapa final o de cancelación, y materialización previa de las preparaciones faltantes vía T011 — el cliente del pedido resuelve `contacto` del CRM o, si no hay, nombre y apellido del comprador guardados en el pedido (FR-021)
- [X] T020 [P] [US1] Implementar en `src/sales/preparacion/queries.ts` `obtenerConfiguracionPreparacion`, incluyendo el conteo `pedidosAsignados` por estado que la UI necesita para bloquear el borrado y exigir destino al desactivar
- [X] T021 [P] [US1] Implementar en `src/sales/preparacion/queries.ts` `obtenerActividadReciente` leyendo `PreparacionHistorial` ordenado por `creadoEn` descendente, con número de pedido, estado anterior, estado nuevo, usuario y momento
- [X] T022 [US1] Implementar `moverPreparacionAction(pedidoId, estadoDestinoId, estadoEsperadoId)` en `src/sales/preparacion/actions.ts`: `'use server'`, guarda `verificarAcceso(sesion, "preparacion", "modificar")`, validación Zod, delegación al motor, traducción del conflicto a un mensaje de negocio y `revalidatePath` de `/sales/preparacion`, `/sales/pedidos` y `/sales/pedidos/[id]`
- [X] T023 [US1] Implementar en `src/sales/preparacion/actions.ts` las acciones de configuración de estados: `crearEstadoPreparacionAction`, `actualizarEstadoPreparacionAction`, `reordenarEstadosPreparacionAction`, `eliminarEstadoPreparacionAction` (rechaza si el estado tiene pedidos) y `desactivarEstadoPreparacionAction(estadoId, estadoDestinoId)` (migra los pedidos en la misma transacción dejando historial con `tipo = AUTOMATICO`) — con las reglas de validación de `data-model.md`: un solo `esInicial`, un solo `esFinal`, `marcaInicio` en 0 o 1 estados, nombre único dentro del flujo
- [X] T024 [P] [US1] Crear `src/sales/preparacion/components/tarjeta-preparacion.tsx` (Client Component) mostrando número de pedido, cliente, hora, líneas con producto y cantidades, totales de unidades y productos, y la etapa de venta — con tokens semánticos (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`), sin hex hardcodeados
- [X] T025 [US1] Crear `src/sales/preparacion/components/tablero-kanban.tsx` con dnd-kit siguiendo el patrón de `src/crm/pipeline/components/pipeline-kanban-dinamico.tsx` (`DndContext`, `useDroppable` por columna, `useSortable` por tarjeta, overlay de arrastre) y reutilizando el contenedor de scroll horizontal de `src/crm/pipeline/components/kanban-scroll-container.tsx`; al soltar, envía el `estadoId` que la tarjeta tenía en pantalla como `estadoEsperadoId` (research Decisión 6)
- [X] T026 [US1] Manejar el conflicto de concurrencia en `tablero-kanban.tsx`: si la acción devuelve conflicto, revertir el movimiento optimista, mostrar aviso con `sonner` y refrescar con `router.refresh()` (FR-017, hace verificable el paso 4 del quickstart)
- [X] T027 [P] [US1] Crear `src/sales/preparacion/components/tablero-lista.tsx` como vista alternativa con la misma información que el kanban, usando el `DataTable` de `src/shared/ui/data-table`
- [X] T028 [P] [US1] Crear `src/sales/preparacion/components/actividad-reciente.tsx` renderizando el resultado de `obtenerActividadReciente` con el punto de color del estado destino
- [X] T029 [US1] Crear `src/sales/preparacion/components/panel-config-preparacion.tsx` con la sección de estados (crear, renombrar, color, marcas `esInicial`/`marcaInicio`/`esFinal`, reordenar, desactivar con estado destino, borrar bloqueado si tiene pedidos), siguiendo el patrón de `src/sales/flujo-venta/components/panel-config-etapas.tsx` y usando `<Form>` + `<FormField>`; si algún `<Select>` tiene `value` distinto de su etiqueta visible, pasar la prop `items` al `<Select>` raíz (ver `docs/selects.md`)
- [X] T030 [US1] Crear `src/app/sales/preparacion/page.tsx` como Server Component con `export const dynamic = "force-dynamic"`, guarda `verificarAcceso(sesion, "preparacion", "ver")` con redirección a `/acceso-denegado`, llamada a `asegurarFlujoPreparacion`, y `Promise.all` para tablero + actividad + configuración; el tablero se monta con `next/dynamic` para no cargar dnd-kit en el bundle inicial
- [X] T031 [P] [US1] Crear `src/app/sales/preparacion/loading.tsx` con skeleton de columnas, consistente con los skeletons ya usados en el proyecto
- [X] T032 [US1] Agregar el `EmptyState` del tablero en `src/app/sales/preparacion/page.tsx` para cuando no hay pedidos en el rango, distinguiendo "no hay nada que preparar" de "no hay resultados para estos filtros"

**Checkpoint**: el tablero funciona de punta a punta con estados configurables. US1 es demostrable y desplegable sola.

---

## Phase 4: User Story 2 - Saber desde Pedidos si algo ya está preparado (Priority: P1)

**Goal**: el estado de preparación visible en la lista y el detalle de pedidos, sin alterar nada para las instancias que no usan el módulo.

**Independent Test**: con pedidos en distintos estados, abrir la lista y verificar el chip diferenciado del badge de etapa; abrir un detalle y ver inicio, fin y responsable; abrir un pedido que nunca entró a preparación y verificar que la pantalla es idéntica a antes.

### Tests for User Story 2 ⚠️

- [X] T033 [P] [US2] Agregar a `tests/e2e/sales/preparacion.spec.ts` el caso de visibilidad: un pedido movido en el tablero muestra su chip en `/sales/pedidos` y sus fechas y responsable en el detalle
- [X] T034 [P] [US2] Agregar a `tests/e2e/sales/pedidos.spec.ts` el caso de no-regresión (FR-026): un pedido sin preparación renderiza la fila y el detalle exactamente como antes — sin chip, sin columna extra, sin espacio reservado

### Implementation for User Story 2

- [X] T035 [P] [US2] Crear `src/sales/preparacion/components/chip-estado-preparacion.tsx` — chip con punto de color, visualmente subordinado al badge de etapa, que renderiza `null` cuando el pedido no tiene preparación; vive en el módulo de preparación para que lista y detalle lo importen en vez de duplicar markup
- [X] T036 [US2] Agregar la relación `preparacion` a `incluirRelaciones` en `src/sales/pedidos/queries.ts` (línea 6) con `estado`, `iniciadaEn`, `completadaEn` y `asignadaA`, según `contracts/server-actions.md`
- [X] T037 [US2] Extender la interfaz `Pedido` en `src/sales/pedidos/types.ts` con `preparacion` opcional y nullable, sin romper los consumidores actuales
- [X] T038 [US2] Renderizar `<ChipEstadoPreparacion>` en la columna Estado de `src/sales/pedidos/components/lista-pedidos.tsx`, debajo del `EstadoBadge` de etapa y con menor peso visual (FR-024)
- [X] T039 [US2] Agregar el bloque "Preparación (armado)" a `src/app/sales/pedidos/[id]/page.tsx` con estado, inicio, fin y responsable, **separado** del bloque de Entrega y con etiquetas que no se confundan con el estado de entrega homónimo (FR-025, FR-036a, research Decisión 8)

**Checkpoint**: US1 y US2 funcionan de forma independiente. Quien atiende al cliente ya no necesita abrir otro módulo.

---

## Phase 5: User Story 3 - Controlar qué pedidos entran al tablero y cómo se ve (Priority: P2)

**Goal**: configuración de entrada por etapa, orden de columnas, rangos de fecha con contadores y buscador.

**Independent Test**: configurar que solo entren los pedidos en "Confirmado", verificar que uno en "Pendiente" no aparece y que al moverlo aparece; crear un pedido que nazca directamente en "Confirmado" y verificar que también aparece; cambiar orden de columnas y rango por defecto y verificar que persisten.

### Tests for User Story 3 ⚠️

- [X] T040 [P] [US3] Crear `src/sales/preparacion/utils/rangos.test.ts` (Vitest) para la resolución de "esta semana" y de los tres contadores, verificando que "hoy" coincide con el que usa el listado de pedidos en la zona horaria de negocio (research Decisión 7)
- [X] T041 [P] [US3] Agregar a `tests/e2e/sales/preparacion.spec.ts` el caso crítico de entrada: un pedido **creado directamente** en una etapa de entrada (no movido hacia ella) aparece en el tablero — es el escenario que falla si la pertenencia se resolviera con un hook en el motor de etapas (research Decisión 1)
- [X] T042 [P] [US3] Agregar a `tests/e2e/sales/preparacion.spec.ts` el caso de pedido sin `fechaEntrega`: sigue visible en la agrupación "Sin fecha" en cualquier rango (FR-019)

### Implementation for User Story 3

- [X] T043 [US3] Crear `src/sales/preparacion/utils/rangos.ts` resolviendo los cuatro rangos sobre `fechaEntrega` importando directamente `rangoDiaEnZona`, `fechaYMDEnZona` y `sumarDias` de `src/sales/pedidos/utils/fechas-zona.ts` (sin barrel files), e implementando "esta semana" sobre esas primitivas
- [X] T044 [US3] Extender `obtenerTableroPreparacion` en `src/sales/preparacion/queries.ts` con el filtro de rango, la agrupación `sinFecha` y los tres contadores calculados sobre los rangos fijos (independientes del filtro activo, para que cada pestaña coincida con lo que muestra al abrirse)
- [X] T045 [US3] Extender `obtenerTableroPreparacion` en `src/sales/preparacion/queries.ts` con la búsqueda por número de pedido, nombre de cliente (contacto del CRM o comprador del pedido) y nombre de producto, manteniendo la separación por columnas en los resultados (FR-020)
- [X] T046 [US3] Aplicar en `obtenerTableroPreparacion` (`src/sales/preparacion/queries.ts`) la configuración de etapas de entrada: usar las `FlujoPreparacionEntrada` configuradas o, si no hay ninguna, el default de "etapas no finales ni de cancelación", filtrando siempre por `flujoVentaEtapa.activo` (data-model, reglas de `FlujoPreparacionEntrada`)
- [X] T047 [US3] Implementar `configurarEtapasEntradaAction(etapaIds)` y `actualizarPreferenciasTableroAction(datos)` en `src/sales/preparacion/actions.ts`, con guarda de permiso, validación Zod y `revalidatePath("/sales/preparacion")`
- [X] T048 [US3] Agregar al `panel-config-preparacion.tsx` la sección "Qué pedidos entran" (selección múltiple de etapas del flujo de venta), la de orden de columnas y la de agrupación/rango por defecto — dejando explícito en la UI que son dos cosas distintas: qué pedidos entran vs. qué columnas tiene el tablero
- [X] T049 [US3] Mostrar el aviso de entradas inválidas en `panel-config-preparacion.tsx` usando `entradasInvalidas` de la configuración, para que una etapa desactivada o eliminada no rompa el tablero sino que se explique (FR-009)
- [X] T050 [P] [US3] Crear `src/sales/preparacion/components/preparacion-tabs-rango.tsx` con las pestañas Hoy / Mañana / Esta semana / Personalizado, sus contadores, y el selector de rango personalizado; el estado de la pestaña va en la URL (searchParams) para que sea compartible y sobreviva al refresh

**Checkpoint**: el tablero es manejable con volumen real y la configuración cubre lo que la maqueta planteaba.

---

## Phase 6: User Story 4 - Controlar qué ítems están preparados y qué falta (Priority: P3)

**Goal**: avance por línea con cantidades parciales, resumen consolidado por producto y agrupación por producto.

**Independent Test**: en un pedido de tres productos marcar dos completos y uno parcial, verificar el avance en la tarjeta; cambiar la agrupación a "Por producto" y verificar que el resumen consolida unidades requeridas y preparadas de todo el rango.

### Tests for User Story 4 ⚠️

- [X] T051 [P] [US4] Crear `src/sales/preparacion/utils/avance.test.ts` (Vitest) para el avance derivado: una línea está completa cuando `cantidadPreparada === cantidad`; el pedido está completo cuando todas sus líneas lo están; agregar una línea nueva devuelve el pedido a incompleto (FR-030)
- [X] T052 [P] [US4] Agregar a `src/sales/preparacion/utils/avance.test.ts` la validación de techo: `cantidadPreparada > cantidad` es inválido y `0` significa sin avance (FR-029)
- [X] T053 [P] [US4] Agregar a `tests/e2e/sales/preparacion.spec.ts` el recorrido de ítems: marcar dos líneas completas y una parcial, verificar que el pedido no figura como completo, y que el resumen por producto consolida las unidades del rango

### Implementation for User Story 4

- [X] T054 [P] [US4] Crear `src/sales/preparacion/utils/avance.ts` con el cálculo derivado de avance por línea y por pedido — **sin** persistir ningún campo de avance en `Pedido`, para no tener un segundo lugar que pueda desincronizarse (data-model, `PedidoLinea`)
- [X] T055 [US4] Implementar `registrarAvanceLineaAction(pedidoLineaId, cantidadPreparada)` en `src/sales/preparacion/actions.ts`: guarda de permiso, validación Zod, verificación en servidor de `0 <= cantidadPreparada <= cantidad` de la línea, sellado de `preparadaEn`/`preparadaPorId` al pasar de cero y limpieza al volver a cero, y `revalidatePath` de `/sales/preparacion` y `/sales/pedidos/[id]`
- [X] T056 [P] [US4] Crear `src/eventos/contratos/linea-pedido-preparada.event.ts` con `LineaPedidoPreparadaPayload` según `contracts/eventos.md`
- [X] T057 [US4] Emitir `LineaPedidoPreparada` desde `registrarAvanceLineaAction` **solo** cuando la línea alcanza su cantidad completa y después del commit — los avances parciales no emiten evento (`contracts/eventos.md`, "Lo que NO emite evento")
- [X] T058 [US4] Implementar `obtenerResumenPorProducto` en `src/sales/preparacion/queries.ts` con `groupBy` sobre las líneas de los pedidos del rango, sumando unidades requeridas y preparadas, y agrupando por descripción las líneas sin producto del catálogo
- [X] T059 [P] [US4] Crear `src/sales/preparacion/components/resumen-por-producto.tsx` mostrando por producto las unidades requeridas y las ya preparadas del rango seleccionado (lista de picking)
- [X] T060 [US4] Agregar a `src/sales/preparacion/components/tarjeta-preparacion.tsx` el control de avance por línea (marcar completa y registrar cantidad parcial), reflejando el avance en la tarjeta sin recargar toda la página
- [X] T061 [US4] Implementar la agrupación "Por producto" en `src/sales/preparacion/components/tablero-kanban.tsx` y `tablero-lista.tsx`, conservando las mismas columnas de estado (FR-032)
- [X] T062 [US4] Conectar el resumen por producto en `src/app/sales/preparacion/page.tsx` sumándolo al `Promise.all` existente, sin agregar una segunda ronda de consultas
- [X] T063 [US4] Verificar y, si hace falta, ajustar el recálculo de avance al editar un pedido en `src/sales/pedidos/actions.ts`: agregar una línea la crea con `cantidadPreparada = 0` (el pedido vuelve a incompleto) y quitar una línea elimina su avance, en ambos casos sin borrar el historial de preparación (FR-030)

**Checkpoint**: las cuatro historias funcionan de forma independiente. El módulo cubre el control real de lo preparado.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T064 [P] Documentar los 3 eventos nuevos en `docs/eventos.md` con payload y disparador, siguiendo el formato de los eventos ya documentados (regla 7 del proyecto)
- [X] T065 [P] Revisar los componentes de `src/sales/preparacion/components/` en móvil y en dark mode: scroll horizontal usable, tarjetas legibles, y ningún color hardcodeado — solo tokens semánticos de `src/app/globals.css`
- [X] T066 Verificar que `next/dynamic` efectivamente mantiene dnd-kit fuera del bundle inicial de las rutas que no usan el tablero, comparando la salida de `npm run build` con la línea base de T002
- [ ] T067 Ejecutar la validación completa de [quickstart.md](./quickstart.md) — los 9 recorridos manuales, con atención al recorrido 5 (pedido creado directamente en etapa de entrada) y al 6 (no-regresión de la lista de pedidos)
- [X] T068 Cierre: `npm run build`, `npm run test:unit` y `npx playwright test tests/e2e/sales/` en verde, y confirmación de que el resultado se reporta tal cual (si algo falla, se informa con su salida, no se omite)
- [ ] T069 Confirmar con el usuario qué rol concreto usa el equipo de armado y ajustar la matriz `PERMISOS` en `src/shared/auth/permisos.ts` si el default propuesto en T005 no corresponde (research Decisión 9 — único punto que quedó abierto a propósito)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias. T001 bloquea absolutamente todo lo demás
- **Foundational (Phase 2)**: depende de Setup. **BLOQUEA todas las historias**
- **User Stories (Phase 3-6)**: todas dependen de Foundational
  - US1 (P1) y US2 (P1) pueden ir en paralelo si hay dos personas, con la salvedad de abajo
  - US3 (P2) y US4 (P3) dependen de US1 en la práctica (extienden su query y sus componentes)
- **Polish (Phase 7)**: depende de las historias que se decidan entregar

### User Story Dependencies

- **US1 (P1)**: solo depende de Foundational. Es el MVP
- **US2 (P1)**: solo depende de Foundational para el esquema, pero el chip no muestra nada hasta que exista al menos un pedido con preparación — testeable de forma independiente creando ese registro, o simplemente después de US1
- **US3 (P2)**: extiende `obtenerTableroPreparacion` (T019) y `panel-config-preparacion.tsx` (T029), ambos de US1
- **US4 (P3)**: extiende `tarjeta-preparacion.tsx` (T024) y la página del tablero (T030), ambos de US1

### Within Each User Story

- Los tests se escriben primero y deben fallar antes de implementar
- Esquema → servicios → queries → actions → componentes → página
- El motor de transición (T015) antes de la acción que lo usa (T022)
- Los contratos de evento (T017, T018, T056) pueden ir en paralelo con el resto

### Parallel Opportunities

- **Phase 2**: T005, T006, T007 y T008 tocan archivos distintos y van en paralelo. T003 y T004 son secuenciales entre sí (un solo `schema.prisma`, y la migración necesita el esquema)
- **Phase 3**: los tres tests (T012, T013, T014) en paralelo; después T017/T018 (contratos) y T020/T021 (queries independientes) en paralelo; T024, T027, T028 y T031 son componentes en archivos distintos
- **Phase 4**: T033 y T034 en paralelo; T035 es independiente de los cambios en pedidos
- **Phase 5**: T040, T041 y T042 en paralelo; T050 es independiente del resto
- **Phase 6**: T051, T052 y T053 en paralelo; T054, T056 y T059 en archivos distintos
- **Conflictos a evitar**: T023, T047 y T055 escriben el mismo `actions.ts`; T019, T044, T045, T046 y T058 el mismo `queries.ts`; T029, T048 y T049 el mismo `panel-config-preparacion.tsx`. Nunca marcar esos en paralelo entre sí

---

## Parallel Example: User Story 1

```bash
# Tests primero, los tres juntos:
Task: "Vitest de sellado de fechas en src/sales/preparacion/servicios/mover-preparacion.test.ts"
Task: "Vitest de invariantes en src/sales/preparacion/servicios/mover-preparacion.test.ts"
Task: "E2E del recorrido del tablero en tests/e2e/sales/preparacion.spec.ts"

# Después del motor (T015), en paralelo:
Task: "Contrato PreparacionIniciada en src/eventos/contratos/preparacion-iniciada.event.ts"
Task: "Contrato PreparacionCompletada en src/eventos/contratos/preparacion-completada.event.ts"
Task: "obtenerConfiguracionPreparacion en src/sales/preparacion/queries.ts"
Task: "obtenerActividadReciente en src/sales/preparacion/queries.ts"

# Componentes en archivos distintos, en paralelo:
Task: "tarjeta-preparacion.tsx"
Task: "tablero-lista.tsx"
Task: "actividad-reciente.tsx"
Task: "loading.tsx"
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1: Setup (T001-T002) — sin `npm install` no arranca nada
2. Phase 2: Foundational (T003-T011) — bloquea todo
3. Phase 3: US1 (T012-T032)
4. **PARAR Y VALIDAR**: recorridos 1 a 4 del quickstart
5. Desplegable y demostrable: el tablero ya sirve para operar

### Incremental Delivery

1. Setup + Foundational → base lista
2. US1 → tablero operativo → **MVP**
3. US2 → el estado llega a quien atiende al cliente (recorrido 6 del quickstart)
4. US3 → el tablero aguanta volumen real (recorridos 5 y 8)
5. US4 → control ítem por ítem y lista de picking (recorrido 7)

Cada historia agrega valor sin romper la anterior. Si el control de lo preparado resulta más urgente que la
configuración de entrada, US4 y US3 se pueden intercambiar — US4 depende de US1, no de US3 (ver spec,
cierre del Camino sugerido).

### Riesgos a vigilar durante la implementación

- **El caso que más fácil se rompe** es el pedido creado directamente en una etapa de entrada (T041). Si en
  algún momento se decide "optimizar" moviendo la materialización a un hook del motor de etapas, ese test
  falla — y debe fallar
- **La no-regresión de la lista de pedidos** (T034) es el contrato con las instancias que no usan el módulo:
  `preparacion` nula MUST renderizar como hoy
- **Los dos "preparando"** (preparación vs. estado de entrega) son una decisión consciente del usuario. T039
  es la mitigación acordada; no sincronizar los ejes por iniciativa propia

---

## Notes

- Total: **69 tareas** + 6 del addendum de implementación
- Las tareas `[P]` tocan archivos distintos y no tienen dependencias pendientes
- Cada historia es completable y testeable por separado
- Verificar que los tests fallan antes de implementar
- Commitear por tarea o por grupo lógico
- Se puede parar en cualquier checkpoint y validar la historia de forma aislada

---

## Addendum de implementación (2026-09-17)

Tareas agregadas durante la ejecución, por hallazgos que el plan no había previsto:

- [X] T070 Aplicar la migración con `prisma migrate deploy` (no `migrate dev`) tras auditar el SQL generado: la base es Supabase con datos reales y `migrate dev` puede proponer un reset ante drift. Historial verificado antes (74 migraciones, última coincidente) y datos verificados después
- [X] T071 Mostrar los pedidos con entrega vencida en cualquier rango, marcados como atrasados, con contador propio — `src/sales/preparacion/utils/rangos.ts` (`estaAtrasado`, `filtroAtrasados`, `inicioDeHoyEnZona`), `queries.ts`, `tarjeta-preparacion.tsx` y `preparacion-tabs-rango.tsx`. **Sin esto el tablero se veía vacío**: al validar contra datos reales, 45 de 47 pedidos abiertos tenían entrega vencida y no caían en ningún rango (FR-019a, nuevo)
- [X] T072 Acotar `cantidadPreparada` al editar una línea de pedido si la cantidad baja por debajo de lo ya preparado, en `src/sales/pedidos/actions.ts` — evitaba dejar "preparado más de lo pedido" en base
- [X] T073 Agregar 6 helpers de datos para los E2E en `tests/helpers/db-worker.ts` y `tests/helpers/db.ts`, y el script `test:e2e:preparacion` en `package.json`
- [X] T074 Frontera cliente `src/sales/preparacion/components/tablero-cliente.tsx`: `ssr: false` no se puede declarar desde un Server Component, así que el dynamic import del kanban vive en un Client Component
- [X] T075 Registrar los 3 eventos nuevos en `src/eventos/mapa.ts` (el plan solo mencionaba `catalogo.ts`; sin el mapa de payloads el publicador no compila)
