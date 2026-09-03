# Research: Alias y match de ubicaciones para transportistas

Todas las decisiones de esta fase fueron validadas leyendo el código real (no son suposiciones): [src/shared/entregas/resolver-costo-envio.ts](../../src/shared/entregas/resolver-costo-envio.ts), [src/ai/tools/providers/calcular-costo-envio.tool.ts](../../src/ai/tools/providers/calcular-costo-envio.tool.ts), [src/ai/tools/registry.ts](../../src/ai/tools/registry.ts), [src/ai/tools/executor.ts](../../src/ai/tools/executor.ts), [prisma/schema.prisma](../../prisma/schema.prisma), y el patrón de alias existente en `src/configuracion/ia/actions.ts` (spec 021).

## 1. Normalización de texto

**Decision**: Extraer la lógica ya usada por `generarSlug()` ([src/shared/lib/slug.ts](../../src/shared/lib/slug.ts)) a una primitiva genérica `normalizarTexto()` en `src/shared/lib/normalizar-texto.ts` (minúsculas, NFD + strip de diacríticos, colapso de cualquier run no alfanumérico a un separador, trim de bordes). `generarSlug()` pasa a ser un wrapper de una línea — cero cambio de comportamiento para sus ~10 call sites actuales. Se agrega `normalizarUbicacion()` en `src/shared/entregas/normalizar-ubicacion.ts` como entrypoint de dominio (mismo criterio, separador por defecto), dejando la costura lista para un futuro diccionario de abreviaturas geográficas sin tocar `generarSlug`.

**Rationale**: `generarSlug()` ya cubre exactamente lo que pide FR-001 (minúsculas, sin tildes, espacios colapsados, sin puntuación). Reescribirlo desde cero duplicaría lógica ya probada; envolverlo mantiene un único punto de verdad.

**Alternatives considered**:
- *Reemplazar `generarSlug()` por `normalizarUbicacion()` en todos sus call sites*: descartado — innecesario para este spec y aumenta el diff sin beneficio (ambas funciones producen el mismo resultado).
- *Normalizar solo al momento de comparar, sin persistir*: descartado — impide indexar (`nombreNormalizado`) y obliga a recalcular en cada consulta; además el propio `requerimiento-transportista.md` recomienda persistir el valor normalizado.

## 2. Modelo de datos — extender vs. reemplazar

**Decision**: Extender `ZonaEntregaUbicacion` con `nombreVisible`/`nombreNormalizado`, y agregar un modelo nuevo `AliasUbicacion` (1-N con `ZonaEntregaUbicacion`, no con `DestinoTransportista`/`ZonaTransportista` como sugería el documento original). Cada alias declara a qué `campo` geográfico se refiere (provincia/estado, distrito/ciudad, corregimiento, sector) vía enum `CampoUbicacion`, y guarda `instanciaId` denormalizado desde `zonaEntrega.instanciaId` para permitir el índice de unicidad `[instanciaId, campo, valorNormalizado]` sin un join de dos saltos en cada búsqueda.

**Rationale**: El modelo `ZonaTransportista`/`DestinoTransportista` del documento original asumía una entidad plana "transportista → destino". El modelo real (mergeado hoy por specs 022/023) tiene `ZonaEntrega` como catálogo geográfico reutilizable por varios transportistas vía `TarifaTransportistaZona` — el alias pertenece correctamente al destino geográfico (`ZonaEntregaUbicacion`), no a una tarifa puntual, porque así un mismo alias sirve para cualquier transportista que cubra esa zona (coherente con cómo ya resuelve `obtenerCandidatosEnvioPorZona`: primero zonas, después tarifas).

**Alternatives considered**:
- *Crear `ZonaTransportista`/`DestinoTransportista` tal como describe el documento*: descartado por decisión explícita del usuario — duplicaría el modelo recién mergeado en specs 022/023.
- *Colgar los alias directamente de `TarifaTransportistaZona`*: descartado — un mismo destino con varios transportistas tendría que repetir sus alias por cada tarifa, violando unicidad y obligando a sincronizar N copias.

## 3. Migración segura de columnas obligatorias

**Decision**: Dos migraciones. La primera agrega `nombreVisible`/`nombreNormalizado` como **nullable** y crea `AliasUbicacion`; se corre el backfill (`scripts/backfill-normalizar-ubicaciones.ts`) en cada entorno; una migración de seguimiento después endurece a `NOT NULL`.

**Rationale**: Mismo patrón ya usado y validado por spec 023 para `Transportista.paisId` — evita romper filas existentes en el momento del deploy. A diferencia del backfill de país (heurística ambigua), este backfill es **determinístico** (siempre hay un valor calculable a partir de columnas ya existentes), así que no necesita quedar "nullable para siempre".

**Alternatives considered**: agregar la columna directamente `NOT NULL` con un `DEFAULT` calculado en SQL — descartado, Postgres no puede ejecutar la lógica de normalización (NFD/strip de tildes con las reglas exactas del dominio) dentro de un `DEFAULT`; se necesita el backfill en TypeScript para reusar la misma función que usa el resto del sistema.

## 4. Algoritmo de matching con niveles de confianza

**Decision**: `obtenerCandidatosEnvioPorZona()` en `resolver-costo-envio.ts` gana un parámetro opcional `incluirAliasYAproximado` (default `false` — comportamiento actual sin cambios, usado por las 3 tools de spec 019). Se agrega `obtenerOpcionesEnvioConConfianza()`, que evalúa cada nivel geográfico como EXACTA (slug idéntico) → ALIAS (coincide con un alias normalizado) → PROBABLE (similitud aproximada ≥ umbral) y agrega la confianza de una zona como la **peor** entre sus niveles evaluados. A nivel de respuesta: `SIN_COINCIDENCIA` si ninguna zona matcheó; `AMBIGUA` si 2+ zonas distintas matchearon solo por aproximación sin que ninguna llegue a EXACTA/ALIAS; si no, la peor confianza entre las zonas que matchearon.

**Rationale**: Preserva exactamente el contrato de FR-010 (las tools existentes no cambian de comportamiento) porque el flag por defecto reproduce el código actual byte a byte. La comparación aproximada usa Levenshtein en memoria (`src/shared/lib/similitud-texto.ts`, sin dependencias nuevas) sobre el mismo conjunto de filas que hoy ya se cargan enteras vía `findMany` — no hay `pg_trgm` habilitado en el proyecto ni volumen que lo justifique (decenas/cientos de filas por instancia).

**Alternatives considered**:
- *`pg_trgm` + índice GIN en Postgres*: descartado para este MVP — requiere habilitar una extensión nueva sin necesidad de escala actual; queda anotado como vía de escalado futuro si el volumen crece.
- *Colapsar siempre a una única mejor opción (como hace `decidirCoincidenciaCosto`)*: descartado — contradice US3/FR-008, que pide devolver *todas* las opciones para comparar, no un veredicto binario.

## 5. Tool de IA `consultar_opciones_envio`

**Decision**: Nuevo archivo `src/ai/tools/providers/consultar-opciones-envio.tool.ts`, mismo patrón `IProveedorTool` que `calcular-costo-envio.tool.ts`. El objeto de salida se construye campo por campo (nunca `...spread` del candidato interno) para que costo interno/margen/id/contacto no puedan filtrarse por accidente si en el futuro se agrega un campo al modelo interno. Condiciones (pago contra entrega, días de entrega, hora límite) se leen de `CondicionesTransportista` (ya existente, solo lectura) extendiendo el `include` de la consulta de tarifas.

**Rationale**: Reusa exactamente el contrato ya documentado en `specs/022-transportistas-zonas-tarifas/contracts/ai-tools.md` — evita reinventar la forma del payload que ya fue diseñada y revisada en ese spec.

**Alternatives considered**: extender `calcular_costo_envio` para que acepte un modo "listar todas las opciones" en vez de crear una tool nueva — descartado, mezclaría dos contratos con semántica distinta (una escala a humano ante ambigüedad, la otra debe responder siempre con opciones) en la misma función, dificultando el `description` que el LLM usa para elegir cuál invocar.

## 6. Dependencia bloqueante: herramientas "siempre disponibles" nunca llegan a runtime

**Decision**: Unificar la lista de nombres en una constante compartida `src/ai/tools/constantes.ts` (`HERRAMIENTAS_OPERATIVAS_SIEMPRE_DISPONIBLES`), importada tanto por `sheet-editar-agente.tsx` (hoy la declara localmente, solo para mostrarla informativamente) como por `obtenerHerramientasPermitidas()` en `src/suscriptores/ai/generar-respuesta-ia.suscriptor.ts`, que hoy solo devuelve literalmente `AgenteIAConfig.herramientas` — la unión con la lista de "siempre disponibles" corregirá que estas tools queden autorizadas en `ctx.herramientasPermitidas` independientemente de lo que el negocio haya marcado en el toggle de herramientas CRM.

**Rationale**: Se confirmó leyendo el código (no es una suposición) que hoy `ejecutarHerramienta()` en `src/ai/tools/executor.ts:14` rechaza cualquier tool que no esté literalmente en `ctx.herramientasPermitidas`, y esa lista nunca incluye las operativas — solo las 7 tools togglables de `HERRAMIENTAS_DISPONIBLES`. Sin este fix, `consultar_opciones_envio` quedaría registrada pero inalcanzable para el LLM, incumpliendo FR-011. Esto también corrige, como efecto colateral correcto, el mismo problema latente para `calcular_costo_envio`/`validar_cobertura`/`estimar_fecha_entrega`/etc.

**Alternatives considered**: dejarlo fuera de este spec y abrirlo como Hotfix aparte — descartado porque es una dependencia bloqueante directa de la User Story 1/3 de este spec (sin el fix, la funcionalidad principal no es demostrable end-to-end); se prefiere resolverlo aquí en vez de fingir que el spec está completo sin serlo.

## 7. Importación CSV/Excel de destinos

**Decision**: Namespace propio `src/sales/transportistas/importacion-destinos/`, reutilizando quirúrgicamente `parsearArchivo()`/`detectarSeparador()` de `src/crm/datos/utils/` (utilidades cliente puras, sin acoplamiento a Contacto/Empresa) pero con su propio wizard y su propia lógica de revisión (clasificación NUEVO / COINCIDENCIA_EXACTA / POSIBLE_DUPLICADO / ALIAS_AMBIGUO vía el motor de matching del punto 4). Se reutiliza el modelo `HistorialImportacion` ya existente (`entidad = "DESTINO_TRANSPORTISTA"`, campo `String` libre, sin migración).

**Rationale**: El wizard genérico de `src/crm/datos/` (`CAMPOS_POR_ENTIDAD`/`EntidadImportable`) asume "mapear columnas 1:1 a un modelo nuevo" con lookup/create acoplado por entidad en un switch — importar destinos es un problema distinto (resolver contra un catálogo con niveles de confianza, con revisión humana de casos dudosos). Forzarlo al switch genérico agregaría más acoplamiento que reuso real.

**Alternatives considered**: extender `EntidadImportable` con un valor `"DESTINO_TRANSPORTISTA"` dentro del wizard genérico — descartado por el motivo anterior; reevaluar solo si en el futuro se necesita importación masiva de más entidades con la misma semántica de revisión por confianza.

## 8. UI de administración de alias

**Decision**: Nuevo `DialogAliasUbicacion` disparado desde el nombre de la zona en `seccion-zonas-tarifas.tsx` (no desde cada fila de tarifa), listando todas las `ZonaEntregaUbicacion` de esa `ZonaEntrega` con sus alias. Server actions atómicas (`agregarAliasUbicacion`/`eliminarAliasUbicacion`) — sin `useFieldArray` de formulario, cada alias se persiste independientemente.

**Rationale**: Hoy la fila de tarifa solo expone `{id, nombre}` de `ZonaEntrega`, no de la `ZonaEntregaUbicacion` puntual, y una zona puede tener varias ubicaciones — resolver el diálogo a nivel de zona evita tener que rediseñar la query de tarifas solo para exponer un id adicional por fila.

**Alternatives considered**: abrir el diálogo de alias por fila de tarifa — descartado, requeriría extender `TarifaFila` con el id de `ZonaEntregaUbicacion` sin necesidad real, ya que la relación natural es zona → ubicaciones → alias, no tarifa → alias.

## 9. Eventos de dominio

**Decision**: No se agrega ningún evento de dominio nuevo en este spec. Crear/eliminar un alias y confirmar una importación de destinos se tratan como operaciones de catálogo interno (mismo nivel que crear una `ZonaEntrega` o una `TarifaTransportistaZona` hoy, que tampoco publican eventos), resueltas con `revalidatePath` como el resto del módulo.

**Rationale**: El catálogo de eventos (`docs/eventos.md`) no tiene eventos de transportistas hoy, y ninguna User Story de este spec describe un consumidor externo (otro módulo, IA reactiva, notificación) que necesite reaccionar a "se agregó un alias" o "se importó un lote" — agregar un evento sin consumidor real violaría la guía de la Constitución de no inventar obligaciones sin necesidad concreta.

**Alternatives considered**: publicar `DestinosImportados`/`AliasUbicacionCreado` "por si acaso" — descartado, no hay caso de uso que lo consuma hoy; se puede agregar en un spec futuro si aparece una necesidad real (ej. notificar a un canal cuando termina una importación grande).

## 10. Auditoría de código obsoleto en el dominio de transportistas

*(Pedido explícito del usuario para este plan: identificar y remover código que ya no se usa de los refactors recientes de transportistas, antes de agregar código nuevo encima.)* Auditoría hecha con grep exhaustivo contra todo `src/`, `prisma/`, `scripts/`, `tests/` (no especulativa — cada hallazgo está verificado con evidencia de "cero callers").

### 10.1 A eliminar (código muerto confirmado)

**Decision**: eliminar en este spec, como parte de las tareas de limpieza:
- **`obtenerZonaEntrega`** (`src/sales/transportistas/zonas/queries.ts:20`) — cero referencias en todo el repo fuera de su propia definición (ni siquiera tiene test que la ejercite).
- **`editarZonaEntrega`** (`src/sales/transportistas/zonas/actions.ts:49-98`) + su bloque de test en `zonas/actions.test.ts` — sin ningún caller en UI (`dialog-zona-entrega.tsx` solo usa `crearZonaEntrega`), solo se ejercitaba desde su propio test. Además tiene una estrategia insegura (`ubicaciones.deleteMany({}) + create(...)`, borra y recrea todas las `ZonaEntregaUbicacion` de la zona con IDs nuevos en cada edición) que sería un riesgo real si alguna vez se activara con UI, porque `AliasUbicacion` cuelga de `ZonaEntregaUbicacion.id` con `onDelete: Cascade` — una edición de zona borraría en cascada todos sus alias sin aviso.
- **`listarZonasEntregaAction`** (`src/sales/transportistas/zonas/actions.ts:121-125`) — la UI real (`src/app/sales/transportistas/[id]/page.tsx`, Server Component) llama directo a `listarZonasEntrega` de `queries.ts`; este wrapper "client-callable" solo se usa en su propio test, sin ningún consumidor real.

**Rationale**: el diseño de este spec (§8 — diálogo de alias disparado desde el nombre de la zona, sobre `ZonaEntregaUbicacion` ya persistidas) **no necesita editar zonas existentes** — solo agregar/quitar alias sobre ubicaciones que no cambian. Por lo tanto no hay ninguna razón para conservar ni corregir `editarZonaEntrega`: la Opción B (corregirlo a un diff seguro) se descarta porque construiría una capacidad que ningún requisito de este spec pide. Si en el futuro un spec necesita editar ubicaciones de una zona, se debe construir de nuevo con el modelo de `AliasUbicacion` ya en mente (diff por id, nunca `deleteMany`+`create`), no reflotar la versión actual.

**Alternatives considered**: dejar `editarZonaEntrega` como está "por si se necesita después" — descartado, es exactamente el tipo de código que el usuario pidió limpiar, y mantenerlo sin corregir su estrategia insegura sería dejar una trampa activa para cuando `AliasUbicacion` exista.

### 10.2 A actualizar, no eliminar

**Decision**: actualizar `tests/sales/transportistas.md` para agregar los casos de país (spec 023, ya faltantes) y zonas/tarifas/condiciones (spec 022, ya faltantes), y en esta misma pasada sumar los casos de alias/importación de spec 024 — en vez de eliminarlo.

**Rationale**: es el único de los hallazgos que está desactualizado pero no muerto (el resto de `tests/*.md` del repo, ej. `cotizaciones.md`/`pedidos.md`, sigue el mismo patrón de checklist manual + e2e en paralelo) — eliminarlo rompería la convención del repo solo para este módulo. Se corrige actualizándolo, no borrándolo.

### 10.3 Investigado y confirmado que NO es basura (no tocar)

Por completitud — para que quede documentado por qué estos hallazgos de la auditoría **no** generan tarea de limpieza:

- **`TransportistaCoberturaGeografica`**: retirado de forma completa por spec 022 — cero rastro en schema o código de aplicación; solo queda en migraciones ya aplicadas (historial inmutable, correcto) y documentación histórica.
- **`aplicarCambioMasivo`** (`tarifas/actions.ts:214`): sin UI todavía, pero es la implementación server-side de FR-021 de spec 022, documentada en su `tasks.md` (T033) como "pendiente de UI" — no es código huérfano, es una historia sin terminar de otro spec, fuera de alcance de 024.
- **`CondicionesTransportista` / enum `TipoEntidadHistorialTransportista.CONDICIONES`**: nunca se escribe porque falta el CRUD de condiciones (`condiciones/actions.ts` no existe) — es la User Story 4/P2 de spec 022 sin completar (T049-T053 de su `tasks.md`), explícitamente dejada fuera del alcance de 024 por decisión ya tomada con el usuario. No es código muerto, es código aún no construido.
- **Scripts de backfill de spec 023** (`scripts/backfill-pais-transportista.ts`): pendientes de ejecutarse contra una base real (T022 de `specs/023-transportistas-por-pais/tasks.md`, bloqueado por falta de conectividad en el entorno de desarrollo) — deuda de seguimiento ya documentada de otro spec, no se toca en 024.
- **`specs/022-transportistas-zonas-tarifas/contracts/ai-tools.md`**: no documenta ninguna otra tool fantasma aparte de `consultar_opciones_envio` (que es justamente el alcance de este spec).

### 10.4 Cómo se ejecuta la limpieza

Las eliminaciones de 10.1 se hacen como una tarea temprana de `tasks.md` (Fase de limpieza, antes de agregar `AliasUbicacion`) — así el diff de este feature no mezcla "código nuevo" con "código eliminado" en el mismo commit lógico, y cualquier test que dependiera de las funciones eliminadas se corrige en el mismo paso. La actualización de 10.2 se hace en la fase de Polish, junto con la extensión del e2e.
