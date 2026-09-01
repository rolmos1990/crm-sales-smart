# Research: Playbooks de estrategia comercial y selección explicable

## Decisión 1 — Catálogo cerrado de tipo de relación e intención comercial

**Decisión**: se define ahora, en esta spec, el catálogo cerrado de valores (como enums de aplicación, no necesariamente enums de Prisma todavía) que usarán tanto las condiciones de aplicación de un playbook como — más adelante — `012-perfil-dinamico-cliente`:

- `TipoRelacionCliente`: `NUEVO_CONTACTO`, `PROSPECTO_RECURRENTE`, `CLIENTE_NUEVO`, `CLIENTE_REGULAR`, `CLIENTE_INACTIVO`, `CLIENTE_CON_INCIDENCIA`.
- `IntencionComercial`: `EXPLORANDO`, `COMPARANDO`, `SOLICITANDO_RECOMENDACION`, `CONSULTANDO_PRECIO`, `CONSULTANDO_DISPONIBILIDAD`, `LISTO_PARA_COTIZAR`, `LISTO_PARA_COMPRAR`, `ESPERANDO_INFORMACION`, `REQUIERE_SEGUIMIENTO`, `REQUIERE_ATENCION_HUMANA`.

**Rationale**: son exactamente los valores enumerados en el pedido original del usuario para el perfil dinámico del cliente (`docs/AGENTE-IA-EVOLUCION-ANALISIS.md`, sección "Perfil dinámico del cliente"). Definirlos acá, en tipos compartidos (`src/ai/estrategia/tipos.ts`), evita que `012` tenga que redefinirlos o que ambas specs diverjan en vocabulario — `012` los importará en vez de duplicarlos.

**Alternativas consideradas**: dejar el catálogo abierto (string libre) hasta que `012` exista — rechazada porque las condiciones de aplicación de un playbook (FR-006) necesitan comparar contra valores conocidos para que la selección (FR-007) sea determinística y testeable; un string libre no permite eso sin normalización adicional.

## Decisión 2 — Shape del contenido de una estrategia

**Decisión**: `contenido: Json` con shape `{ reglas: string[] }` — una lista simple de reglas/pasos en lenguaje natural, igual espíritu que las 7 plantillas del pedido (cada plantilla es una lista de bullets). Sin sub-estructura ni condicionales internos.

**Rationale**: coincide con el Assumption de la spec ("no es un formato ejecutable"); es el shape más simple que representa fielmente las 7 plantillas dadas, y es trivial de convertir a texto para insertarlo como capa de prompt en `013`.

**Alternativas consideradas**: estructurar el contenido en pasos tipados (ej. `{ tipo: "pregunta" | "afirmacion", texto: string }[]`) — rechazada por sobre-ingeniería para el alcance pedido; ninguna de las 7 plantillas necesita distinguir tipos de paso para funcionar como reglas de prompt.

## Decisión 3 — Condiciones de aplicación: coincidencia exacta + prioridad como desempate

**Decisión**: `condiciones: Json` con shape `{ tiposRelacion: TipoRelacionCliente[]; intenciones: IntencionComercial[] }` (ambas listas opcionales/vacías = "aplica siempre que se le asigne, sin restricción de esa dimensión"). Una estrategia "coincide" con una situación si: (a) `tiposRelacion` está vacío o incluye el tipo de relación actual, **y** (b) `intenciones` está vacío o incluye la intención actual. Si más de una estrategia asignada coincide, gana la de mayor `prioridad` (entero, mayor = más prioritaria); si empatan en prioridad, se toma la de asignación más reciente (determinístico, no aleatorio) y se registra el empate en el log (Edge Case de la spec).

**Rationale**: es el modelo más simple que soporta las 7 plantillas dadas — cada una tiene una condición natural clara (ej. "Cliente nuevo" ⇔ `tiposRelacion: [NUEVO_CONTACTO, CLIENTE_NUEVO]`) sin necesitar lógica booleana compleja (AND/OR anidado) que el pedido no describe.

**Alternativas consideradas**: motor de reglas con expresiones booleanas arbitrarias — rechazado por sobre-ingeniería; nada en el pedido original sugiere necesitar condiciones compuestas más allá de tipo de cliente + intención.

## Decisión 4 — El selector es una función pura, no un servicio con I/O

**Decisión**: `seleccionarEstrategia(estrategiasAsignadas: EstrategiaAsignada[], senales: { tipoRelacion?: TipoRelacionCliente; intencion?: IntencionComercial }): ResultadoSeleccion` es una función pura en `src/ai/estrategia/selector.ts`, sin acceso a Prisma. La carga de `estrategiasAsignadas` (query) y la escritura del log de selección (mutación) ocurren en la capa que la invoca (`src/ai/contexto/constructor.ts` o quien la use desde `013`), no dentro del selector mismo.

**Rationale**: máxima testeabilidad (Vitest sin mocks de base de datos) y reutilización — el mismo selector podrá usarse desde el flujo real de generación y desde el simulador (`018`) sin duplicar lógica, cambiando solo de dónde vienen `estrategiasAsignadas` y `senales`.

**Alternativas consideradas**: método de instancia de un "servicio" con Prisma inyectado — rechazado por ser innecesario para una función de selección sin estado ni dependencias externas.

## Decisión 5 — Semilla de las 7 plantillas

**Decisión**: se agregan al `prisma/seed.ts` existente (no se reemplaza el seed actual) como datos condicionales: al crear/asegurar una instancia, si no existen ya playbooks con `origen = PLANTILLA` para esa instancia, se insertan las 7 con `activo: false`. Es idempotente — correr el seed de nuevo no duplica plantillas ya existentes.

**Rationale**: sigue el patrón ya usado por el seed actual del proyecto (poblar datos base de forma reproducible); mantiene el criterio del pedido de que las plantillas están precargadas pero **inactivas** por defecto (el negocio decide cuáles usar).
