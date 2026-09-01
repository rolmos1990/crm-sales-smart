# Data Model: Perfil estructurado y versionado del agente de IA

## AgenteIAConfig (extendido — versión publicada vigente)

Campos ya existentes: sin cambios (`sistemaPrompt`, `personalidad`, `objetivo`, `especialidad`, `tipo`, `temperaturaOverride`, `modeloPreferido`, `herramientas`, `canalesPermitidos`, `memoriaHabilitada`, `limiteTokensCtx`, `instrucciones`, `configuracionTono`, `usuarioId`, `instanciaId`).

Campos nuevos (todos opcionales, default = comportamiento actual):

| Campo | Tipo | Notas |
|---|---|---|
| `nombreAgente` | `String?` | Nombre visible del agente (FR-001). Distinto de `Usuario.nombre` (la persona/cuenta). |
| `rol` | `String?` | Rol del agente en una frase (FR-001), ej. "Asesor comercial". |
| `idiomaPrincipal` | `String?` | Código de idioma (ej. `es`), default implícito = idioma del cliente (comportamiento actual del builder). |
| `idiomasPermitidos` | `Json?` | `string[]` — si vacío/null, sin restricción (comportamiento actual). |
| `longitudRespuesta` | `String?` | Enum lógico: `CORTA` \| `MEDIA` \| `LARGA` (FR-002). |
| `proactividad` | `String?` | Enum lógico: `BAJA` \| `MEDIA` \| `ALTA` (FR-002). |
| `intensidadComercial` | `String?` | Enum lógico: `SUAVE` \| `MODERADA` \| `DIRECTA` (FR-002). |
| `estiloRecomendacion` | `String?` | Enum lógico: `CONSULTIVO` \| `DIRECTO` \| `COMPARATIVO` (FR-002). |
| `frasesPreferidas` | `Json?` | `string[]` (FR-003). |
| `frasesProhibidas` | `Json?` | `string[]` (FR-003). |
| `comportamientosProhibidos` | `Json?` | `string[]` (FR-003). |
| `reglasPersonalizadas` | `Json?` | `string[]` (FR-003) — distinto de `instrucciones` existente: `instrucciones` queda como "instrucciones adicionales" libres ya soportadas; `reglasPersonalizadas` es el nuevo campo estructurado pedido explícitamente por la spec, mostrado en su propia sub-sección (Reglas). |
| `condicionesTransferenciaHumano` | `Json?` | `string[]` (FR-004). |

Nota de compatibilidad: ningún campo existente cambia de tipo, default ni nombre. `Prisma.JsonNull` sigue siendo el valor válido para "sin configurar", igual que hoy.

## AgenteIAConfigVersion (nuevo)

Historial append-only de fotografías de configuración. Reemplaza el flujo actual de `upsert` directo por un flujo borrador → publicar.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `agenteIAConfigId` | `String` | FK a `AgenteIAConfig`, `onDelete: Cascade`. |
| `instanciaId` | `String` | Denormalizado para queries/índices de aislamiento multi-tenant, igual criterio que otras tablas del schema. |
| `numero` | `Int` | Incremental por agente (1, 2, 3…), asignado al publicar. Un borrador no consume número hasta publicarse. |
| `estado` | `EstadoVersionAgenteIA` (enum nuevo: `BORRADOR` \| `PUBLICADA`) | Invariante: como máximo una fila `BORRADOR` y una fila `PUBLICADA` "vigente" por agente en un momento dado (la vigente publicada es señalada por `AgenteIAConfig` mismo, ver abajo). |
| `contenido` | `Json` | Fotografía completa de todos los campos configurables de `AgenteIAConfig` (existentes + nuevos) en el momento de guardar/publicar esta versión. |
| `creadaPorUsuarioId` | `String?` | FK a `Usuario`, `onDelete: SetNull` — quién guardó/publicó. |
| `publicadaEn` | `DateTime?` | Null mientras es borrador. |
| `creadoEn` | `DateTime @default(now())` | |
| `actualizadoEn` | `DateTime @updatedAt` | |

Índices: `@@index([agenteIAConfigId, estado])`, `@@index([instanciaId])`, `@@unique([agenteIAConfigId, numero])`.

**Invariante de negocio** (aplicado en el Server Action, no solo en el schema): al publicar, la fila `BORRADOR` vigente (si existe) pasa a `PUBLICADA` con el siguiente `numero`, y el contenido de esa fila se copia a `AgenteIAConfig` — todo dentro de una transacción Prisma. Restaurar una versión antigua crea una **nueva** fila `PUBLICADA` con el contenido de la versión restaurada (nuevo `numero` correlativo) — nunca se reescribe una fila histórica existente (FR-009, FR-011: no se pierde ninguna versión).

## UsoIA (extendido)

| Campo nuevo | Tipo | Notas |
|---|---|---|
| `agenteIAConfigVersionId` | `String?` | FK a `AgenteIAConfigVersion`, `onDelete: SetNull` (FR-012). Se completa con la versión `PUBLICADA` vigente al momento de generar la respuesta; `null` para respuestas generadas antes de este cambio o para agentes sin ninguna versión publicada (Edge Case de la spec). |

Índice adicional: `@@index([agenteIAConfigVersionId])`.

## Relación con entidades existentes

```text
Usuario (tipo=AGENTE) 1───1 AgenteIAConfig (versión publicada vigente, "viva")
                                │
                                │ 1───N
                                ▼
                     AgenteIAConfigVersion (historial: BORRADOR + PUBLICADA*)
                                │
                                │ 1───N (referenciada desde)
                                ▼
                              UsoIA.agenteIAConfigVersionId
```

\* Como máximo una `PUBLICADA` es "la vigente" en cualquier momento — se determina por ser la de mayor `numero` con `estado = PUBLICADA`, aunque en la práctica coincide siempre con el contenido actual de `AgenteIAConfig` (que se actualiza atómicamente al publicar).

## Reglas de validación (Zod, `agente-schema.ts`)

- Todos los campos nuevos: opcionales.
- Enums lógicos (`longitudRespuesta`, `proactividad`, `intensidadComercial`, `estiloRecomendacion`): `z.enum([...]).nullable().optional()`, mismo patrón que `ConfiguracionTonoSchema.tono` ya existente.
- Listas (`frasesPreferidas`, `frasesProhibidas`, `comportamientosProhibidos`, `reglasPersonalizadas`, `condicionesTransferenciaHumano`, `idiomasPermitidos`): `z.array(z.string()).nullable().optional()`.
- Validación cruzada (no en Zod, en el Server Action antes de publicar): una misma frase no puede estar en `frasesPreferidas` y `frasesProhibidas` a la vez → error de validación (bloqueante, a diferencia de la advertencia de FR-007 que es sobre el texto libre `sistemaPrompt`).
