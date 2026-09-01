# Data Model: Conversaciones piloto y recuperación de ejemplos relevantes

## Enums nuevos

- `ClasificacionPiloto`: `POSITIVO` | `NEGATIVO`
- `EstadoRecomendacion`: `PENDIENTE` | `APROBADA` | `RECHAZADA` | `CONVERTIDA_REGLA` | `CONVERTIDA_EJEMPLO`

## `ConversacionPiloto` (nuevo)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `instanciaId` | `String` | Índice de aislamiento. |
| `conversacionOrigenId` | `String` | FK a `Conversacion`, `onDelete: Restrict` — se conserva la referencia para auditoría humana (FR-006); no se expone al modelo de IA (solo `contenidoAnonimizado` se usa para eso). |
| `clasificacion` | `ClasificacionPiloto` | Positivo/negativo (FR-002). |
| `explicacion` | `String` | Por qué representa buena/mala atención. |
| `contenidoAnonimizado` | `Json` | Copia de los mensajes relevantes con sustitución determinística aplicada (`{ mensajes: Array<{ rol: "user" \| "assistant"; texto: string }> }`) — la `Conversacion`/`Mensaje` originales nunca se modifican. |
| `intencion` | `String?` | Uno de `IntencionComercial` (`011`). |
| `tipoCliente` | `String?` | Uno de `TipoRelacionCliente` (`011`). |
| `productoId` | `String?` | FK opcional a `Producto`. |
| `playbookEstrategiaId` | `String?` | FK opcional a `PlaybookEstrategia` (`011`). |
| `incluidaEnPerfil` | `Boolean @default(false)` | FR-005 — falso hasta confirmar anonimización explícitamente. |
| `anonimizadaEn` | `DateTime?` | `null` hasta que se ejecuta la anonimización — bloquea `incluidaEnPerfil = true` mientras sea `null` (Edge Case). |
| `creadaPorUsuarioId` | `String?` | FK a `Usuario`, `onDelete: SetNull`. |
| `creadoEn` / `actualizadoEn` | `DateTime` | Estándar del proyecto. |

Índices: `@@index([instanciaId, incluidaEnPerfil])`.

## `RecomendacionComportamiento` (nuevo)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `instanciaId` | `String` | |
| `agenteIAConfigId` | `String?` | Puede ser general (instancia) o específica de un agente. |
| `titulo` | `String` | |
| `descripcion` | `String` | |
| `reglaSugerida` | `String` | |
| `confianza` | `Float` | 0–1. |
| `estado` | `EstadoRecomendacion @default(PENDIENTE)` | |
| `playbookEstrategiaAsociadoId` | `String?` | FK opcional a `PlaybookEstrategia` (FR-009 — "asociar con una estrategia específica"). |
| `basadaEnConversacionesPilotoIds` | `Json` | `string[]` — ids de `ConversacionPiloto` que originaron esta recomendación (para trazabilidad, no relación Prisma formal por ser N:M ligera). |
| `resueltaPorUsuarioId` | `String?` | Quién aprobó/rechazó/convirtió. |
| `resueltaEn` | `DateTime?` | |
| `creadoEn` | `DateTime @default(now())` | |

Índices: `@@index([instanciaId, estado])`.

## `EjemploPrompt` (nuevo)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `instanciaId` | `String` | |
| `agenteIAConfigId` | `String?` | `null` = disponible para cualquier agente de la instancia. |
| `conversacionPilotoOrigenId` | `String` | FK a `ConversacionPiloto`, `onDelete: Cascade`. |
| `contenido` | `Json` | Copia de `ConversacionPiloto.contenidoAnonimizado` en el momento de crear el ejemplo (independiente si la piloto de origen cambia después). |
| `intencion` / `tipoCliente` / `productoId` / `playbookEstrategiaId` | igual que en `ConversacionPiloto` | Heredadas al crear el ejemplo, editables después de forma independiente. |
| `calidad` | `Float` | Derivada al crear (`1.0` si `ClasificacionPiloto.POSITIVO` y confianza alta de su recomendación de origen; menor en otro caso) — usada para desempate en `research.md` Decisión 2. |
| `activo` | `Boolean @default(true)` | Permite desactivar un ejemplo sin eliminarlo (equivalente a "excluido"). |
| `creadoEn` | `DateTime @default(now())` | |

Índices: `@@index([instanciaId, activo])`.

## Relación con entidades existentes

```text
Conversacion (existente, sin modificar) ──(referencia de solo auditoría)──> ConversacionPiloto
                                                                                    │
                                                                                    │ N (agrupadas en un análisis)
                                                                                    ▼
                                                                    RecomendacionComportamiento
                                                                                    │
                                                                        (acción: convertir en ejemplo)
                                                                                    ▼
                                                                              EjemploPrompt ──> capa 9 de 013 (RecuperadorEjemplos)
```

## Interfaz `IRecuperadorEjemplos` (no Prisma, `src/ai/piloto/recuperador-ejemplos.ts`)

```ts
interface CriteriosRecuperacion {
  instanciaId: string;
  agenteIAConfigId: string;
  intencion?: IntencionComercial;
  tipoCliente?: TipoRelacionCliente;
  playbookEstrategiaId?: string;
  productoId?: string;
}

interface EjemploRecuperado {
  id: string;
  contenido: { mensajes: Array<{ rol: "user" | "assistant"; texto: string }> };
  etiquetasCoincidentes: number;
}

interface IRecuperadorEjemplos {
  recuperar(criterios: CriteriosRecuperacion): Promise<EjemploRecuperado[]>; // longitud 0-4
}
```
