# Research: Niveles de autonomía y automatización por intención

## Decisión 1 — Catálogo `CategoriaIntencionAutonomia` y clasificación inicial sembrada

**Decisión**: enum de 16 valores, exactamente los listados en el pedido: `SALUDO`, `CONSULTA_HORARIO`, `PREGUNTA_FRECUENTE`, `INFORMACION_GENERAL`, `RECOMENDACION`, `CONSULTA_PRECIO`, `CONSULTA_DISPONIBILIDAD`, `COSTO_ENVIO`, `SOLICITUD_COTIZACION`, `RECLAMO`, `SOLICITUD_REEMBOLSO`, `DESCUENTO_ESPECIAL`, `PROBLEMA_PAGO`, `EXCEPCION_ENTREGA`, `CLIENTE_MOLESTO`, `COMPROMISO_NO_DEFINIDO`. El seed (extensión de `prisma/seed.ts`) inserta, por instancia, una fila `AutonomiaIntencionConfig` por categoría con el nivel sugerido por el pedido: las primeras 4 → `AUTO_REPLY_SAFE_INTENTS`; las siguientes 5 → `SUGGESTION_ONLY` (documentado como "supervisado" en el pedido — ver Decisión 2 sobre por qué no `CONDITIONAL_AUTOMATION` por default); las últimas 7 → `HUMAN_ONLY`.

**Rationale**: es exactamente la clasificación que el pedido especifica, y sembrarla evita que el negocio tenga que configurar 16 filas manualmente antes de obtener valor — pero **sembrar no es lo mismo que activar el gate** (ver Decisión 3): estas filas sembradas sí representan una configuración explícita según la letra del pedido ("Inicialmente considera seguros/supervisados/humanos..."), así que el gate se activa desde el primer despliegue con esta clasificación por defecto, no con "todo en auto-envío". Esto es intencional y coherente con el pedido original, que pide una clasificación inicial concreta, no un sistema apagado por completo.

**Nota de conciliación con la decisión de negocio ya tomada**: la decisión previa del usuario ("mantener envío automático como default") se interpretó, al nivel de todo el plan de specs, como "ningún negocio pierde su envío automático *sin que exista una razón explícita del propio pedido para restringirlo*". El pedido original de esta sección es esa razón explícita — pide clasificar reclamos/clientes molestos/etc. como `HumanOnly` desde el inicio, como salvaguarda de riesgo, no como una preferencia opcional. Se resuelve así: la clasificación sembrada según el pedido se activa por defecto (protege al negocio de un caso de riesgo conocido), pero el negocio puede revertir cualquier categoría a un nivel más permisivo si lo decide explícitamente (Historia 1) — la "no automatización global" del pedido se cumple porque nunca se asume `CONDITIONAL_AUTOMATION`/`AUTO_REPLY` como default para las categorías sensibles, solo para las 4 explícitamente marcadas como seguras.

**Alternativas consideradas**: no sembrar nada y dejar el gate completamente inactivo hasta configuración manual — rechazada porque el pedido pide explícitamente esta clasificación inicial como parte del alcance, no como una sugerencia opcional de UI vacía.

## Decisión 2 — Categorías "supervisadas" empiezan en `SUGGESTION_ONLY`, no en `CONDITIONAL_AUTOMATION`

**Decisión**: aunque el pedido llama "supervisadas" a recomendaciones/precios/disponibilidad/costos de envío/cotizaciones, el nivel sembrado por defecto para ellas es `SUGGESTION_ONLY` (queda en bandeja, nunca se auto-envía) en vez de `CONDITIONAL_AUTOMATION`.

**Rationale**: `CONDITIONAL_AUTOMATION` requiere condiciones de confianza definidas para decidir cuándo enviar solo con supervisión condicional (Decisión 4) — sembrar esa opción sin que el negocio haya definido o revisado esas condiciones equivaldría a automatizar categorías sensibles con reglas por defecto no revisadas, contradiciendo el espíritu de "no activar automatización global" del pedido. `SUGGESTION_ONLY` es la opción más segura que aun así entrega valor (el agente ya redacta la respuesta, un humano solo la aprueba) — el negocio puede subir a `CONDITIONAL_AUTOMATION` explícitamente cuando defina sus condiciones.

**Alternativas consideradas**: sembrar `CONDITIONAL_AUTOMATION` con una condición de confianza genérica por defecto — rechazada por el riesgo de que una condición no revisada por el negocio termine auto-enviando una cotización o un precio sin verdadera supervisión.

## Decisión 3 — Cuándo el suscriptor clasifica (y cuándo no gasta la llamada)

**Decisión**: antes de clasificar, el suscriptor consulta si el agente tiene **al menos una** fila de `AutonomiaIntencionConfig` con nivel distinto de `AUTO_REPLY_SAFE_INTENTS` para alguna categoría (es decir, si existe alguna restricción real posible). Si no hay ninguna (agente sin ninguna configuración, o con todas las categorías en modo auto-envío), el suscriptor **omite la clasificación** y envía directamente — cero llamadas de IA adicionales, cero cambio de comportamiento ni de costo. Solo cuando existe al menos una categoría restrictiva configurada, el suscriptor clasifica el mensaje entrante para saber si aplica.

**Rationale**: cumple FR-004/SC-001 de forma literal para el caso "nadie tocó nada distinto al comportamiento seguro" y evita gastar una llamada de clasificación en agentes que de todas formas van a auto-enviar siempre — la clasificación solo tiene sentido y costo cuando puede cambiar el resultado.

**Alternativas consideradas**: clasificar siempre, incondicionalmente — rechazada por el costo innecesario en instancias que no usan ninguna restricción, y porque no aporta ningún valor si el resultado de la clasificación nunca podría cambiar la decisión de enviar.

## Decisión 4 — Condiciones de confianza de `ConditionalAutomation`: mínimas y explicables

**Decisión**: `AutonomiaIntencionConfig.condicionesConfianza` (JSON) soporta, en esta spec, dos condiciones simples y combinables con AND: `confianzaMinimaClasificacion: number` (0–1, la propia confianza que la clasificación de categoría reporta) y `requiereAusenciaSenalClienteMolestoEnPerfil: boolean` (si `true`, exige que el perfil de `012` — si está disponible — no indique una incidencia activa ni una intención `REQUIERE_ATENCION_HUMANA`; si el perfil no está disponible, esta condición específica se trata como no cumplida, favoreciendo la revisión humana sobre el envío automático).

**Rationale**: son dos condiciones concretas, explicables en una UI simple (dos campos, no un editor de reglas), y usan señales que ya existen o existirán en el plan de specs (`012`) sin inventar un motor de reglas — coherente con el pedido de "reglas de confianza y validación" sin sobre-construir.

**Alternativas consideradas**: motor de reglas configurable con expresiones arbitrarias — rechazado por sobre-ingeniería frente a lo que el pedido describe ("cuando se cumplen reglas de confianza y validación", sin especificar un lenguaje de reglas).

## Decisión 5 — Resolución de doble categoría (Edge Case) por orden de severidad fijo

**Decisión**: se define un orden de severidad fijo entre niveles: `HUMAN_ONLY` > `SUGGESTION_ONLY` > `CONDITIONAL_AUTOMATION` > `AUTO_REPLY_SAFE_INTENTS`. Si la clasificación (o una clasificación con más de una categoría igualmente probable, ver `clasificador.ts`) produce más de una categoría candidata, se aplica el nivel de la más severa entre ellas.

**Rationale**: es la lectura directa del Edge Case de la spec ("aplicar el nivel más restrictivo"), con un orden total y determinístico fácil de testear.
