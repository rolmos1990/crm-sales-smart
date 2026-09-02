# Research: Transportistas por país

## Decisión 1 — `ZonaEntrega` sigue siendo catálogo global por instancia; se filtra por país en las consultas, no se le agrega `transportistaId`

**Contexto**: `ZonaEntrega` (spec 022) es un catálogo reutilizable *por instancia*, sin relación directa con ningún transportista — la relación transportista↔zona vive en `TarifaTransportistaZona`. Hoy `listarZonasEntrega(instanciaId)` devuelve todas las zonas de la instancia sin filtrar por país, y tanto `SeccionZonasTarifas` como `DialogTarifa` reciben esa lista completa sin acotar (`src/app/sales/transportistas/[id]/page.tsx:20`, `src/sales/transportistas/components/dialog-tarifa.tsx`). Esto significa que, tal como está hoy, nada impide asignarle a un transportista de Panamá una tarifa sobre una zona que en realidad cubre Colombia.

**Decisión**: No particionar el catálogo (no agregar `transportistaId` a `ZonaEntrega`) — sigue siendo compartido, para que dos transportistas del mismo país puedan reutilizar la misma zona ("Panamá Centro") sin duplicarla. En su lugar, `listarZonasEntrega` gana un parámetro opcional `paisId`: cuando se pasa, solo devuelve zonas con al menos una `ZonaEntregaUbicacion.paisId` igual. La página de detalle de transportista (`[id]/page.tsx`) siempre lo llama con el país del transportista actual (cuando lo tiene), y ese resultado ya filtrado es lo único que ven `SeccionZonasTarifas`, `DialogTarifa` y `DialogZonaEntrega`.

**Alternativas consideradas**:
- Agregar `transportistaId` a `ZonaEntrega` (partir el catálogo por transportista) — rechazada: rompe la reutilización entre transportistas del mismo país que ya es el diseño explícito de 022 (research.md de 022 lo llama "catálogo reutilizable"), y exigiría migrar/duplicar zonas existentes sin necesidad real.
- Validar el país recién al guardar la tarifa (dejar el selector de zona sin filtrar, solo rechazar en el server si no coincide el país) — rechazada como única medida: el usuario vería opciones de zonas de otros países en el selector y solo se enteraría del error al guardar; filtrar en la consulta es estrictamente mejor UX con el mismo costo de implementación.

## Decisión 2 — `Transportista.paisId` nullable a nivel de base de datos; obligatorio a nivel de negocio para transportistas nuevos

**Contexto**: FR-001 exige país obligatorio, pero FR-008/FR-009 exigen que transportistas ya existentes sigan funcionando aunque su país no pueda inferirse. Ya existe un precedente idéntico en el proyecto: `ConfiguracionEmpresa.paisOperacionId` (spec 019) es `String?` en Prisma —nullable— y la obligatoriedad de tener un país cuando `modoGeografico = UN_SOLO_PAIS` se aplica en Zod/Server Actions, no con `NOT NULL`.

**Decisión**: `paisId String?` en `Transportista`, con relación `onDelete: Restrict` a `Pais` (no se puede borrar un país del catálogo si algún transportista lo referencia — mismo criterio que las demás FKs a `Pais`). `CrearTransportistaSchema` lo exige (`z.string().min(1)`) para todo transportista creado desde este feature en adelante. `EditarTransportistaSchema` lo acepta como opcional, pero la Server Action `editarTransportista` rechaza el cambio si el transportista ya tiene alguna `TarifaTransportistaZona` (Decisión 3).

**Alternativas consideradas**:
- `NOT NULL` con un valor por defecto "país desconocido" ficticio en el catálogo — rechazada: ensucia el catálogo real de países (`Pais` es un catálogo ISO reutilizado en cotizaciones/pedidos, no debe tener entradas artificiales) y no resuelve el problema de fondo (igual habría que distinguir "país real" de "placeholder" en la UI).
- Bloquear el deploy hasta completar manualmente el país de todos los transportistas existentes — rechazada: contradice explícitamente FR-009 ("transportistas existentes deben seguir operando con normalidad").

## Decisión 3 — El país se bloquea (solo lectura) en cuanto el transportista tiene al menos una tarifa configurada

**Contexto**: FR-010 exige impedir dejar zonas/tarifas asociadas a un país distinto al vigente. La señal más simple y ya disponible es la existencia de filas en `TarifaTransportistaZona` para ese transportista — cada tarifa referencia (indirectamente, vía su zona) ubicaciones de un país concreto.

**Decisión**: `obtenerTransportista`/`obtenerTransportistas` agregan un conteo `_count.tarifas` **sin** el filtro `activa: true` (a diferencia del `zonasActivas` que ya existe, que sí filtra por activas — una tarifa desactivada igual "ató" al transportista a un país y no debe liberar el campo). `editarTransportista` rechaza cualquier intento de cambiar `paisId` cuando ese conteo es mayor a 0, con un error de negocio explícito ("No se puede cambiar el país de un transportista con tarifas configuradas — crea un transportista nuevo para operar en otro país"). En el cliente, `SeccionInformacionTransportista` deshabilita visualmente el selector de país en ese mismo caso (candado, igual que en el mockup ya validado con el negocio), pero el rechazo real ocurre en el server (Principio II).

**Alternativas consideradas**:
- Permitir cambiar el país libremente y solo advertir — rechazada: dejaría tarifas/zonas "huérfanas" apuntando a un país que ya no es el del transportista, exactamente el problema que el edge case de la spec identifica.
- Bloquear en cuanto exista una `ZonaEntrega` referenciada (antes de la tarifa) — rechazada: como el catálogo de zonas es compartido (Decisión 1), el transportista nunca "crea" una zona en exclusiva; lo que realmente lo ata a un país es tener una tarifa propia sobre esa zona.

## Decisión 4 — Backfill por script one-shot, mismo patrón que `scripts/seed-geografia.ts`

**Contexto**: FR-008 exige inferir el país de transportistas existentes a partir de sus zonas ya configuradas cuando no hay ambigüedad. Hoy solo existe un transportista real en los datos de ejemplo ("UnoExpress"), pero la lógica debe ser general.

**Decisión**: Nuevo script `scripts/backfill-pais-transportista.ts` (fuera de `src/`, ejecutado una vez con `npx tsx scripts/backfill-pais-transportista.ts`, mismo patrón de conexión que `seed-geografia.ts`): para cada `Transportista` con `paisId IS NULL`, junta los `paisId` distintos de las `ZonaEntregaUbicacion` de todas las zonas con las que tiene alguna `TarifaTransportistaZona` (activa o no); si el conjunto tiene exactamente un elemento, hace `update` con ese `paisId`; si tiene cero o más de uno, lo deja `NULL` (queda "país pendiente"). Idempotente (puede correr más de una vez sin efecto secundario en transportistas que ya tienen país). Se ejecuta como parte del despliegue de este feature, antes de que la UI trate el país como visualmente obligatorio.

**Alternativas consideradas**:
- Migración SQL pura (dentro del archivo de migración de Prisma) — rechazada: la lógica de "inferir si no es ambiguo" necesita agrupar y contar por transportista, más legible y testeable como script TypeScript que como SQL embebido; además rompería con el patrón ya establecido en el proyecto (`seed-geografia.ts`) de mantener esta clase de scripts fuera de las migraciones puras de esquema.
- Pedir al administrador completar el país de todos los transportistas antes de habilitar el feature (sin inferencia automática) — rechazada: peor experiencia que la exigida por FR-008, que pide inferencia automática cuando es posible.

## Decisión 5 — Reutilizar `SelectorPais`/`SelectorEstadoProvincia` sin ninguna integración de API nueva

**Contexto**: El pedido original mencionaba explícitamente "usa un API que me permita obtener provincias o estados por cada país". Investigación de código confirmó que este problema ya está resuelto desde spec 019 (`research.md` de esa spec ya evaluó y descartó un API externo en runtime por límites de cuota/latencia/falta de cobertura de estados) con un catálogo Prisma (`Pais`/`EstadoProvincia`) precargado por `scripts/seed-geografia.ts` desde el dataset `country-state-city`, y expuesto vía los componentes `SelectorPais`/`SelectorEstadoProvincia` (`src/shared/entregas/components/`), ya usados en cotizaciones y pedidos.

**Decisión**: Este feature reutiliza esos dos componentes tal cual existen, sin ninguna integración de API nueva ni cambio al catálogo. El único gap real era que `DialogZonaEntrega` no los usaba (tenía un `<Input>` de texto libre para provincia/estado) — se corrige conectándolo.

**Alternativas consideradas**: Ninguna — no hay alternativa técnica que evaluar aquí, es la aplicación directa de una decisión ya tomada y validada en spec 019.
