# Research: Cobertura geográfica y costos de envío por transportista y delivery

## Contexto de código confirmado (antes de decidir)

- **Zonas hoy son texto libre**: `ZonaCobertura.nombre` (string) sin ninguna estructura de país/estado. El match en `calcular-costo-envio.tool.ts` y `validar-cobertura.tool.ts` es un `findFirst` por nombre exacto de zona — sin catálogo, sin normalización.
- **El costo hoy vive en el método de entrega, no en el transportista**: `MetodoEntregaConfig` es único por `(instanciaId, metodoEntrega)` — un solo costo base por método (ej. un único costo para "Courier externo"), y `ZonaCoberturaMetodo` agrega costo adicional por zona a ese método, no al transportista concreto. `Transportista` (nombre, tipo, activo) es solo una etiqueta filtrada por `tipo` en los formularios — nunca participa en el cálculo de costo. Esto es exactamente el defecto que el spec pide corregir (FR-001).
- **No existe ningún campo geográfico en Cotización/Pedido**: ni `Cotizacion` ni `Pedido` ni `EntregaCotizacion`/`EntregaPedido` tienen país/estado/ciudad. La única ubicación geográfica que existe en todo el schema es `ConfiguracionEmpresa.pais/provincia/ciudad/direccion` — texto libre, y representa la dirección de la propia empresa, no del destino de un envío.
- **`EntregaCotizacionSchema` ya se llena en la creación de la cotización** (`form-cotizacion.tsx`), junto a `transportistaId`, `metodoEntrega` y `costoEnvio` — no es un paso posterior. `EntregaPedido` se completa/edita después vía `form-entrega.tsx` (y se siembra desde `EntregaCotizacion` al generar el pedido — ver `generar-pedido-desde-cotizacion.service.ts`). Esto fija dónde deben vivir los nuevos campos geográficos: junto a `transportistaId` en `EntregaCotizacion`/`EntregaPedido`, no en `Cotizacion`/`Pedido` directamente.
- **El costo de envío final vive en `Cotizacion.costoEnvio`/`Pedido.costoEnvio`** (decisión ya documentada en el código: así los KPIs de Pedidos hacen `_sum` sin join). El nuevo cálculo por zona debe **sugerir/prellenar** ese campo existente, no reemplazar su ubicación.
- **La escalación a humano hoy es 100% responsabilidad del LLM**: `transferir_a_humano` es una tool más; nada fuerza su ejecución. El único lugar con lógica server-side de "cuándo debe intervenir un humano" es `src/ai/autonomia/gate.ts` (spec 016), que actúa en una capa distinta: decide si una respuesta *ya generada* se envía, se retiene para aprobación o se bloquea, según el nivel de autonomía configurado por categoría de intención (`COSTO_ENVIO` incluida). Ese gate no impide que el LLM invente un costo dentro del texto de la respuesta — solo controla el envío de esa respuesta.
- **No existe ningún catálogo de países/estados en el proyecto**, ni como tabla Prisma ni como dependencia npm (`package.json` no tiene ninguna librería de geografía).

## Decisiones

### Decisión 1 — Dónde vive el costo por zona: nuevo modelo por transportista, no reutilizar `ZonaCoberturaMetodo` para eso

**Decisión**: Crear `TransportistaCoberturaGeografica` (transportistaId + paisId + estadoProvinciaId + costoEnvio + activo), independiente del `MetodoEntregaConfig` genérico por método. `ZonaCobertura`/`ZonaCoberturaMetodo` se conservan tal cual para el caso "Delivery" (zonas aproximadas), solo se les agrega lo necesario para el modo de cobertura y las excepciones (Decisión 3).

**Rationale**: El pedido original distingue explícitamente dos mundos con reglas distintas: transportista → país/estado formal; delivery propio → zona aproximada libre. Forzar ambos en el mismo modelo (`ZonaCoberturaMetodo`, atado a `MetodoEntregaConfig` por instancia+método, no por transportista individual) reproduciría el defecto actual (costo por método genérico, no por transportista) y complicaría el modelo con campos que no aplican a un lado o al otro.

**Alternativas consideradas**:
- Agregar `paisId`/`estadoProvinciaId` opcionales a `ZonaCobertura` y mantener todo en una sola tabla — rechazado: mezclaría dos semánticas distintas (catálogo formal vs. texto libre) en las mismas columnas, con validaciones condicionales frágiles, y no resolvería que el costo siga atado al método en vez de al transportista.
- Modelar el costo directamente en `Transportista` como tabla de tarifas planas por país (sin estado) — rechazado: el pedido pide explícitamente granularidad de estado/provincia.

### Decisión 2 — Catálogo de países/estados: tablas Prisma **precargadas** (seed), no una API en runtime

**Decisión**: Nuevos modelos `Pais` (catálogo global, no por instancia) y `EstadoProvincia` (FK a `Pais`), precargados de una sola vez mediante un script de seed dedicado (ver Decisión 2b) con **cobertura ISO completa** (los ~195 países reconocidos + sus estados/provincias), no solo el subconjunto de LatAm considerado en la primera versión de este research. El catálogo se consulta siempre contra la base de datos local — ninguna operación de negocio (dropdown, match de costo de envío, tools de IA) depende de una llamada de red a un tercero.

**Evaluación explícita — API externa gratuita vs. precarga en base de datos**:

| Criterio | API externa en runtime (ej. restcountries.com, countrystatecity.in) | Precarga en base de datos (elegida) |
|---|---|---|
| Disponibilidad / SLA | Ninguna garantía — son servicios gratuitos sin SLA; una caída externa rompería la creación de cotizaciones/pedidos y las tools de IA (`calcular_costo_envio` depende de resolver país/estado en cada llamada) | Depende solo de la propia base de datos, ya con SLA/backup del proyecto |
| Latencia | Un round-trip HTTP adicional en cada apertura de dropdown y en cada consulta de la IA — inaceptable para un dropdown de UI y para el flujo de escalación (FR-009 exige respuesta inmediata) | Lectura local indexada, mismo orden de magnitud que cualquier otra query del proyecto |
| Integridad referencial | Los IDs de un servicio externo no son estables ni sirven como FK de `TransportistaCoberturaGeografica`/`EntregaCotizacion`/`EntregaPedido` — habría que mapear igual a un id propio | Match 100% determinístico por FK (precondición ya fijada en la Decisión original de este research para FR-013/FR-009) |
| Límites de uso / costo oculto | La mayoría de APIs "gratuitas" de país+estado tienen cuota mensual o requieren API key (ej. countrystatecity.in); `restcountries.com` no requiere key pero **no incluye estados/provincias**, solo países — no cubre el requisito | Sin límites, sin key, sin costo recurrente |
| Cumplimiento constitucional | Es una integración externa nueva sin adapter, sin timeout/retry/degradación definidos — exactamente lo que el Principio IV pide evitar si no aporta algo que no se pueda resolver de otra forma | No agrega ninguna integración nueva al runtime |
| Profesionalismo / UX | El dropdown quedaría bloqueado a la disponibilidad del tercero, y con datos que pueden no incluir código ISO alpha-3, indicativo telefónico o bandera de forma consistente entre servicios | Datos curados una vez, con exactamente los campos que Karia necesita, disponibles instantáneamente |

**Conclusión**: para un dato de referencia que **casi nunca cambia** (países y sus divisiones administrativas), pagar el costo de una dependencia de red en cada operación no se justifica. La opción correcta — y la más profesional para un CRM que factura sobre disponibilidad — es tratarlo como dato de referencia propio, igual que cualquier otro catálogo de Karia.

**Alternativas consideradas**:
- API externa gratuita en runtime — rechazada por la tabla de arriba (SLA, latencia, y falta de cobertura de estados/provincias en la opción sin key).
- Enum de Prisma para país/estado — rechazado: un enum no se puede filtrar/gestionar dinámicamente ni ampliar sin migración, y el volumen de estados por país es demasiado grande para un enum manejable.
- Mantener el alcance inicial solo-LatAm (decisión original de este research) — descartado tras revisar el pedido: el dropdown debe comportarse como el de cualquier CRM profesional (Stripe, HubSpot, Intercom), con el listado ISO completo desde el día uno, no un subconjunto que obligue a pedir soporte para agregar un país.

### Decisión 2b — Origen de los datos del seed y componente de dropdown

**Decisión**: El seed se genera a partir de un dataset estático de código abierto con cobertura ISO 3166-1 (países) e ISO 3166-2 (estados/provincias) — el mismo dataset que respalda paquetes ampliamente usados como `country-state-city` (basado en `dr5hn/countries-states-cities-database`, MIT). Ese paquete se agrega como **`devDependency`**, usado únicamente por un script de seed one-shot (`scripts/seed-geografia.ts`, fuera de `src/`) que lo lee y hace `upsert` en `Pais`/`EstadoProvincia` — **nunca se importa desde código de runtime** (ni Server Components, ni Server Actions, ni tools de IA). Esto respeta la regla de "no dependencia nueva sin necesidad concreta": la necesidad (datos ISO completos y correctos, en vez de tipearlos a mano con riesgo de errores/omisiones) es concreta, y el costo real para el proyecto es cero en producción — no se agrega peso al bundle ni una dependencia que el runtime deba mantener viva.

**Campos adicionales en `Pais`** para que el dropdown muestre "ISO Country y otras cosas" como pide el ajuste: `codigoAlpha3` (ISO 3166-1 alpha-3), `indicativoTelefonico` (ej. "+51"), `banderaEmoji` (ej. "🇵🇪"). Estos campos son puramente presentacionales — el match de cobertura/costo sigue por `id`/`estadoProvinciaId`, nunca por estos campos.

**Componente de dropdown**: Karia ya tiene los primitivos necesarios en `src/components/ui/` (`command.tsx` sobre `cmdk`, `popover.tsx`) — no se crea ningún primitivo nuevo. Se construye un patrón compuesto `selector-pais.tsx` / `selector-estado-provincia.tsx` en `src/shared/entregas/components/` (reutilizable desde configuración de transportista, configuración geográfica de la instancia, y los formularios de cotización/pedido) siguiendo el patrón Combobox estándar de shadcn: `Popover` + `Command` con búsqueda por texto, mostrando bandera + nombre + código ISO2, filtrado en cliente sobre la lista ya cargada (la lista completa de países cabe cómoda en una sola respuesta cacheada por TanStack Query; los estados/provincias se cargan solo del país seleccionado). Esto es intencionalmente un Combobox propio y no el `<Select>` de base-ui documentado en `docs/selects.md` — con ~195 países y potencialmente decenas de estados por país, se necesita filtrado por texto, que el `<Select>` simple no ofrece.

**Rationale**: separar "de dónde viene el dato" (paquete npm, solo en build-time/seed-time) de "cómo se sirve el dato" (tabla propia, en runtime) da lo mejor de ambos mundos: cobertura profesional completa sin pagar el costo de una dependencia de runtime ni de una integración externa fragil.

**Alternativas consideradas**:
- Copiar el JSON del dataset directamente al repo (sin instalar el paquete ni siquiera como devDependency) — válido y más "cero dependencias", pero pierde la trazabilidad de versión/actualizaciones del dataset si Karia necesita re-sembrar con datos corregidos más adelante; se prefiere la devDependency por reproducibilidad del seed.
- Usar el `<Select>` existente de `src/components/ui/select.tsx` en vez de un Combobox — rechazado para el selector de país por volumen (195 opciones sin buscador es mala UX); el `<Select>` simple sí se mantiene para el selector de estado/provincia cuando un país tiene pocas divisiones, a discreción de implementación, pero el contrato por defecto es Combobox para ambos por consistencia.

### Decisión 3 — Modo de cobertura de Delivery y excepciones: extensión aditiva de `MetodoEntregaConfig`/`ZonaCoberturaMetodo`, no un modelo paralelo

**Decisión**: Agregar `modoCobertura: ModoCoberturaDelivery` (`TODOS_LADOS_CON_EXCEPCIONES` | `SOLO_ZONAS_EVALUADAS`, default `SOLO_ZONAS_EVALUADAS` — mismo criterio conservador que ya usa el proyecto en `gate.ts`: "favorece la revisión humana sobre el envío automático") a `MetodoEntregaConfig`, y un campo `esExcepcion: Boolean` (default `false`) a `ZonaCoberturaMetodo`. La fila existente `cubierta: Boolean` se conserva sin cambios de significado para no romper las dos tools que ya la usan.

**Rationale**: `ZonaCoberturaMetodo` ya modela "esta zona, para este método, cuesta X y está/no está cubierta" — es la extensión mínima y aditiva (columnas nuevas, nullable con default, sin tocar las existentes) para expresar "esta zona es una excepción explícita" sin duplicar la tabla. Mantener `cubierta` intacto evita una migración de datos sobre una columna que dos tools de producción ya consultan (`validar-cobertura.tool.ts`, `calcular-costo-envio.tool.ts`).

**Regla de validación server-side** (no expresable solo con constraints de Prisma): al guardar una fila de `ZonaCoberturaMetodo`, si `esExcepcion = true` entonces `cubierta` se fuerza a `false` en el mismo write, y el action rechaza explícitamente cualquier intento de guardar `cubierta = true` junto con `esExcepcion = true` (FR-007 — "no se puede declarar la misma zona como cobertura y excepción a la vez").

**Alternativas consideradas**:
- Reemplazar `cubierta: Boolean` por un enum `CUBIERTA | EXCEPCION` — más limpio conceptualmente, pero es una migración de renombre/repurpose sobre una columna ya en uso por dos tools de producción; se descarta a favor de la opción aditiva, más segura para "no romper otras áreas" (instrucción explícita del usuario).

### Decisión 4 — Escalación a humano: server-enforced dentro de las tools de envío, no delegada al criterio del LLM

**Decisión**: Extraer el efecto secundario de `transferir_a_humano` (marcar `Conversacion.clasificacion = SOPORTE` + publicar `EventosSistema.ConversacionClasificada`) a una función interna compartida (`src/ai/tools/shared/transferir-a-humano-interno.ts`), reutilizada tanto por la tool pública `transferir_a_humano` como, directamente, por `calcular_costo_envio`, `validar_cobertura` y `estimar_fecha_entrega` cuando detectan que no hay una coincidencia clara (ver Decisión 5 para qué cuenta como "no clara"). La tool ejecuta la transferencia ella misma — el resultado que recibe el LLM ya indica `"transferidoAHumano": true` y un mensaje que le prohíbe informar costo/cobertura al cliente.

**Rationale**: Constitución Principio IV: "La salida de la IA MUST NOT bypassear reglas deterministas, permisos o validación" — depender de que el modelo decida invocar `transferir_a_humano` tras leer un resultado ambiguo es exactamente ese bypass potencial (un LLM puede alucinar un costo en lugar de escalar). Forzar la transferencia dentro de la propia tool de cálculo hace la regla "si no hay match claro → humano" imposible de saltarse, igual que ya se validan tenant/permisos en cada tool.

**Interacción con el gate de autonomía (spec 016)**: esta escalación es independiente y tiene prioridad sobre `decidirAutonomia`/`gate.ts`. `gate.ts` decide si una respuesta ya generada por el LLM se envía automáticamente, se retiene o se bloquea según el nivel configurado para la categoría `COSTO_ENVIO` — pero si la tool ya transfirió la conversación a soporte, no hay ninguna respuesta de costo que enviar: el gate sigue operando sobre otras categorías/mensajes sin cambios, no se modifica `gate.ts` ni la configuración de autonomía existente.

**Alternativas consideradas**:
- Solo documentar en el prompt del sistema que el agente debe llamar `transferir_a_humano` cuando el costo no sea claro — rechazada: no es determinista, viola el Principio IV, y es exactamente el comportamiento actual que el spec pide corregir ("muy importante").
- Bloquear la respuesta a nivel de `gate.ts` marcando `COSTO_ENVIO` como `HUMAN_ONLY` por defecto — rechazada: eso bloquearía *toda* pregunta de costo de envío (incluidas las que sí tienen match claro), no solo las ambiguas; no cumple SC-001 (responder con costo exacto cuando sí hay coincidencia).

### Decisión 5 — Qué cuenta como "coincidencia no clara" (criterio único, compartido por las tres tools)

**Decisión**: Una consulta de costo/cobertura se considera **sin coincidencia clara** (→ escalar) cuando ocurre cualquiera de:
1. El país o estado/provincia indicado no resuelve contra el catálogo (`Pais`/`EstadoProvincia`), o el negocio no tiene ninguna cobertura de transportista/delivery cargada.
2. La zona cae bajo un método de delivery en modo `SOLO_ZONAS_EVALUADAS` y no está en su lista explícita de zonas cubiertas.
3. Más de una configuración vigente (más de un transportista, o transportista + delivery) cubre la misma ubicación con costos distintos, y los argumentos recibidos (método de entrega, transportista específico) no alcanzan para elegir una sola.

Una respuesta **sí es clara** (no escala) cuando:
- Hay exactamente una configuración de costo aplicable, **o**
- La zona está explícitamente en la lista de excepciones de un método en modo `TODOS_LADOS_CON_EXCEPCIONES` (esto es una respuesta negativa clara: "no se entrega ahí", no una ambigüedad).

**Rationale**: Esta lista concreta convierte el requisito "no hay coincidencia clara → humano" en una función pura y testeable, en vez de una noción difusa dejada a la implementación de cada tool.

## Alcance explícitamente excluido de esta iteración (evita romper otras áreas)

- **No se modifican `crear_cotizacion`/`crear_pedido`** (tools de IA): hoy ninguna de las dos escribe `costoEnvio` ni entrega — seguirán así. La integración geográfica aplica a las tools de consulta (`calcular_costo_envio`, `validar_cobertura`, `estimar_fecha_entrega`) y a los formularios humanos de creación/edición de entrega.
- **No se toca `gate.ts` ni la configuración de autonomía** (spec 016) — la escalación de esta spec es un mecanismo adicional, no un reemplazo.
- **No se migra ni transforma automáticamente la configuración existente de `ZonaCobertura`** (texto libre) al nuevo modelo — coexisten; cada negocio adopta el nuevo modelo de transportista/país/estado a su ritmo (ya documentado como Assumption en el spec).
- **Ciudad permanece texto libre** (sin catálogo), tal como especifica el spec (FR-014) — no se crea un tercer nivel de catálogo `Ciudad`.
