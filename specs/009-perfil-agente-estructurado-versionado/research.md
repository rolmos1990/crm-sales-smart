# Research: Perfil estructurado y versionado del agente de IA

No hay `NEEDS CLARIFICATION` pendientes en el Technical Context del plan — las tres decisiones de negocio abiertas (autonomía, borrador de ventas, identidad del agente) ya se resolvieron antes de esta spec (ver Assumptions en `spec.md`). Este documento cubre las decisiones de diseño técnico necesarias para pasar a Fase 1.

## Decisión 1 — Cómo modelar el versionado sin romper a los consumidores actuales

**Decisión**: `AgenteIAConfig` se mantiene como la fila "viva" que representa la **versión publicada vigente** (mismos campos que hoy, más los nuevos). Se agrega `AgenteIAConfigVersion` como tabla de historial append-only: cada fila es una fotografía completa (JSON) de la configuración en un momento dado, con `estado` (`BORRADOR` | `PUBLICADA`), `numero` incremental, `publicadaEn`, `creadaPorUsuarioId`. Publicar = copiar el contenido del borrador vigente hacia `AgenteIAConfig` + crear/actualizar la fila `AgenteIAConfigVersion` correspondiente a `PUBLICADA`, dentro de una transacción Prisma.

**Rationale**: Los 6+ puntos que hoy leen `AgenteIAConfig` directo (`construirContexto`, `generarRespuesta`, `generarConHerramientas`, `generar-respuesta-ia.suscriptor.ts`, `actions-ia.ts`, `agente-actions.ts`) no cambian su forma de leer — siguen usando `agenteIAConfigId` → fila viva. Esto evita reescribir el flujo de generación de respuesta (fuera de riesgo aceptable para esta spec) y aísla el versionado como una capa adicional alrededor del mismo agregado.

**Alternativas consideradas**:
- *Convertir `AgenteIAConfig` en una tabla puramente histórica y resolver "la vigente" con una query cada vez*: rechazada — obliga a tocar cada punto de lectura existente (mayor superficie de riesgo) para un beneficio de diseño marginal.
- *Versionar con un campo `version: Int` en la misma fila (sin tabla de historial)*: rechazada — no permite conservar el historial completo (FR-009) ni restaurar una versión anterior (FR-011) sin perder datos.

## Decisión 2 — Dónde vive el borrador en edición mientras no se publica

**Decisión**: El borrador en edición también es una fila `AgenteIAConfigVersion` con `estado = BORRADOR`. Guardar cambios sin publicar actualiza esa fila borrador; no toca `AgenteIAConfig` (la vigente). Solo puede existir un borrador "activo" a la vez por agente (upsert por `agenteIAConfigId + estado=BORRADOR`, ver Edge Case de ediciones concurrentes en `data-model.md`).

**Rationale**: Reutiliza la misma tabla de historial para ambos estados en vez de crear una entidad `AgenteIAConfigBorrador` separada — menos tablas, mismo shape de datos entre borrador y publicada, lo que simplifica duplicar (Historia 2, escenario 5) porque duplicar una versión publicada es simplemente crear una nueva fila `BORRADOR` con el mismo contenido.

**Alternativas consideradas**: tabla separada `AgenteIAConfigBorrador` — rechazada por duplicar el shape de datos sin necesidad.

## Decisión 3 — Cómo componer las capas nuevas del prompt sin romper el orden actual

**Decisión**: `construirSystemPrompt` gana parámetros opcionales nuevos (`identidadExtendida`, `comunicacionExtendida`, `reglas`) y una sección fija de "comportamiento natural" que se agrega siempre, en un punto fijo del orden: rol → tono/comunicación (existente + extendida) → especialidad → **comportamiento natural fijo (nuevo, no configurable)** → restricciones fijas existentes → reglas del negocio (frases prohibidas/preferidas, comportamientos prohibidos, reglas personalizadas, condiciones de transferencia — nuevo) → instrucciones adicionales (existente) → contexto dinámico (existente) → `sistemaPrompt` libre (existente, ahora explícitamente de menor prioridad) → bloque anti prompt-injection (existente, se mantiene al final).

**Rationale**: Preserva el comportamiento exacto para cualquier agente sin campos nuevos (todas las secciones nuevas se omiten si están vacías, igual que ya hace el builder con `especialidad`/`instrucciones` hoy). Fija la precedencia pedida implícitamente por el proyecto padre (`docs/AGENTE-IA-EVOLUCION-ANALISIS.md` §7): reglas obligatorias y de negocio antes que el override libre.

**Alternativas consideradas**: mover todo a un array de "capas" con un tipo genérico (`PromptLayer[]`) — se descarta para esta spec por ser el diseño que corresponde a `013-context-builder-capas-precedencia` (la spec dedicada al context builder de 11 capas); acá se mantiene la función concreta actual extendida, no una reescritura arquitectónica, para no adelantar trabajo de otra spec.

## Decisión 4 — Cómo detectar contradicciones entre `sistemaPrompt` libre y las reglas estructuradas (FR-007)

**Decisión**: Detección léxica simple, no semántica: se arma una lista de "patrones de conflicto" a partir de las reglas obligatorias fijas y de los comportamientos prohibidos configurados (ej. si hay un comportamiento prohibido "no prometer precios sin confirmar" y el texto libre contiene frases como "puedes prometer precio" / "confirma precios sin consultar"), usando un diccionario acotado de frases gatillo por regla — no NLP ni llamada a un modelo de IA para esto (evita costo/latencia en cada guardado). Si hay coincidencia, se muestra una advertencia no bloqueante en el formulario.

**Rationale**: El propio FR-007 pide una advertencia "en los casos más evidentes", no comprensión perfecta (ver Assumptions de la spec). Una heurística léxica acotada es suficiente, barata, determinística y testeable con Vitest sin dependencias externas.

**Alternativas consideradas**: usar el proveedor de IA para juzgar contradicción — rechazada por costo/latencia en una operación de guardado de configuración (no es un caso que justifique una llamada a IA) y por introducir no-determinismo en una validación que después se testea.

## Decisión 5 — Trazabilidad de versión en `UsoIA` (FR-012)

**Decisión**: `UsoIA` gana `agenteIAConfigVersionId String?` (FK opcional a `AgenteIAConfigVersion`, `onDelete: SetNull`, mismo patrón que ya usa `proveedorIAId`/`agenteIAConfigId` en ese modelo). Se completa en `registrarUsoIA` a partir de la versión publicada vigente resuelta al momento de generar la respuesta.

**Rationale**: Sigue el patrón ya establecido en el propio modelo `UsoIA` para referencias opcionales trazables sin bloquear el registro de uso si la versión llegara a eliminarse (no debería ocurrir — el historial es append-only — pero se mantiene consistente con el resto del modelo).

**Alternativas consideradas**: guardar un snapshot JSON de la configuración directamente en `UsoIA` — rechazada por duplicar datos que ya vive en `AgenteIAConfigVersion`; la FK es suficiente para "identificar en menos de 3 pasos" (SC-004).
