# Research: Conversaciones piloto y recuperación de ejemplos relevantes

## Decisión 1 — Anonimización: sustitución determinística, no basada en IA

**Decisión**: `anonimizarContenido(mensajes, contacto)` reemplaza, por cada mensaje copiado a `ConversacionPiloto.contenidoAnonimizado`, las ocurrencias literales de `contacto.nombre`, `contacto.apellido`, `contacto.email`, `contacto.telefonoPrincipal`/`telefonoSecundario` por marcadores fijos (`[NOMBRE]`, `[EMAIL]`, `[TELÉFONO]`). No se anonimiza el mensaje original en `Mensaje` — se guarda una copia transformada, separada, en la nueva tabla.

**Rationale**: es determinístico, testeable exactamente, gratuito y sin latencia — evita depender de un LLM para una operación de privacidad donde un falso negativo (dato no anonimizado) es inaceptable y donde el no-determinismo de un LLM sería un riesgo, no una ventaja. Es coherente con la Assumption de la spec: mejor esfuerzo sobre campos conocidos, comunicado explícitamente como límite (no se promete anonimización perfecta de texto libre).

**Alternativas consideradas**: usar el proveedor de IA para "redactar" información sensible de forma más inteligente (detectar direcciones, otros nombres mencionados, etc.) — rechazada para esta spec por el riesgo de falsos negativos no determinísticos en una función de privacidad; queda como mejora futura posible, no como parte de este alcance.

## Decisión 2 — `RecuperadorEjemplos`: shape de la interfaz reemplazable (FR-014)

**Decisión**: se define una interfaz `IRecuperadorEjemplos` con un único método `recuperar(criterios: CriteriosRecuperacion): Promise<EjemploRecuperado[]>`. La implementación de esta spec (`recuperador-ejemplos-por-filtro.ts`) resuelve `recuperar` con: (1) filtrar `EjemploPrompt` de la instancia y agente por coincidencia de etiquetas (intención, tipo de cliente, estrategia, producto/categoría — mismo criterio de coincidencia por lista que `011` ya usa para condiciones de playbook); (2) puntuar cada coincidencia por cantidad de etiquetas que coinciden; (3) desempatar por `calidad` (derivada de si es positivo/negativo y de la confianza de la recomendación que lo originó) y luego por recencia; (4) devolver entre 2 y 4, o menos si no hay suficientes candidatos relevantes (FR-011 — nunca rellena con irrelevantes solo para llegar a 2).

**Rationale**: cumplir FR-014 sin sobre-diseñar — una interfaz de un solo método con una implementación intercambiable es suficiente; el día que exista una capacidad de embeddings, se agrega `recuperador-ejemplos-por-similitud.ts` implementando la misma interfaz y se cambia el registro de qué implementación usar (mismo patrón ya usado en `src/ai/proveedores/registro.ts` para proveedores de IA), sin tocar `013` ni ningún consumidor.

**Alternativas consideradas**: construir ya la interfaz pensando en un score híbrido filtro+semántica desde ahora — rechazado por el pedido explícito de "comenzar con filtros y búsqueda tradicional" sin sobre-construir la abstracción antes de necesitarla.

## Decisión 3 — El análisis no re-litiga recomendaciones ya rechazadas (Edge Case)

**Decisión**: `analizador.ts` recibe, además de las conversaciones piloto incluidas, la lista de `RecomendacionComportamiento` ya `RECHAZADA` de esa instancia/agente, y se le indica explícitamente al modelo (en el prompt del propio análisis) que no repita una recomendación equivalente a una ya rechazada — comparación por similitud de texto simple (normalización + comparación de la regla sugerida), no una garantía absoluta de no-repetición exacta.

**Rationale**: cumplir el Edge Case de la spec ("no se vuelve a proponer de forma idéntica") de forma pragmática — una garantía absoluta requeriría comprensión semántica perfecta, que no es necesaria para el valor pedido (evitar ruido obvio y repetitivo en la bandeja del administrador).

**Alternativas consideradas**: deduplicación exacta por hash de texto — insuficiente, porque el modelo puede redactar la misma idea con palabras distintas en cada corrida; se prefiere darle el contexto de lo ya rechazado y dejar que el propio análisis evite repetirlo, con normalización de texto como red de seguridad adicional.

## Decisión 4 — "Convertir en regla" es una redirección, no una escritura directa

**Decisión**: la acción "convertir en regla" sobre una `RecomendacionComportamiento` no escribe directamente en `AgenteIAConfig`/`AgenteIAConfigVersion` (de `009`) — pre-llena el formulario de edición de reglas de `009` (sección Reglas) con el texto de `reglaSugerida` y navega ahí, dejando que el administrador confirme y publique a través del flujo de versionado ya validado por `009` (borrador → publicar).

**Rationale**: preserva la garantía de `009` de que toda publicación pasa por un borrador explícito y por la detección de contradicciones ya implementada ahí — duplicar esa lógica dentro de `014` sería reinventar algo ya resuelto y arriesgaría inconsistencias entre los dos caminos de escritura hacia la misma tabla.

**Alternativas consideradas**: escribir directamente un borrador nuevo en `AgenteIAConfigVersion` desde `014` — rechazada por duplicar responsabilidad; `009` ya expone `guardarBorradorAgenteIA` como el único punto de entrada esperado para modificar reglas.
