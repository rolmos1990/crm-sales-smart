# Data Model: Asistente Karia flotante

No hay entidades persistidas, migraciones ni eventos. Todo vive en memoria del navegador, por instancia o en el contexto del flotante.

## Tipos de presentación (`src/asistente/karia/animacion.ts`)

| Tipo | Valores | Notas |
|---|---|---|
| `KariaState` | `"idle" \| "thinking" \| "success"` | Qué está haciendo la mascota. |
| `KariaEmotion` | `"neutral" \| "happy" \| "calm"` | Expresión en `idle`; en `thinking`/`success` se ignora. |
| `SecuenciaFrames` | `{ frames: number[]; msPorFrame: number; bucle: boolean }` | `frames` son índices 0–15 del sprite. |
| `AnimacionResuelta` | `{ base: SecuenciaFrames; efecto: "ninguno" \| "balanceo" \| "rebote"; puntos: boolean; admitePestaneo: boolean; frameReducido: number }` | Salida pura de `resolverAnimacion()`. |

## Estado del flotante (`AsistenteKariaProvider`)

| Campo | Tipo | Inicial |
|---|---|---|
| `state` | `KariaState` | `"idle"` |
| `emotion` | `KariaEmotion` | `"neutral"` |

### Transiciones

```text
          pensar()                 celebrar()
idle ───────────────▶ thinking ───────────────▶ success
 ▲  ◀─────────────────    │                        │
 │       reposar()        │ celebrar()             │ onSuccessEnd  (o salvaguarda 2 s)
 │                        ▼                        │
 └─────────────────────────────────────────────────┘
```

- Gana la última llamada (FR-007). `celebrar()` estando en `success` reinicia el rebote (incrementa una `clave` que el avatar usa para reiniciar).
- El pestañeo **no** es un estado del contexto: es un sub-ciclo interno del avatar, activo solo si `state="idle"`, `emotion="neutral"`, `blinking=true` y sin reduced-motion.

## Reglas de validación (cubiertas por `animacion.test.ts`)

- Todo índice de frame en las tablas ∈ [0, 15].
- `intervaloParpadeo(aleatorio)` ∈ [3000, 6000) ms para `aleatorio` ∈ [0, 1).
- `success` resuelve `bucle: false` y duración total < 2000 ms (SC-003).
- `admitePestaneo` es `true` solo para `idle` + `neutral`.
- Cada combinación tiene `frameReducido` definido (FR-010).
