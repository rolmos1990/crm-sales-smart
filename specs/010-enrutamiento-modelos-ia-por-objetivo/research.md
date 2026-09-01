# Research: Enrutamiento de modelos de IA por objetivo

## Decisión 1 — Shape de `ProveedorIA.casosDeUso`

**Decisión**: `casosDeUso` deja de estar muerto y pasa a almacenar, en el registro de `ProveedorIA` que corresponda, la lista de objetivos (`TareaIA[]`, más el caso especial `CHAT_RAZONAMIENTO_SUPERIOR`) para los que ese proveedor es el asignado. La resolución vive centralizada en una nueva función `resolverProveedorPorObjetivo(instanciaId, tarea, requiereRazonamientoSuperior?)`: busca entre los `ProveedorIA` activos de la instancia el que tenga la tarea (o `CHAT_RAZONAMIENTO_SUPERIOR` si aplica) en su `casosDeUso`; si ninguno coincide, delega en el criterio actual de `seleccionarProveedor` (prioridad + `tipoAgenteIA`).

**Rationale**: Guardar la asignación "desde el proveedor" (en vez de una tabla `AsignacionObjetivo` separada) reutiliza el modelo ya existente y su índice `@@unique([instanciaId, proveedor, tipoAgenteIA])`, evitando una tabla nueva para un mapa simple de 7 entradas por instancia. Es coherente con que `casosDeUso` ya está definido en ese modelo desde el diseño original.

**Alternativas consideradas**: tabla nueva `AsignacionObjetivoIA(instanciaId, tarea, proveedorIAId)` — más normalizado, pero agrega una tabla y un join para un dato que cambia poco y ya tiene un lugar reservado en el schema actual; se descarta por simplicidad y porque no hay necesidad de historial o auditoría sobre la asignación en sí (eso ya lo cubre `UsoIA` por llamada, FR-009).

## Decisión 2 — Cómo desacoplar el eje "objetivo" del eje "tipo de agente"

**Decisión**: `seleccionarProveedor(instanciaId, tipoAgente?)` se mantiene como está (nadie que la llame hoy se rompe), pero gana un parámetro opcional `tarea?: TareaIA` y delega primero en `resolverProveedorPorObjetivo`. Si esa función encuentra una asignación explícita para la tarea, la usa (ignorando `tipoAgente` para esa llamada puntual); si no encuentra nada, cae exactamente al comportamiento actual (orden por `tipoAgente` → general → cualquiera).

**Rationale**: Los dos ejes son ortogonales por diseño (rol del agente vs. objetivo puntual de la llamada) — mezclarlos en una sola prioridad lineal como hoy no permite expresar "este agente COMERCIAL, cuando resume, debe usar el proveedor barato aunque su proveedor COMERCIAL asignado sea el caro". Priorizar el objetivo sobre el tipo de agente cuando ambos aplican es la lectura más directa del pedido del usuario ("dependiendo del objetivo que necesite llamar a una IA diferente").

**Alternativas consideradas**: combinar ambos ejes en un único score de prioridad — rechazada por ser más difícl de razonar y de exponer en una UI simple de dropdown por objetivo.

## Decisión 3 — Señal de "requiere razonamiento superior" para CHAT

**Decisión**: Se agrega `requiereRazonamientoSuperior?: boolean` a `SolicitudIA`/`SolicitudConHerramientas`. Cuando es `true` y la tarea es `CHAT`, `resolverProveedorPorObjetivo` busca el proveedor asignado al caso especial `CHAT_RAZONAMIENTO_SUPERIOR` en `casosDeUso`; si es `false`/ausente, busca el asignado a `CHAT` estándar. Ningún llamador actual pasa este parámetro (queda `undefined` → comportamiento actual preservado).

**Rationale**: Es el punto de extensión mínimo y explícito que el pedido necesita ("reservar un modelo superior para... clientes molestos... ambigüedad elevada") sin construir la detección de esas señales en esta spec (eso es de `012-perfil-dinamico-cliente` y `013-context-builder-capas-precedencia`). Deja la responsabilidad de "cuándo activar la señal" completamente del lado del llamador, que hoy no existe pero que las specs futuras completarán sin tener que volver a tocar el orquestador.

**Alternativas consideradas**: inferir automáticamente la complejidad dentro de esta misma spec (ej. heurística de longitud de mensaje o palabras clave) — rechazada por estar fuera del alcance declarado (Assumptions de `spec.md`) y por el riesgo de una heurística pobre que dé falsa sensación de "detección de cliente molesto" sin la información real (perfil de cliente) que eso requiere.

## Decisión 4 — `IDENTIFICACION_PRODUCTO` como valor nuevo de `TareaIA`

**Decisión**: se agrega como valor adicional del enum existente, no como enum separado. Ningún valor existente se renombra ni se elimina — es un cambio de schema puramente aditivo (Prisma soporta agregar valores a un enum sin migración destructiva).

**Rationale**: El pedido del usuario lista "identificación inicial de productos" como un objetivo propio, distinto de "extracción de datos" genérica — mantenerlos separados permite asignarles proveedores distintos si el negocio lo necesita, sin perder la distinción semántica que el propio pedido hace.
