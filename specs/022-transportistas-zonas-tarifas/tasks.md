---
description: "Task list for feature implementation"
---

# Tasks: Gestión integral de transportistas — zonas, tarifas y condiciones

**Input**: Design documents from `/specs/022-transportistas-zonas-tarifas/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Incluidos — el plan (Constitution Check, Principio V) compromete tests Vitest e2e proporcionales al riesgo financiero/de datos de este refactor, y el spec pide explícitamente pruebas unitarias e integración (sección "Pruebas requeridas").

**Organization**: Tareas agrupadas por historia de usuario (spec.md): US1/US2 = P1, US3/US4/US5 = P2, US6/US7 = P3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: Historia de usuario a la que pertenece (US1-US7)
- Cada tarea incluye la ruta de archivo exacta (ver [plan.md](plan.md) → Project Structure)

---

## Phase 1: Setup

- [ ] T001 Confirmar rama `022-transportistas-zonas-tarifas` activa, `npm install` al día, y que `npm run db:migrate`/`npx prisma migrate status` puede conectar a la base de datos de desarrollo (sin aplicar todavía ninguna migración de esta feature)

**Checkpoint**: Entorno listo

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, migración, permisos y el motor de resolución de zona son compartidos por las 7 historias — ninguna puede empezar antes de cerrar esta fase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T002 Modificar `prisma/schema.prisma`: extender `Transportista` con `personaContacto String?`, `telefono String?`, `correoElectronico String?`, `notasInternas String?` (FR-004)
- [ ] T003 Modificar `prisma/schema.prisma`: agregar modelos `ZonaEntrega` y `ZonaEntregaUbicacion` (ver [data-model.md](data-model.md))
- [ ] T004 Modificar `prisma/schema.prisma`: agregar modelo `ServicioTransportista` con `@@unique([transportistaId, nombre])`
- [ ] T005 Modificar `prisma/schema.prisma`: agregar modelo `TarifaTransportistaZona` con `@@unique([transportistaId, zonaEntregaId, servicioTransportistaId])` (FR-026)
- [ ] T006 Modificar `prisma/schema.prisma`: agregar modelo `CondicionesTransportista` (1-1 con `Transportista`, `@unique` en `transportistaId`)
- [ ] T007 Modificar `prisma/schema.prisma`: agregar enum `TipoEntidadHistorialTransportista` y modelo `TransportistaHistorial` (mismo shape que `PedidoHistorial`, ver research.md Decisión 7)
- [ ] T008 Modificar `prisma/schema.prisma`: extender `EntregaCotizacion` y `EntregaPedido` con `zonaEntregaId`, `zonaAsignadaManualmente`, `servicioTransportistaId`, `tarifaTransportistaZonaId`, `costoInternoEnvio`, `costoEnvioConfirmado` (default `true`), `costoManualAutorizadoPorId`, `corregimiento`, `sectorOCodigoPostal`; quitar la relación `coberturaGeografica` de `Transportista` y eliminar el modelo `TransportistaCoberturaGeografica`
- [ ] T009 Modificar `prisma/schema.prisma`: agregar `ConfiguracionEmpresa.permiteConvertirSinConfirmarCostoEnvio Boolean @default(false)` (FR-040)
- [ ] T010 Crear `prisma/migrations/<timestamp>_transportistas_zonas_tarifas/migration.sql` (depende de T002-T009): crear las tablas nuevas; backfill — por cada fila de `TransportistaCoberturaGeografica`, crear una `ZonaEntrega` (nombre = nombre del `EstadoProvincia`) + su `ZonaEntregaUbicacion` (paisId, provinciaEstado = ese nombre) + un `ServicioTransportista` "Estándar" (si no existe ya para ese transportista) + una `TarifaTransportistaZona` con `costoInterno = precioCliente = costoEnvio` original; agregar columnas nuevas a `EntregaCotizacion`/`EntregaPedido`/`ConfiguracionEmpresa`; recién al final, `DROP TABLE "TransportistaCoberturaGeografica"` (ver research.md Decisión 1, quickstart.md Escenario 6)
- [ ] T011 Aplicar la migración (`npx prisma migrate deploy`) y regenerar el cliente Prisma (`npx prisma generate`); confirmar en `src/generated/prisma` que los 6 modelos nuevos existen y `TransportistaCoberturaGeografica` ya no (depende de T010)
- [ ] T012 [P] Modificar `src/shared/auth/permisos.ts`: agregar `"transportistas-costos"` a `Modulo` y al mapa `PERMISOS` (default `rw` para `OWNER`/`ADMIN`, `none` para el resto, ver research.md Decisión 8)
- [ ] T013 Modificar `src/shared/entregas/resolver-costo-envio.ts` (depende de T011): agregar `obtenerCandidatosEnvioPorZona(destino)` — nueva función pura de consulta que resuelve destino (país/provinciaEstado/distritoCiudad/corregimiento/sectorOCodigoPostal) contra `ZonaEntregaUbicacion` (comparación por slug, nivel vacío = comodín, ver research.md Decisión 2/3) y devuelve la lista completa de `TarifaTransportistaZona` candidatas (activas y vigentes) sin colapsar
- [ ] T014 Modificar `src/shared/entregas/resolver-costo-envio.ts` (depende de T013): reescribir la "Fuente 1: Transportista" dentro de `resolverCostoEnvio` para usar `obtenerCandidatosEnvioPorZona` en vez de `TransportistaCoberturaGeografica`/`EstadoProvincia`, preservando sin cambios el contrato de `decidirCoincidenciaCosto` (research.md Decisión 4) — actualizar `resolver-costo-envio.test.ts`/`.integration.test.ts` reemplazando los casos de país+estado por casos de zona
- [ ] T015 [P] Crear `src/sales/transportistas/zonas/schema.ts`: `CrearZonaEntregaSchema`, `EditarZonaEntregaSchema`, `UbicacionZonaSchema` (país obligatorio, resto opcional)
- [ ] T016 [P] Crear `src/sales/transportistas/tarifas/schema.ts`: `CrearTarifaSchema`/`EditarTarifaSchema` (`costoInterno`/`precioCliente` `>= 0`), `CambioMasivoSchema`
- [ ] T017 [P] Crear `src/sales/transportistas/condiciones/schema.ts`: `CondicionesTransportistaSchema`
- [ ] T018 Modificar `src/sales/transportistas/schema.ts`: extender `CrearTransportistaSchema`/`EditarTransportistaSchema` con `personaContacto`/`telefono` (formato)/`correoElectronico` (formato)/`notasInternas`, todos opcionales
- [ ] T019 Modificar `src/sales/transportistas/types.ts`: actualizar tipos para el `Transportista` extendido y las entidades nuevas

**Checkpoint**: Schema, migración, permiso financiero y motor de resolución listos — las 7 historias pueden empezar

---

## Phase 3: User Story 1 - Configurar un transportista completo: información, zonas y tarifas (Priority: P1) 🎯 MVP

**Goal**: Crear un transportista, completar su información de contacto, y configurar zonas con tarifas (costo/precio/margen) por servicio.

**Independent Test**: Crear un transportista, completar info, crear una zona con 2 ubicaciones, crear tarifas Estándar y Express con costo/precio distintos, verificar margen calculado y rechazo de tarifa duplicada.

### Tests for User Story 1

- [ ] T020 [P] [US1] Tests Vitest en `src/sales/transportistas/zonas/actions.test.ts` (archivo nuevo): crear zona con varias ubicaciones; rechaza nombre de zona duplicado en la instancia; buscar zonas por nombre
- [ ] T021 [P] [US1] Tests Vitest en `src/sales/transportistas/tarifas/actions.test.ts` (archivo nuevo): crea tarifa y calcula margen `precioCliente - costoInterno`; rechaza costo/precio negativos; advierte (sin bloquear) si `precioCliente < costoInterno`; rechaza tarifa duplicada (mismo transportista+zona+servicio); elimina solo si nunca fue usada, si no, solo desactiva; duplicar tarifa como copia editable

### Implementation for User Story 1

- [ ] T022 [US1] Crear `src/sales/transportistas/zonas/actions.ts`: `crearZonaEntrega`, `editarZonaEntrega`, `eliminarZonaEntrega` (permiso `"transportistas"` `modificar`; elimina solo si ninguna tarifa la referencia)
- [ ] T023 [US1] Crear `src/sales/transportistas/zonas/queries.ts`: `listarZonasEntrega(instanciaId, busqueda?)` (FR-013)
- [ ] T024 [US1] Crear `src/sales/transportistas/tarifas/actions.ts`: `crearTarifa`, `editarTarifa`, `duplicarTarifa`, `toggleTarifa`, `eliminarTarifa` (bloqueado si `id` aparece en `EntregaCotizacion`/`EntregaPedido`), `aplicarCambioMasivo` (permiso `"transportistas"` `modificar`; cada mutación registra `TransportistaHistorial{entidadTipo: TARIFA}`)
- [ ] T025 [US1] Crear `src/sales/transportistas/tarifas/queries.ts`: `listarTarifas(transportistaId)` (incluye flag `usada` precalculado para habilitar/deshabilitar "Eliminar"), `obtenerPromedioTarifas(transportistaId)` (FR-022)
- [ ] T026 [US1] Modificar `src/sales/transportistas/actions.ts`: corregir `crearTransportista`/`editarTransportista`/`toggleTransportista` para validar `requirePermisoAction("transportistas", ...)` en vez de `"configuracion"`; `crearTransportista` siembra 3 `ServicioTransportista` (Estándar/Express/Personalizado) + una fila `CondicionesTransportista` con valores por defecto; `editarTransportista` acepta los campos de contacto nuevos; ambas registran `TransportistaHistorial{entidadTipo: TRANSPORTISTA}`
- [ ] T027 [US1] Modificar `src/sales/transportistas/queries.ts`: extender `obtenerTransportistas`/`obtenerTransportista` con los campos de contacto y un conteo de zonas activas (para el encabezado del panel)
- [ ] T028 [US1] Crear `src/app/sales/transportistas/[id]/page.tsx`: Server Component — carga transportista + zonas + tarifas + condiciones, verifica `verificarAcceso(sesion, "transportistas", "ver")`, renderiza `PanelTransportista`
- [ ] T029 [US1] Crear `src/sales/transportistas/components/panel-transportista.tsx`: encabezado (nombre, tipo, badge de estado, "N zonas configuradas"), botón "Volver" (`Link` a `/sales/transportistas`), botón "Guardar cambios", `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` para Información/Zonas y tarifas/Condiciones (FR-003)
- [ ] T030 [US1] Crear `src/sales/transportistas/components/seccion-informacion-transportista.tsx`: formulario de los campos de la pestaña Información + botón "Desactivar transportista" (FR-004/FR-008)
- [ ] T031 [US1] Modificar `src/sales/transportistas/components/dialog-transportista.tsx`: recortar a solo `nombre`/`tipo`/`estado` (FR-001); al guardar, redirige a `/sales/transportistas/[id]` en vez de cerrar el dialog
- [ ] T032 [US1] Modificar `src/sales/transportistas/components/lista-transportistas.tsx`: quitar la edición inline (ya no abre `DialogTransportista tipo="editar"`), cada fila enlaza a `/sales/transportistas/[id]`
- [ ] T033 [US1] Crear `src/sales/transportistas/components/seccion-zonas-tarifas.tsx`: buscador de zonas + botón "Agregar zona"; tabla editable (Zona · Servicio · Costo · Precio cliente · Margen · Entrega · Estado · Acciones) con edición inline, duplicar, activar/desactivar, eliminar (deshabilitado si `usada`); acción "Aplicar a varias zonas"; tarjetas KPI de costo/margen promedio (FR-014 a FR-022)
- [ ] T034 [US1] Crear `src/sales/transportistas/components/dialog-zona-entrega.tsx`: crear una `ZonaEntrega` (con sus ubicaciones) sin salir del flujo de configuración de tarifas (FR-012)
- [ ] T035 [US1] Modificar `src/app/sales/transportistas/page.tsx`: quitar el dialog de edición y la cobertura embebida del listado (ahora viven en el panel `[id]`)
- [ ] T036 [US1] Eliminar `src/sales/transportistas/components/seccion-cobertura-geografica.tsx` (retirado, research.md Decisión 1)

**Checkpoint**: User Story 1 funcional e independientemente verificable — MVP

---

## Phase 4: User Story 2 - Encontrar y usar automáticamente el transportista correcto al crear una cotización o pedido (Priority: P1)

**Goal**: Resolver automáticamente la zona desde el destino, listar opciones ordenadas por precio, permitir selección manual, y manejar el caso "sin cobertura" sin bloquear.

**Independent Test**: Con 2 transportistas configurados en la misma zona a precios distintos, crear una cotización con un destino en esa zona y verificar que ambas opciones aparecen ordenadas por precio; cambiar la zona manualmente y verificar el registro de auditoría; destino sin zona → "Costo de entrega por confirmar" sin bloqueo; bloqueo de conversión a pedido sin confirmar.

### Tests for User Story 2

- [ ] T037 [P] [US2] Tests Vitest adicionales en `src/shared/entregas/resolver-costo-envio.test.ts` para `obtenerCandidatosEnvioPorZona`: comodines por nivel, varias zonas coincidentes, exclusión de tarifas inactivas o fuera de vigencia
- [ ] T038 [P] [US2] Tests Vitest en `src/sales/cotizaciones/actions.test.ts`: aplica una tarifa configurada a la cotización; acepta costo manual con permiso `"transportistas-costos"`; marca "por confirmar" sin bloquear el guardado; bloquea `aprobarCotizacion` si `costoEnvioConfirmado = false` salvo `permiteConvertirSinConfirmarCostoEnvio`

### Implementation for User Story 2

- [ ] T039 [US2] Crear `obtenerOpcionesEnvioAction(destino)` en `src/sales/transportistas/tarifas/queries.ts` (agregar a T025, mismo archivo): wrapper client-callable de `obtenerCandidatosEnvioPorZona`, resultado ordenado de menor a mayor precio (FR-036)
- [ ] T040 [US2] Modificar `src/sales/cotizaciones/schema.ts`: agregar `zonaEntregaId?`, `zonaAsignadaManualmente?`, `servicioTransportistaId?`, `tarifaTransportistaZonaId?`, `costoManual?`, `costoEnvioConfirmado?` al schema de entrega de la cotización
- [ ] T041 [US2] Modificar `src/sales/cotizaciones/actions.ts`: al guardar, si viene `tarifaTransportistaZonaId` copia `costoInterno`→`costoInternoEnvio` y `precioCliente`→`costoEnvio`; si viene `costoManual` (requiere `"transportistas-costos"` `modificar`) lo usa y registra `TransportistaHistorial{entidadTipo: COSTO_MANUAL}`; si `zonaAsignadaManualmente` registra `TransportistaHistorial{entidadTipo: ZONA_MANUAL}`; `aprobarCotizacion` exige `costoEnvioConfirmado = true` salvo `ConfiguracionEmpresa.permiteConvertirSinConfirmarCostoEnvio`
- [ ] T042 [US2] Modificar `src/configuracion/empresa/schema.ts` y `actions.ts`: agregar `permiteConvertirSinConfirmarCostoEnvio`
- [ ] T043 [US2] Modificar `src/sales/cotizaciones/components/form-cotizacion.tsx`: selector de zona (badge "detectada"/"manual", llama `obtenerOpcionesEnvioAction`), selector de transportista+servicio por las opciones resueltas, toggle "Costo por confirmar", campo de costo manual (visible solo con permiso)
- [ ] T044 [US2] Escenario Playwright en `tests/e2e/sales/cotizaciones.spec.ts`: crear cotización con destino cubierto → opciones ordenadas por precio; destino no cubierto → "por confirmar"; intento de conversión sin confirmar → bloqueado (ver [quickstart.md](quickstart.md) Escenario 2)

**Checkpoint**: User Stories 1 y 2 funcionan de forma independiente y en conjunto — ahora el refactor entrega valor de negocio real (costos usados automáticamente en el flujo de venta)

---

## Phase 5: User Story 3 - Conservar los valores de envío usados al convertir una cotización en pedido (Priority: P2)

**Goal**: El pedido guarda una copia inmutable del envío; cambios posteriores a la tarifa no lo afectan.

**Independent Test**: Convertir una cotización con tarifa asignada en pedido; editar/desactivar esa tarifa; verificar que el pedido sigue mostrando los valores originales.

### Tests for User Story 3

- [ ] T045 [P] [US3] Tests Vitest en `src/sales/cotizaciones/services/generar-pedido-desde-cotizacion.service.test.ts` (extender si ya existe): el snapshot de envío se copia íntegro al pedido; editar o desactivar la tarifa original después no altera el pedido ya creado (FR-047)

### Implementation for User Story 3

- [ ] T046 [US3] Modificar `src/sales/cotizaciones/services/generar-pedido-desde-cotizacion.service.ts`: en el bloque `entrega: cotizacion.entrega ? { create: {...} } : undefined`, copiar `zonaEntregaId`, `zonaAsignadaManualmente`, `servicioTransportistaId`, `tarifaTransportistaZonaId`, `costoInternoEnvio`, `costoEnvioConfirmado`, `costoManualAutorizadoPorId`, `corregimiento`, `sectorOCodigoPostal` (FR-046)
- [ ] T047 [US3] Modificar `src/sales/pedidos/components/seccion-entrega.tsx`: mostrar el snapshot completo en modo lectura (zona, servicio, tiempo, precio; costo interno/margen solo con permiso, ver US5) (FR-048)
- [ ] T048 [US3] Escenario Playwright en `tests/e2e/sales/pedidos.spec.ts`: convertir cotización con tarifa asignada, editar la tarifa, verificar que el pedido no cambió (ver [quickstart.md](quickstart.md) Escenario 3)

**Checkpoint**: Historias 1-3 completas — integridad de datos garantizada

---

## Phase 6: User Story 4 - Consultar las condiciones operativas del transportista desde cotizaciones y pedidos (Priority: P2)

**Goal**: Configurar condiciones generales (operación/restricciones/cobro) y poder consultarlas sin salir de la cotización/pedido.

**Independent Test**: Configurar condiciones completas para un transportista, seleccionarlo en una cotización, y consultar sus condiciones desde ahí.

### Tests for User Story 4

- [ ] T049 [P] [US4] Tests Vitest en `src/sales/transportistas/condiciones/actions.test.ts` (archivo nuevo): guarda condiciones y registra `TransportistaHistorial{entidadTipo: CONDICIONES}`; valores por defecto quedan sembrados al crear el transportista (verifica lo hecho en T026)

### Implementation for User Story 4

- [ ] T050 [US4] Crear `src/sales/transportistas/condiciones/actions.ts`: `guardarCondicionesTransportista` (upsert 1-1, permiso `"transportistas"` `modificar`)
- [ ] T051 [US4] Crear `src/sales/transportistas/condiciones/queries.ts`: `obtenerCondicionesTransportista(transportistaId)`
- [ ] T052 [US4] Crear `src/sales/transportistas/components/seccion-condiciones-transportista.tsx`: 3 bloques (Operación/Restricciones/Cobro y coordinación) con switches, selector de días, selects e inputs (FR-029/030/031)
- [ ] T053 [US4] Modificar `src/sales/cotizaciones/components/form-cotizacion.tsx` y `src/sales/pedidos/components/form-entrega.tsx`: agregar un ícono/popover de solo lectura con las condiciones del transportista seleccionado (FR-032)

**Checkpoint**: Historias 1-4 completas

---

## Phase 7: User Story 5 - Proteger los costos internos y márgenes según permisos (Priority: P2)

**Goal**: Costo interno y margen solo visibles con el permiso `"transportistas-costos"`, en todas las pantallas (tarifas, cotización, pedido).

**Independent Test**: Con un usuario sin el permiso, verificar que ve el precio al cliente pero no el costo interno ni el margen en las 3 pantallas; con un usuario con el permiso, verificar que ve ambos.

### Tests for User Story 5

- [ ] T054 [P] [US5] Tests Vitest: `listarTarifas`/consulta de cotización/consulta de pedido no incluyen `costoInterno`/margen cuando el llamador no tiene `"transportistas-costos"` `ver` (extender los `queries.test.ts` de tarifas, cotizaciones y pedidos)

### Implementation for User Story 5

- [ ] T055 [US5] Modificar `src/sales/transportistas/tarifas/queries.ts` y `components/seccion-zonas-tarifas.tsx`: ocultar columnas Costo/Margen (y el valor promedio de costo) cuando el usuario no tiene `"transportistas-costos"` `ver` (FR-042, FR-050)
- [ ] T056 [US5] Modificar `form-cotizacion.tsx`/`form-entrega.tsx`: ocultar costo interno/margen y deshabilitar el campo de costo manual sin `"transportistas-costos"` `modificar`
- [ ] T057 [US5] Modificar `seccion-entrega.tsx` (pedido): ocultar costo interno/margen sin el permiso (completa T047)

**Checkpoint**: Historias 1-5 completas — datos financieros protegidos en todas las superficies

---

## Phase 8: User Story 6 - Auditar cambios sensibles del módulo de transportistas (Priority: P3)

**Goal**: Poder consultar quién cambió qué, cuándo y con qué valores. Las escrituras de auditoría ya se agregaron en T024/T026/T041/T050 (cada acción que modifica tarifa/transportista/costo/zona/condiciones registra su propia fila) — esta fase agrega la lectura y la verificación integral de que todo quedó bien registrado.

**Independent Test**: Editar una tarifa, desactivar un transportista, y cambiar manualmente una zona en una cotización; verificar las 3 acciones en el historial con usuario/fecha/valores antes-después.

### Tests for User Story 6

- [ ] T058 [P] [US6] Tests Vitest de integración: dispara un cambio de cada tipo (transportista, tarifa, condiciones, zona manual vía cotización, costo manual vía cotización) y verifica que `listarHistorialTransportista` devuelve una fila por cada uno con `usuarioId`/`usuarioNombre`/`valorAnterior`/`valorNuevo` correctos

### Implementation for User Story 6

- [ ] T059 [US6] Crear `src/sales/transportistas/historial/queries.ts`: `listarHistorialTransportista(transportistaId, entidadTipo?)` — lectura del registro de auditoría (FR-051)

**Checkpoint**: Historias 1-6 completas — trazabilidad total

---

## Phase 9: User Story 7 - Ofrecer opciones de envío al agente de IA sin exponer datos internos (Priority: P3)

**Goal**: Nueva herramienta de IA que lista opciones de envío (transportista público, servicio, tiempo, precio, modalidad de pago) sin IDs ni datos de contacto del transportista.

**Independent Test**: Con zonas/tarifas/condiciones configuradas, invocar la tool para un destino cubierto y verificar que la respuesta no contiene ningún dato interno; verificar que no se activa para productos de servicio/digital.

### Tests for User Story 7

- [ ] T060 [P] [US7] Tests Vitest en `src/ai/tools/providers/consultar-opciones-envio.tool.test.ts` (archivo nuevo): devuelve opciones ordenadas por precio con nombre público/servicio/tiempo/precio/pago contra entrega; la respuesta serializada NUNCA contiene `id`, teléfono, correo, persona de contacto, notas internas, costo interno ni margen (FR-059); devuelve `opciones: []` con mensaje cuando no hay cobertura

### Implementation for User Story 7

- [ ] T061 [US7] Crear `src/ai/tools/providers/consultar-opciones-envio.tool.ts`: implementa `IProveedorTool`, llama `obtenerCandidatosEnvioPorZona`, mapea cada candidato a `{transportista: nombre público, servicio, zona, precio, tiempoEstimado, aceptaPagoContraEntrega, diasEntrega, horaLimiteMismoDia}` (ver [contracts/ai-tools.md](contracts/ai-tools.md)); se activa solo para productos `tipoCumplimiento = FISICO`
- [ ] T062 [US7] Modificar `src/ai/tools/inicializar.ts`: registrar `consultar_opciones_envio`
- [ ] T063 [US7] Confirmar/ajustar `src/ai/tools/providers/calcular-costo-envio.tool.ts` y `validar-cobertura.tool.ts` tras el rewire de T014 (sin cambio de `input_schema`/respuesta externa) — actualizar sus tests si el mock interno cambió de forma

**Checkpoint**: Las 7 historias funcionan de forma independiente y en conjunto

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T064 [P] Verificar el Escenario 6 de [quickstart.md](quickstart.md) (FR-052/053/054) contra la base real: cada fila preexistente de `TransportistaCoberturaGeografica` produjo una `ZonaEntrega`+`TarifaTransportistaZona` "Estándar" equivalente, sin pérdida de cobertura
- [ ] T065 Ejecutar `npm run test:unit` completo y confirmar que todo pasa en verde
- [ ] T066 [P] Ejecutar `npm run test:e2e:transportistas`, `test:e2e:cotizaciones`, `test:e2e:pedidos` (requieren `.env.test` con credenciales de prueba)
- [ ] T067 Revisar y actualizar `tests/e2e/sales/cobertura-geografica-envios.spec.ts`: retirar/reemplazar los casos que prueban la pantalla país+provincia ya eliminada
- [ ] T068 [P] Confirmar en `prisma/schema.prisma` que `TransportistaCoberturaGeografica` ya no existe y que los 6 modelos nuevos (`ZonaEntrega`, `ZonaEntregaUbicacion`, `ServicioTransportista`, `TarifaTransportistaZona`, `CondicionesTransportista`, `TransportistaHistorial`) sí, cerrando FR-052/053/054

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: depende de Setup — BLOQUEA las 7 historias (todas comparten schema, permisos y el motor de resolución de zona)
- **User Stories (Phase 3-9)**: todas dependen de Foundational. Orden de valor: US1 → US2 (MVP funcional) → US3/US4/US5 (P2, pueden hacerse en cualquier orden entre sí) → US6/US7 (P3, ídem)
- **Polish (Phase 10)**: depende de las historias que se vayan a entregar

### User Story Dependencies

- **US1 (P1)**: depende solo de Foundational
- **US2 (P1)**: depende de Foundational + de que existan zonas/tarifas (US1) para tener algo que resolver — en la práctica se implementa después de US1, aunque su Independent Test es autocontenido si ya hay datos de prueba
- **US3 (P2)**: depende de que una cotización pueda llevar tarifa asignada (US2)
- **US4 (P2)**: depende de Foundational (condiciones se siembran en T026, parte de US1) — independiente de US2/US3
- **US5 (P2)**: depende de que existan las pantallas que ocultar/mostrar (US1 tabla de tarifas, US2 form-cotización, US3 seccion-entrega)
- **US6 (P3)**: depende de que las escrituras de auditoría ya estén en las acciones de US1/US2 (T024/T026/T041) — agrega solo la lectura
- **US7 (P3)**: depende de Foundational (`obtenerCandidatosEnvioPorZona`, T013) — independiente de la UI humana (US1-US5)

### Parallel Opportunities

- T003-T009 (ediciones a `schema.prisma`) son secuenciales sobre el mismo archivo — no marcadas `[P]` entre sí
- T012 (permisos.ts) es independiente del resto de Foundational — `[P]`
- T015-T017 (schemas Zod de zonas/tarifas/condiciones, archivos distintos) — `[P]` entre sí
- Dentro de US1: T020/T021 (tests, archivos distintos) — `[P]`
- US4, US6 y US7 pueden trabajarse en paralelo por personas distintas una vez cerrado US1/US2 (tocan archivos casi disjuntos)

---

## Parallel Example: Foundational

```bash
Task: "Agregar 'transportistas-costos' a permisos.ts"                    # T012
Task: "Crear zonas/schema.ts"                                             # T015
Task: "Crear tarifas/schema.ts"                                           # T016
Task: "Crear condiciones/schema.ts"                                       # T017
```

## Parallel Example: User Story 1 (tests)

```bash
Task: "Tests de zonas/actions.test.ts"    # T020
Task: "Tests de tarifas/actions.test.ts"  # T021
```

---

## Implementation Strategy

### MVP First (User Stories 1 y 2)

1. Setup + Foundational (crítico — bloquea todo)
2. User Story 1 → validar independientemente (crear transportista, zonas, tarifas con margen)
3. User Story 2 → validar independientemente (la configuración se usa de verdad en cotizaciones)
4. **Este es el MVP entregable** — resuelve el pedido central del refactor

### Incremental Delivery

1. Setup + Foundational → base lista
2. US1 → demo (configuración completa de transportista)
3. US2 → demo (uso automático en cotizaciones/pedidos) — MVP
4. US3 → demo (integridad histórica de pedidos)
5. US4 → demo (condiciones consultables)
6. US5 → demo (protección de costos)
7. US6 → demo (auditoría consultable)
8. US7 → demo (IA con opciones de envío)
9. Polish → migración verificada + suite completa

## Notes

- El campo `costoEnvio` de `Cotizacion`/`Pedido` (raíz del documento) **no cambia de significado** — sigue siendo el precio de envío al cliente ya sumado al total; el dato nuevo es `costoInternoEnvio` en `EntregaCotizacion`/`EntregaPedido`.
- El margen nunca se almacena — se calcula en cada lectura (`precioCliente - costoInterno` o `costoEnvio - costoInternoEnvio`).
- Commitear después de cada tarea o grupo lógico; detenerse en cada Checkpoint para validar la historia de forma independiente antes de seguir.
