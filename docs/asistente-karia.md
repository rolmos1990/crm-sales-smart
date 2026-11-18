# Asistente Karia (mascota animada)

Spec: [`specs/038-asistente-karia-flotante/`](../specs/038-asistente-karia-flotante/spec.md) · Contrato: [`contracts/karia-avatar.md`](../specs/038-asistente-karia-flotante/contracts/karia-avatar.md)

## Piezas

| Pieza | Archivo | Para qué |
|---|---|---|
| `<KariaAvatar>` | `src/asistente/karia/karia-avatar.tsx` | La mascota, reutilizable en cualquier pantalla. Controlada por props. |
| Tablas de animación | `src/asistente/karia/animacion.ts` | Única fuente de verdad de qué frames se ven en cada combinación (testeada). |
| Efectos | `src/asistente/karia/karia-avatar.css` | Flotar, rebote, balanceo, globo de puntos, reduced-motion, impresión. |
| Contexto | `src/asistente/contexto-asistente.tsx` | `usarAsistenteKaria()` → `pensar / celebrar / reposar` del **flotante**. |
| Flotante | `src/asistente/components/asistente-karia-flotante.tsx` | Botón fijo abajo a la derecha + saludo "Próximamente". Oculto en `/crm/inbox`. |
| Montaje | `src/shared/ui/layout-app-servidor.tsx` | Provider + flotante diferido: solo existe con sesión. |
| Vitrina | `/dev/karia` | Solo desarrollo (404 en producción). |

## Mover el flotante

Aparece abajo a la derecha, pero se puede llevar a cualquier punto de la pantalla:

- **Arrastrar** con mouse o dedo (`src/asistente/components/usar-arrastre-flotante.ts`). Un gesto de menos de 5 px sigue siendo un clic; soltar un arrastre **no** abre el saludo.
- **Teclado** (con el botón enfocado): flechas mueven 16 px (Shift: 64 px); **Inicio** la devuelve a la esquina.
- La posición se recuerda **por navegador** (`localStorage`, clave `karia:asistente:posicion`): cada pantalla estorba en un lugar distinto. Si el almacenamiento está bloqueado, dura la sesión.
- Nunca queda fuera de la ventana: se reubica al achicarla o al rotar el móvil (`limitarPosicion` en `src/asistente/posicion.ts`, testeada).

## Uso

```tsx
<KariaAvatar state="idle" emotion="happy" blinking />
<KariaAvatar state="thinking" size={96} />
<KariaAvatar state="success" floating={false} onSuccessEnd={() => setEstado("idle")} />
```

```tsx
const { pensar, celebrar, reposar } = usarAsistenteKaria();
pensar();            // mientras se procesa algo
celebrar();          // al terminar bien; vuelve solo a idle (< 2 s)
```

`state`: `idle | thinking | success` · `emotion`: `neutral | happy | calm` (solo en `idle`) · `blinking` solo tiene efecto en `idle` + `neutral` · `size` en px (nítido hasta 96) · `floating` · `label` (sin él es decorativo) · `reinicio` (cambiarlo repite la animación).

Las props van en inglés a pedido explícito (excepción documentada en `plan.md`); lo interno, en español.

## Sprite

`public/asistente/karia-sprite.webp`: tira de 16 frames de 192×192 con alfa, generada desde `assets/asistente/KariAI.png` (cuadrícula 4×4 sin alfa):

```bash
npx tsx scripts/generar-sprite-karia.ts                    # quita el fondo blanco hueso
npx tsx scripts/generar-sprite-karia.ts --ya-transparente  # si la fuente ya trae alfa
```

El script imprime la ruta de una vista previa (sobre cuadros y sobre oscuro): revisarla antes de commitear. Falla si el WebP pasa de 150 KB.

| Frames (0–15) | Uso |
|---|---|
| 0–3, 12–15 | Reposo (vaivén de cabeza) |
| 4, 5, 7, 9, 10, 11 | Pestañeo |
| 6 | Feliz / éxito |
| 7, 8, 9 | Tranquila |
| 5, 7, 8 | Pensando |

**Por qué no GIF**: sin alfa suave (halo blanco en tema oscuro), 256 colores (bandas en el verde), y una animación fija por archivo impide cambiar de estado o respetar `prefers-reduced-motion`.
