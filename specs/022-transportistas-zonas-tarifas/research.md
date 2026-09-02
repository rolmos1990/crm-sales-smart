# Research: Gestión integral de transportistas — zonas, tarifas y condiciones

## Contexto de código confirmado (pre-Fase 0)

- `Transportista` (`prisma/schema.prisma:1261-1277`) hoy solo tiene `nombre`, `tipo`, `activo` — sin datos de contacto ni condiciones.
- `TransportistaCoberturaGeografica` (spec 019, migración `20260901153319_cobertura_geografica_envios`, **aplicada hoy mismo**) calcula un costo único final por `(transportista, país, estadoProvincia)` — sin zonas reutilizables, sin servicios, sin costo/precio/margen separados. Por Clarificación de sesión 2026-09-01 (Q2=A), este modelo **se retira** en favor del nuevo sistema de zonas.
- `resolverCostoEnvio`/`decidirCoincidenciaCosto` (`src/shared/entregas/resolver-costo-envio.ts`) es el motor único ya compartido entre la UI humana y las tools de IA (`calcular_costo_envio`, `validar_cobertura`, `estimar_fecha_entrega`). Su "Fuente 1: Transportista" debe reescribirse para resolver contra el nuevo modelo de zonas en vez de `TransportistaCoberturaGeografica`/`EstadoProvincia`. Su "Fuente 2: Delivery propio" (`MetodoEntregaConfig`/`ZonaCobertura*`) **no cambia** — es un sistema paralelo no afectado por esta feature.
- `EntregaCotizacion`/`EntregaPedido` (1:1 con `Cotizacion`/`Pedido`) ya capturan `transportistaId`, `paisId`, `estadoProvinciaId`, `ciudad` — el punto de extensión natural para los nuevos campos de snapshot (zona, servicio, tarifa, costo interno, confirmación).
- `generarPedidoDesdeCotizacion` (`src/sales/cotizaciones/services/generar-pedido-desde-cotizacion.service.ts:136-153`) ya copia `cotizacion.entrega` a `pedido.entrega` dentro de una única transacción — es el único punto donde se genera un pedido; ahí se extiende la copia de snapshot (Historia 3), sin crear un mecanismo paralelo.
- `PedidoHistorial` (`prisma/schema.prisma:1606-1620`, patrón `{accion, valorAnterior: Json?, valorNuevo: Json?, usuarioId, usuarioNombre, creadoEn}`) es el precedente exacto a reutilizar para la auditoría de esta feature (Historia 6) — no existe ningún modelo de auditoría genérico cross-entidad en el proyecto.
- Las Server Actions de `src/sales/transportistas/actions.ts` hoy validan contra el módulo de permisos `"configuracion"`, no contra `"transportistas"` (que sí existe en `Modulo` y sí se usa en la página) — inconsistencia preexistente que esta feature corrige de paso.
- `Contacto` (`prisma/schema.prisma:507-547`) no tiene ningún campo de dirección — confirmado, y por Clarificación (Q1=A) esta feature no lo agrega.
- No existe infraestructura de protocolo MCP externo en el repo; el patrón real y único para exponer datos a la IA es `IProveedorTool`/`registroHerramientas` (`src/ai/tools/`), ya usado por `calcular-costo-envio.tool.ts` y análogos.

## Decisión 1: Reemplazo de `TransportistaCoberturaGeografica` por Zonas y Tarifas

**Decision**: Se retira el modelo `TransportistaCoberturaGeografica` y su pantalla (`SeccionCoberturaGeografica`), reemplazados por `ZonaEntrega` + `ZonaEntregaUbicacion` (catálogo reutilizable por empresa) y `TarifaTransportistaZona` (costo/precio/margen por transportista+zona+servicio). Cada fila de cobertura existente se migra a: una `ZonaEntrega` (nombre = nombre del `EstadoProvincia`, `ZonaEntregaUbicacion` con `paisId`+`provinciaEstado` = ese estado) y una `TarifaTransportistaZona` con `servicio = "Estándar"` (creado si no existe para ese transportista) y `costoInterno = precioCliente = costoEnvio` (spec019 no distinguía costo de precio — ver Decisión 6 para el tratamiento de ese gap).

**Rationale**: Decisión explícita del usuario (Clarificación Q2=A) tras confirmar que ningún dato se pierde (cada fila existente produce exactamente una zona y una tarifa equivalente) y que el motor de resolución compartido evita duplicar lógica.

**Alternatives considered**: Mantener ambos sistemas en paralelo (opción B de la clarificación) — descartada explícitamente por el usuario.

## Decisión 2: Estructura de `ZonaEntregaUbicacion` — país como catálogo, resto como texto libre

**Decision**: `ZonaEntregaUbicacion` referencia `Pais` (catálogo global ya existente, spec 019) por FK obligatoria, pero `provinciaEstado`, `distritoCiudad`, `corregimiento` y `sectorOCodigoPostal` son campos de texto libre opcionales (no FKs a `EstadoProvincia`). Un nivel vacío en una ubicación actúa como comodín: coincide con cualquier valor de ese nivel en el destino.

**Rationale**: Reutiliza el catálogo de países ya sembrado (Principio I) sin necesidad de un catálogo nuevo por nivel administrativo, que no existe de forma consistente entre países (ej. "corregimiento" es específico de Panamá). El texto libre por nivel es lo único que permite zonas con distintos niveles de granularidad ("todo el estado" vs. "solo estos 5 distritos") sin modelar cada país por separado — exactamente lo que pide el spec ("no limitar una zona a una provincia").

**Alternatives considered**: Extender `EstadoProvincia` con sub-niveles (distrito, corregimiento) como catálogo jerárquico — descartado por ser mucho más costoso de sembrar/mantener para docenas de países y no aportar valor sobre el texto libre normalizado (mismo mecanismo de comparación por slug que ya usa `resolverCostoEnvio` para país/estado).

## Decisión 3: Algoritmo de resolución de zona por destino

**Decision**: Un destino (país + opcionalmente provinciaEstado/distritoCiudad/corregimiento/sectorOCodigoPostal, ya capturados en `EntregaCotizacion`/`EntregaPedido`) coincide con una `ZonaEntregaUbicacion` cuando el país coincide y, para cada nivel que la ubicación tenga definido (no vacío), el valor del destino coincide (comparación por slug, insensible a mayúsculas/tildes — mismo `generarSlug` ya usado por `resolverCostoEnvio`). Un nivel vacío en la ubicación es comodín. Una zona coincide si cualquiera de sus ubicaciones coincide. Pueden coincidir varias zonas a la vez (edge case ya documentado en spec.md) — se agregan los candidatos de todas.

**Rationale**: Es el único mecanismo que soporta zonas de distinta granularidad sin reglas especiales por país, y reutiliza la comparación por slug ya validada en producción por spec 019.

**Alternatives considered**: Exigir que todos los niveles de la ubicación estén definidos (sin comodines) — descartado porque forzaría a definir manualmente cada distrito/corregimiento incluso para negocios que solo quieren cubrir "todo Panamá Oeste", contradiciendo el ejemplo del propio spec (zona con 5 ubicaciones a nivel distrito, sin definir corregimiento/sector).

## Decisión 4: Dos formas de consumir la resolución — verdicto único (IA existente) vs. lista de opciones (UI humana + nueva tool)

**Decision**: `resolverCostoEnvio` se reescribe para resolver contra el nuevo modelo de zonas, pero se **divide en dos funciones**: `obtenerCandidatosEnvioPorZona` (nueva, pura consulta — devuelve la lista completa de tarifas candidatas: transportista, servicio, zona, costo, precio, tiempo) y `decidirCoincidenciaCosto` (existente, sin cambios de contrato) que sigue colapsando esa lista a un veredicto único CLARA/SIN_COINCIDENCIA_CLARA para las tools de IA ya existentes (`calcular_costo_envio`, `validar_cobertura`, `estimar_fecha_entrega`, Historia 3 de spec 019, que deben seguir escalando a humano ante ambigüedad). La UI humana (Historia 2) y la nueva tool de opciones de envío (Historia 7) consumen directamente `obtenerCandidatosEnvioPorZona` sin colapsar — porque ahí sí hay una interfaz (humano o el propio LLM recomendando) capaz de elegir entre varias opciones, a diferencia del flujo de auto-cotización de spec 019 que nunca debe inventar un precio ambiguo.

**Rationale**: El pedido explícito de la Historia 7 ("que el IA pueda conocer el o las opciones... y recomendar") es incompatible con el contrato de escalación de spec 019 (que nunca expone más de un precio al LLM) — son dos necesidades de negocio distintas y deben ser dos funciones, no una sola con dos modos ocultos. Mantener `decidirCoincidenciaCosto` sin cambios preserva 100% el comportamiento ya probado de spec 019 (Principio "no romper comportamiento existente").

**Alternatives considered**: Que la tool de opciones de envío reutilice `calcular_costo_envio` una vez por cada transportista candidato — descartado por ineficiente (N llamadas) y porque igual necesitaría la lista completa de candidatos primero para saber a quiénes llamar.

## Decisión 5: Servicios por transportista y unicidad de tarifa

**Decision**: `ServicioTransportista` es una tabla propia por transportista (no un enum global), sembrada con 3 filas (Estándar/Express/Personalizado) al crear el transportista, editable/extensible después. `TarifaTransportistaZona` tiene `@@unique([transportistaId, zonaEntregaId, servicioTransportistaId])` — una sola fila por combinación; editar precio/costo actualiza esa fila en el lugar (no crea versiones históricas paralelas). El historial de qué cambió y cuándo lo cubre `TransportistaHistorial` (Decisión 7), no filas de tarifa duplicadas.

**Rationale**: Un `@@unique` simple sobre la combinación es la forma más directa de garantizar FR-026 (sin duplicados) sin conflictuar con la posibilidad de tarifas inactivas históricas — al no versionar tarifas como filas, no hay conflicto que resolver. Coincide con el modelo de dominio sugerido por el usuario (`ServicioTransportista` con `TransportistaId`).

**Alternatives considered**: Permitir múltiples filas por combinación diferenciadas por vigencia (para llevar un historial de precios como filas separadas) — descartado por complejizar la unicidad (¿qué constraint evita que dos vigencias se superpongan?) sin necesidad real: el spec pide poder auditar cambios de tarifa (ya cubierto por Decisión 7), no consultar precios históricos por rango de fechas.

## Decisión 6: Margen no almacenado; snapshot de costo interno en la entrega, no en el documento raíz

**Decision**: `TarifaTransportistaZona` no almacena `margen` — se calcula en el momento (`precioCliente - costoInterno`) en cada lectura, evitando datos derivados desincronizados. Para el snapshot de pedido/cotización (Historia 3), se agrega `costoInternoEnvio` (Decimal, nullable) a `EntregaCotizacion`/`EntregaPedido` — el campo `costoEnvio` que ya existe en `Cotizacion`/`Pedido` sigue representando el precio al cliente (ya se suma al total, FR-043 sin cambios); el margen del envío se deriva igual, restando ambos, solo visible con permiso financiero.

**Rationale**: Mantiene el campo `costoEnvio` existente con su significado actual (compatibilidad — Principio "no romper comportamiento existente"), y agrega únicamente el dato que falta (costo interno) en el punto exacto donde ya vive el resto del snapshot de envío.

**Alternatives considered**: Renombrar `costoEnvio` a `precioEnvioCliente` — descartado por ser un cambio disruptivo de nombre de columna sin necesidad, cuando agregar el campo faltante alcanza.

## Decisión 7: Auditoría — nuevo modelo `TransportistaHistorial`, mismo patrón que `PedidoHistorial`

**Decision**: Nuevo modelo `TransportistaHistorial { id, instanciaId, entidadTipo (enum: TRANSPORTISTA | TARIFA | CONDICIONES | ZONA_MANUAL | COSTO_MANUAL), entidadId, accion, valorAnterior Json?, valorNuevo Json?, usuarioId?, usuarioNombre?, creadoEn }`, calcado de `PedidoHistorial` (mismo shape, misma filosofía: registro de solo-append, nunca editado). Cada Server Action que modifica transportista/tarifa/condiciones, o que registra una selección manual de zona / sobrescritura manual de costo (en cotizaciones), escribe una fila aquí antes de responder.

**Rationale**: Reutiliza un patrón ya probado en producción (`PedidoHistorial`) en vez de inventar un mecanismo de auditoría nuevo — Principio I (extender antes que introducir abstracciones paralelas). Es más simple y con menos riesgo que instrumentar un sistema de auditoría genérico cross-entidad para todo el proyecto, que ninguna otra parte del sistema pide hoy.

**Alternatives considered**: Un log de auditoría genérico reutilizable por cualquier entidad del sistema — descartado por exceder el alcance pedido (auditoría del módulo de transportistas específicamente) y no tener otro consumidor hoy que lo justifique (regla de la constitución: "New dependencies/abstractions require a concrete need").

## Decisión 8: Permisos — un módulo adicional para costos financieros, sin rediseñar el sistema de permisos

**Decision**: El sistema de permisos actual (`src/shared/auth/permisos.ts`) es por módulo con 3 niveles (`rw`/`r`/`none`) por rol — no soporta permisos por acción dentro de un módulo. En vez de rediseñar ese sistema (fuera de alcance y alto riesgo para el resto del proyecto), se agrega **un módulo nuevo** `"transportistas-costos"` al `Modulo` existente, gateando específicamente ver costo interno/margen y sobrescribir manualmente un costo en cotización (`rw` = puede ver y sobrescribir; `r` = puede ver pero no sobrescribir; `none` = no ve costo ni margen en ninguna pantalla). El resto de los permisos pedidos (consultar/crear/editar transportistas, configurar zonas, configurar tarifas, desactivar) se cubren con el módulo `"transportistas"` ya existente (`rw`/`r`/`none`), corrigiendo de paso que las Server Actions lo empiecen a chequear en vez de `"configuracion"` (inconsistencia ya detectada en el código actual).

**Rationale**: Satisface el requisito de negocio real (costos internos separados del resto, FR-049/FR-050) con el mínimo cambio posible al sistema de permisos existente, consistente con "no reinventar sin necesidad concreta". Introducir 8 flags de permiso por acción sería un cambio arquitectónico mucho mayor que lo que el resto del refactor necesita, y ningún otro módulo del proyecto tiene permisos a ese nivel de granularidad.

**Alternatives considered**: Permisos por acción dentro del módulo `"transportistas"` (un `Set<Accion>` por rol) — descartado por requerir cambiar la forma del mapa `PERMISOS` para todos los roles y módulos existentes, un cambio transversal fuera del alcance de este refactor.

## Resueltos: NEEDS CLARIFICATION

Ambos marcadores del spec (FR-034, FR-054) fueron resueltos por el usuario en la sesión de clarificación 2026-09-01 (ver spec.md → `## Clarifications`): sin dirección persistida en Contacto, y reemplazo completo de la cobertura país+provincia por el nuevo modelo de zonas. Las Decisiones 1-8 de arriba implementan esas dos respuestas.
