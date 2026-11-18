# Contrato UI: `<KariaAvatar>` y contexto del asistente

## `<KariaAvatar>` — `src/asistente/karia/karia-avatar.tsx`

Componente cliente, **controlado**, reutilizable en cualquier pantalla autenticada.

```tsx
<KariaAvatar state="idle" emotion="happy" blinking />
<KariaAvatar state="thinking" size={96} />
<KariaAvatar state="success" floating={false} onSuccessEnd={() => setEstado("idle")} />
```

| Prop | Tipo | Default | Comportamiento |
|---|---|---|---|
| `state` | `"idle" \| "thinking" \| "success"` | `"idle"` | Secuencia base y efecto (ver research.md, Decisión 5). |
| `emotion` | `"neutral" \| "happy" \| "calm"` | `"neutral"` | Expresión en `idle`; ignorada en `thinking`/`success`. |
| `blinking` | `boolean` | `true` | Pestañeo espontáneo cada 3–6 s; solo tiene efecto en `idle` + `neutral`. |
| `size` | `number` (px) | `64` | Lado del cuadrado. El sprite es 192 px → nítido hasta 96 px (2×). |
| `floating` | `boolean` | `true` | Flotación vertical continua. |
| `onSuccessEnd` | `() => void` | — | Se llama una vez al terminar la animación de `success` (también con reduced-motion, tras 900 ms). |
| `label` | `string` | — | Si se pasa, `role="img"` + `aria-label`; si no, es decorativo (`aria-hidden`). |
| `className` | `string` | — | Se combina con `cn()`. |

**Garantías**

- `data-slot="karia-avatar"`, `data-state`, `data-emotion` en el nodo raíz (para estilos y tests E2E).
- Cada instancia tiene su propio secuenciador; varias instancias no se sincronizan (FR-016).
- Con `prefers-reduced-motion: reduce`: frame fijo por combinación, sin flotar/rebote/balanceo; los puntos de `thinking` quedan estáticos.
- Con la pestaña oculta no se avanza ningún frame; al volver no se disparan pestañeos acumulados.
- Si el sprite no carga, no se muestra ícono roto (es `background-image`, no `<img>`).
- Oculto en impresión (`print:hidden`).
- No renderiza interactividad: para clic, envolverlo en un `<button>`.

## Contexto — `src/asistente/contexto-asistente.tsx`

```ts
const { state, emotion, pensar, celebrar, reposar } = usarAsistenteKaria();
```

| Miembro | Efecto |
|---|---|
| `pensar()` | `state = "thinking"` (sostenido). |
| `celebrar()` | `state = "success"`; vuelve a `"idle"` sola al terminar (≤ 2 s). |
| `reposar()` | `state = "idle"`. |
| `state`, `emotion` | Lectura del estado actual del flotante. |

- `usarAsistenteKaria()` fuera del Provider lanza un error explícito en desarrollo y devuelve no-ops en producción (las pantallas no deben romperse si el flotante no está montado).
- El contexto solo controla al **flotante**; otras instancias de `<KariaAvatar>` se controlan por props.

## `<AsistenteKariaFlotante>` — `src/asistente/components/asistente-karia-flotante.tsx`

- `<button aria-label="Asistente Karia">` fijo abajo a la derecha, sin fondo, con foco visible; envuelve `<KariaAvatar>` alimentado por el contexto.
- Clic/Enter/Espacio → `celebrar()` + Popover: "Hola, soy Karia. Muy pronto podré ayudarte aquí." (Escape/clic fuera cierra y devuelve el foco).
- No se renderiza en `/crm/inbox*`.
