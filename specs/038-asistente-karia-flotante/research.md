# Research: Asistente Karia flotante

## Decisión 1 — Formato del asset: sprite WebP con alfa (no GIF, no Lottie)

- **Decision**: Una sola tira horizontal WebP con canal alfa, 16 frames de 192×192 (3072×192), `quality 85`, `alphaQuality 100`.
- **Rationale**: El GIF solo tiene transparencia de 1 bit → el contorno antialias del casco quedaría con halo blanco sobre el tema oscuro; 256 colores → bandas en el brillo verde; una animación fija por archivo impide cambiar de estado sin reiniciar ni respetar `prefers-reduced-motion`. El WebP con alfa resuelve las tres cosas con un único request cacheable.
- **Alternatives considered**: GIF (descartado por lo anterior); APNG (alfa sí, pero mismo problema de "una animación por archivo"); Lottie/Rive (mejor calidad y tamaño, pero requiere redibujar la mascota en vector — mejora futura); 16 PNG sueltos (16 requests y parpadeo al cargar cada frame).

## Decisión 2 — Quitar el fondo: flood fill desde bordes con descontaminación

- **Decision**: Por frame, sobre píxeles crudos (`sharp().raw()`): color de fondo = promedio de esquinas; *flood fill* 4-conexo desde bordes superior/izquierdo/derecho con umbral de distancia RGB ~18; erosión 1 px + blur 1 px de la máscara; *un-matte* del color de fondo en los píxeles semitransparentes; degradado de alfa en el 15 % inferior (torso cortado).
- **Rationale**: Un *chroma key* global borraría también el blanco del casco y del cuerpo. El *flood fill* solo alcanza el fondo conectado al borde; el sombreado gris del casco actúa de barrera. No se rellena desde abajo porque el torso toca ese borde.
- **Alternatives considered**: Modelos de segmentación (rembg) — dependencia Python pesada para un asset de una sola vez; recorte manual en editor — no reproducible (FR-014). Plan B: fuente transparente del autor + flag `--ya-transparente`.

## Decisión 3 — Alineación de frames

- **Decision**: Detectar el bbox de píxeles opacos en la mitad superior de cada frame (cabeza + antena) y trasladar cada frame para que el centro horizontal y el tope de la antena coincidan con la mediana de los 16.
- **Rationale**: La cuadrícula mide 313.5 px por celda (no entera) y el ilustrador movió levemente la cabeza entre frames: sin alinear, la mascota "tiembla" al alternar frames.
- **Alternatives considered**: Recorte fijo por celda sin alinear — temblor visible.

## Decisión 4 — Secuenciador de frames en JS, efectos en CSS

- **Decision**: Las secuencias de frames (no contiguas: 5,6,8,10,11,12…) se describen en una tabla en `animacion.ts` y las reproduce un secuenciador por instancia con `requestAnimationFrame`, que escribe `background-position` directamente sobre el nodo (ref), sin `setState`. Flotación, rebote, balanceo y puntos son `@keyframes` CSS.
- **Rationale**: (a) una sola fuente de verdad de frames, testeable con Vitest; (b) cada instancia es independiente (FR-016); (c) `success` puede avisar su fin (`onSuccessEnd`) de forma determinista; (d) se pausa solo con la pestaña oculta (rAF no corre) y al volver no acumula pestañeos (edge case); (e) cero re-renders.
- **Alternatives considered**: CSS `steps()` puro (idea inicial del plan) — exigía duplicar las tablas de frames en `@keyframes` por cada secuencia, sin forma limpia de detectar el fin ni de testear; `setInterval` + `setState` — re-render por frame en cada instancia.

## Decisión 5 — Mapeo cuadrícula → estados/emociones

Frames numerados 0–15 por filas.

| Combinación | Frames | Ritmo |
|---|---|---|
| `idle` + `neutral` | 0,1,2,3,12,13,14,15,14,13,12,3,2,1 (vaivén) | 350 ms/frame, bucle |
| pestañeo (solo `idle`+`neutral`, `blinking`) | 4,5,7,9,10,11 | 70 ms/frame, una vez |
| `idle` + `happy` | 6 fijo | — |
| `idle` + `calm` | 7,8,9,8 | 600 ms/frame, bucle |
| `thinking` (cualquier emoción) | 5,7,8,7 + balanceo ±4° + tres puntos | 400 ms/frame, bucle |
| `success` (cualquier emoción) | 6 fijo + rebote 900 ms, una vez → `onSuccessEnd` | — |
| reduced-motion | idle: 0 / happy: 6 / calm: 8 / thinking: 8 + puntos estáticos / success: 6 | sin secuencia |

- **Rationale**: La cuadrícula no tiene frames de "pensando"; ojos cerrados/entrecerrados + balanceo + puntos lo comunican sin arte nuevo. Pestañear con ojos ya cerrados o felices no tiene sentido visual, por eso solo aplica a `idle`+`neutral`.

## Decisión 6 — Componente controlado + contexto para el flotante

- **Decision**: `<KariaAvatar>` es **controlado** (no guarda `state` propio; solo el temporizador interno de pestañeo). El botón flotante obtiene `state`/`emotion` de `AsistenteKariaProvider`; `celebrar()` pone `success` y vuelve a `idle` en `onSuccessEnd` (con salvaguarda de 2 s por si el evento no llega, p. ej. reduced-motion).
- **Rationale**: El usuario quiere reutilizar el avatar en otros lugares con props declarativas (`<KariaAvatar state="idle" emotion="happy" blinking />`) y agregar acciones después; un componente controlado es predecible y combinable. El contexto evita *prop drilling* para que cualquier pantalla dispare `pensar()`/`celebrar()` del flotante.
- **Alternatives considered**: Componente no controlado con `ref` imperativo (`ref.current.celebrar()`) — menos declarativo y difícil de componer; store global (zustand) — dependencia nueva sin necesidad.

## Decisión 7 — Montaje, visibilidad y colisiones

- **Decision**: Provider y botón en `LayoutAppServidor` (solo rutas autenticadas: `crm`, `sales`, `configuracion`, `datos`, `productos`, `integraciones`). Botón con `next/dynamic` `ssr:false`. En rutas `/crm/inbox*` el botón no se renderiza (el compositor `input-mensaje.tsx` ocupa todo el ancho inferior, incluido el botón de enviar a la derecha). `print:hidden`. En `< 640px` tamaño 56 px y `bottom-4 right-4`.
- **Rationale**: FR-002/011/013/017 sin lógica de sesión en el cliente. Ocultarlo en conversaciones es más robusto que desplazarlo, porque ese layout ya tiene paneles y bottom sheets propios.
- **Alternatives considered**: Montar en `src/app/layout.tsx` — está por encima de la autenticación (ver comentario en `layout-app-servidor.tsx`); desplazarlo `bottom-24` en conversaciones — seguía tapando mensajes y el bottom sheet móvil.

## Decisión 8 — Idioma de la API

- **Decision**: Props y valores del avatar en inglés (`state`, `emotion`, `blinking`, `size`, `floating`; `idle|thinking|success`, `neutral|happy|calm`), tal como pidió el usuario; contexto, archivos internos y comentarios en español (`usarAsistenteKaria`, `pensar`, `celebrar`, `reposar`).
- **Rationale**: Documentado como excepción acotada en `plan.md`.
