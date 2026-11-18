---

description: "Tasks — Asistente Karia flotante (038)"
---

# Tasks: Asistente Karia flotante (mascota animada)

**Input**: Design documents from `/specs/038-asistente-karia-flotante/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/karia-avatar.md, quickstart.md

**Tests**: Incluidos por la constitución (principio V: tests proporcionales al riesgo) — Vitest para la lógica pura de animación (`src/**/*.test.ts`, entorno node) y Playwright para el recorrido del flotante (`tests/e2e/`, storageState del owner por defecto).

**Organization**: Tareas agrupadas por historia de usuario (US1 P1, US2 P2, US3 P3, US4 P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: Historia a la que pertenece (US1…US4)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Asset fuente y sprite generado — todo lo visual depende de esto.

- [X] T001 Copiar `C:\Users\ramon.olmos\Downloads\KariAI.png` a `assets/asistente/KariAI.png` (fuera de `public/`, fuente versionada para FR-014)
- [X] T002 Crear `scripts/generar-sprite-karia.ts` con `sharp` según research.md Decisiones 1–3: recortar 16 celdas con límites `Math.round(i*1254/4)`; por celda, color de fondo = promedio de las 4 esquinas, *flood fill* 4-conexo desde bordes superior/izquierdo/derecho con umbral RGB ~18 (constante `UMBRAL_FONDO`), erosión 1 px + blur 1 px de la máscara, *un-matte* del color de fondo en píxeles semitransparentes, degradado de alfa en el 15 % inferior; alinear cada frame por bbox opaco de la mitad superior (centro X y tope de antena a la mediana de los 16); redimensionar a 192×192; empaquetar en tira 3072×192 y escribir `public/asistente/karia-sprite.webp` (`quality 85`, `alphaQuality 100`); generar vista previa (tira sobre fondo a cuadros y sobre fondo oscuro) en `os.tmpdir()` e imprimir su ruta; flag `--ya-transparente` que salta la quita de fondo; imprimir el peso final y fallar (exit 1) si supera 150 KB
- [X] T003 Ejecutar `npx tsx scripts/generar-sprite-karia.ts`, revisar la vista previa (casco intacto, sin halo, frames alineados, < 150 KB) y ajustar `UMBRAL_FONDO`/erosión si hace falta; commitear `public/asistente/karia-sprite.webp`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Lógica pura de animación y el componente `KariaAvatar`, que usan todas las historias.

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta terminar esta fase.

- [X] T004 [P] Escribir `src/asistente/karia/animacion.test.ts` (Vitest) con las reglas de data-model.md: todos los índices ∈ [0,15]; `intervaloParpadeo(a)` ∈ [3000, 6000) para `a` ∈ [0,1) (probar 0 y 0.999); `resolverAnimacion({state:"success"})` tiene `bucle:false`, efecto `"rebote"` y duración total < 2000 ms; `admitePestaneo` solo `true` en `idle`+`neutral`; `thinking` tiene `puntos:true` y efecto `"balanceo"`; toda combinación state×emotion tiene `frameReducido` definido; `emotion` se ignora en `thinking`/`success`
- [X] T005 [P] Implementar `src/asistente/karia/animacion.ts`: tipos `KariaState`, `KariaEmotion`, `SecuenciaFrames`, `AnimacionResuelta`; constantes `TOTAL_FRAMES = 16`, `SECUENCIA_PESTANEO` (4,5,7,9,10,11 a 70 ms), `DURACION_EXITO_MS = 900`; función pura `resolverAnimacion({ state, emotion })` con la tabla de research.md Decisión 5; `intervaloParpadeo(aleatorio = Math.random())` → `3000 + aleatorio * 3000`; `posicionFrame(i)` → `` `${(i / (TOTAL_FRAMES - 1)) * 100}% 0` `` (válido con `background-size: 1600% 100%`). Sin imports de React. Dejar pasar T004
- [X] T006 [P] Crear `src/asistente/karia/karia-avatar.css`: `@keyframes karia-flotar` (translateY 0 → -4px → 0, 3 s ease-in-out infinito) aplicado a `[data-slot="karia-avatar"][data-floating="true"]`; sombra de piso en `::after` (elipse difusa con `color-mix(in oklab, var(--foreground) 18%, transparent)`) que se achica sincronizada con la flotación; `karia-rebote` (translateY/scale, 900 ms, una vez) para `[data-efecto="rebote"]`; `karia-balanceo` (rotate ±4°, 1.6 s infinito) para `[data-efecto="balanceo"]`; globo de tres puntos `.karia-puntos` con `karia-puntos` (opacidad escalonada) usando `var(--card)`, `var(--border)`, `var(--muted-foreground)`; `filter: drop-shadow(...)` con `var(--foreground)` a baja opacidad en el sprite; bloque `@media (prefers-reduced-motion: reduce)` que anula flotar/rebote/balanceo/puntos animados; `@media print { display:none }`. Solo tokens de `globals.css`, sin hex
- [X] T007 Implementar `src/asistente/karia/karia-avatar.tsx` (`'use client'`) según contracts/karia-avatar.md: props `state="idle"`, `emotion="neutral"`, `blinking=true`, `size=64`, `floating=true`, `onSuccessEnd`, `label`, `className`; raíz con `data-slot="karia-avatar"`, `data-state`, `data-emotion`, `data-floating`, `data-efecto`, `style={{ width:size, height:size }}`, `cn()` y `print:hidden`; `role="img"`+`aria-label` si hay `label`, si no `aria-hidden`; `<span>` interno con `background-image:url(/asistente/karia-sprite.webp)`, `background-size:1600% 100%`, ref; secuenciador por instancia con `requestAnimationFrame` que escribe `style.backgroundPosition` vía `posicionFrame()` sin `setState`; temporizador de pestañeo con `intervaloParpadeo()` solo si `resolverAnimacion().admitePestaneo && blinking`, que reprograma tras cada pestañeo y se reinicia al volver de `visibilitychange` (sin acumular); `success` reproduce una vez y llama `onSuccessEnd` al cumplir `DURACION_EXITO_MS`; con `matchMedia('(prefers-reduced-motion: reduce)')` (escuchando cambios) pinta solo `frameReducido` y llama `onSuccessEnd` tras `DURACION_EXITO_MS`; limpiar rAF/timeouts en el cleanup; prop opcional `reinicio` (number) que reinicia la secuencia de `success` al cambiar; importar `./karia-avatar.css` (depende de T005, T006)

**Checkpoint**: `npx vitest run src/asistente` en verde; `KariaAvatar` usable de forma aislada.

---

## Phase 3: User Story 1 - Ver a Karia presente y viva en la app (Priority: P1) 🎯 MVP

**Goal**: Mascota flotante, sin fondo, en todas las secciones autenticadas, en Normal con pestañeos espontáneos.

**Independent Test**: Con sesión, abrir `/crm` 15 s: visible abajo a la derecha, flota, mueve la cabeza, pestañea ≥ 1 vez, sin recuadro/halo en claro y oscuro; ausente en `/login` y `/crm/inbox`.

### Tests for User Story 1

- [X] T008 [P] [US1] Crear `tests/e2e/asistente/asistente-karia.spec.ts` con: visible con sesión en `/crm` y `/sales/pedidos` (`getByRole('button', { name: 'Asistente Karia' })` y `[data-slot="karia-avatar"][data-state="idle"]`); ausente en `/crm/inbox`; ausente en `/login` con `test.use({ storageState: { cookies: [], origins: [] } })`; con `page.emulateMedia({ reducedMotion: 'reduce' })` el avatar no tiene animación de flotación (`getComputedStyle(...).animationName === 'none'`)

### Implementation for User Story 1

- [X] T009 [US1] Crear `src/asistente/contexto-asistente.tsx` (`'use client'`): `AsistenteKariaProvider` con estado `{ state, emotion, reinicio }` (inicial `idle`/`neutral`/0) y `usarAsistenteKaria()` → `{ state, emotion, reinicio, pensar, celebrar, reposar }` con callbacks memoizados; fuera del Provider: `throw` en desarrollo y no-ops en producción (contracts/karia-avatar.md). `celebrar` incrementa `reinicio`; la vuelta a `idle` la hace el flotante vía `onSuccessEnd`, con salvaguarda de 2000 ms en el Provider
- [X] T010 [US1] Crear `src/asistente/components/asistente-karia-flotante.tsx` (`'use client'`): si `usePathname()` empieza con `/crm/inbox` → `null`; `<button type="button" aria-label="Asistente Karia" data-slot="asistente-karia">` con `fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 bg-transparent rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring print:hidden`; dentro `<KariaAvatar>` con `state`/`emotion`/`reinicio` del contexto, `size` 56 en < 640 px y 72 desde `sm` (usar dos instancias con `sm:hidden`/`hidden sm:block` o un `size` derivado de `matchMedia`), `onSuccessEnd={reposar}`; sin popover todavía (depende de T007, T009)
- [X] T011 [US1] Crear `src/asistente/components/asistente-karia-montaje.tsx` (`'use client'`) que carga `asistente-karia-flotante` con `next/dynamic(..., { ssr: false })` y exporta `<AsistenteKariaMontaje />`; modificar `src/shared/ui/layout-app-servidor.tsx` para envolver el contenido de `AppLayout` con `<AsistenteKariaProvider>` y renderizar `<AsistenteKariaMontaje />` junto a `children`, sin tocar la resolución de sesión ni preferencias de fecha (depende de T009, T010)
- [ ] T012 [US1] Verificar a mano en `npm run dev`: claro/oscuro sin halo, flotación + pestañeo, 375 px sin scroll horizontal, no aparece en `/crm/inbox` ni `/login`; correr T008 con `npx playwright test tests/e2e/asistente/asistente-karia.spec.ts` — ⚠️ pendiente: verificación manual con sesión y E2E bloqueados por falta de `.env.test` (credenciales de prueba)

**Checkpoint**: MVP — la mascota vive en toda la app autenticada.

---

## Phase 4: User Story 2 - Hacer clic en Karia (Priority: P2)

**Goal**: Clic/teclado → estado Exitoso breve + globo "Próximamente", accesible.

**Independent Test**: Clic → globo con "Hola, soy Karia. Muy pronto podré ayudarte aquí." y `data-state="success"` que vuelve a `idle` en < 2 s; Escape cierra y devuelve el foco; mismo flujo con Tab + Enter.

### Tests for User Story 2

- [X] T013 [P] [US2] Agregar a `tests/e2e/asistente/asistente-karia.spec.ts`: clic muestra el texto del globo y `data-state="success"`, que vuelve a `idle` antes de 2000 ms (`expect.poll`); `Escape` cierra el globo y el botón queda con foco (`toBeFocused()`); con teclado (`focus()` + `Enter`) abre el globo

### Implementation for User Story 2

- [X] T014 [US2] En `src/asistente/components/asistente-karia-flotante.tsx` envolver el botón con `<Popover>`/`<PopoverTrigger render={...}>`/`<PopoverContent side="top" align="end">` de `src/components/ui/popover.tsx` (API de `@base-ui/react`, no Radix) con el texto exacto de FR-008 y un `<KariaAvatar size={32} emotion="happy" floating={false} />` decorativo junto al saludo; al abrir llamar `celebrar()`; confirmar que Escape/clic fuera devuelven el foco al trigger (comportamiento por defecto de Base UI)

**Checkpoint**: US1 + US2 funcionan de forma independiente.

---

## Phase 5: User Story 3 - Karia refleja lo que está pasando (Priority: P3)

**Goal**: Otras pantallas pueden poner al flotante en Pensando / Exitoso / Normal.

**Independent Test**: Desde la vitrina `/dev/karia`, `pensar()` → balanceo + tres puntos sostenidos; `celebrar()` → rebote y regreso a Normal < 2 s; `reposar()` → Normal con pestañeos; en Pensando no pestañea.

- [X] T015 [US3] Crear `src/app/dev/layout.tsx` que re-exporte `LayoutAppServidor` como default (mismo patrón que `src/app/crm/layout.tsx`) y `src/app/dev/karia/page.tsx` que llame `notFound()` si `process.env.NODE_ENV === 'production'` y renderice un componente cliente `src/asistente/components/vitrina-karia.tsx`
- [X] T016 [US3] Crear `src/asistente/components/vitrina-karia.tsx` (`'use client'`) con una sección "Flotante" de tres `<Button>` que llaman `pensar()`, `celebrar()`, `reposar()` de `usarAsistenteKaria()` y muestran el `state` actual
- [X] T017 [P] [US3] Agregar a `tests/e2e/asistente/asistente-karia.spec.ts`: en `/dev/karia`, botón "Pensar" → flotante con `data-state="thinking"` y globo de puntos visible; "Celebrar" → `success` y vuelve a `idle` < 2 s; "Reposar" → `idle`

**Checkpoint**: El contexto queda listo para conectarlo a acciones/IA.

---

## Phase 6: User Story 4 - Reutilizar a Karia en otras pantallas (Priority: P3)

**Goal**: `<KariaAvatar>` usable en cualquier lugar, cada instancia independiente.

**Independent Test**: En `/dev/karia`, varias instancias con combinaciones distintas se comportan cada una según sus props, sin afectarse entre sí ni al flotante; con `blinking={false}` no pestañea en 30 s.

- [X] T018 [US4] En `src/asistente/components/vitrina-karia.tsx` agregar sección "Instancias": cuadrícula con `<KariaAvatar>` en `idle`+`neutral`, `idle`+`happy`, `idle`+`calm`, `thinking`, `success` (con botón local que reinicia `reinicio`), `idle` con `blinking={false}`, y tres tamaños (48/96/128) con `floating={false}` en uno; cada una con un `label` visible debajo describiendo sus props
- [X] T019 [P] [US4] Agregar a `tests/e2e/asistente/asistente-karia.spec.ts`: en `/dev/karia` hay ≥ 6 `[data-slot="karia-avatar"]` con sus `data-state`/`data-emotion` esperados; poner el flotante en `thinking` no cambia el `data-state` de las instancias de la vitrina

**Checkpoint**: Todas las historias funcionan de forma independiente.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T020 [P] Documentar en `docs/asistente-karia.md`: API de `<KariaAvatar>` y `usarAsistenteKaria()` (enlazando `specs/038-asistente-karia-flotante/contracts/karia-avatar.md`), cómo regenerar el sprite, tabla de frames y la excepción de nombres en inglés; añadir una línea en `CLAUDE.md` (sección `design-systems`) apuntando a ese documento
- [X] T021 [P] Medir que el chunk del flotante no entra en el bundle inicial (`npm run build`, revisar que `asistente-karia-flotante` aparece como chunk diferido) y que `/dev/karia` responde 404 con `npm run start`
- [ ] T022 Ejecutar `npx tsc --noEmit`, `npx vitest run`, `npm run build` y `npx playwright test tests/e2e/asistente/` y recorrer quickstart.md completo (incluye vista previa de impresión de una cotización y "reducir movimiento" del SO) — ⚠️ hecho: vitest 10/10, build OK, sin errores de tipos en archivos nuevos; pendiente: Playwright (falta `.env.test`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias. T002 → T003.
- **Foundational (Phase 2)**: T004, T005, T006 en paralelo; T007 depende de T005 y T006. El sprite (T003) es necesario para ver algo, no para compilar.
- **US1 (Phase 3)**: depende de Phase 2. T009 → T010 → T011 → T012.
- **US2 (Phase 4)**: depende de T010 (modifica el mismo archivo).
- **US3 (Phase 5)**: depende de T009 y T011 (necesita el flotante montado). Independiente de US2.
- **US4 (Phase 6)**: depende de T007 y T016 (misma vitrina). Independiente de US1/US2.
- **Polish**: al final.

### User Story Dependencies

```text
Setup ─▶ Foundational ─▶ US1 ─┬─▶ US2
                              └─▶ US3 ─▶ US4
```

### Parallel Opportunities

- T001 ∥ T004 ∥ T005 ∥ T006 (archivos distintos).
- Los tests E2E (T008, T013, T017, T019) comparten archivo: escribir en orden, pero cada uno puede redactarse junto a su historia.
- US2 (T013–T014) ∥ US3 (T015–T017) una vez cerrada US1.
- T020 ∥ T021.

## Parallel Example: Foundational

```bash
Task: "T004 Tests de reglas de animación en src/asistente/karia/animacion.test.ts"
Task: "T005 Lógica pura en src/asistente/karia/animacion.ts"
Task: "T006 Estilos y keyframes en src/asistente/karia/karia-avatar.css"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (sprite) → Phase 2 (animación + `KariaAvatar`) → Phase 3 (flotante montado).
2. **Stop & validate**: la mascota vive en toda la app autenticada, sin fondo, con pestañeos.

### Incremental Delivery

1. MVP (US1) → US2 (clic + globo) → US3 (contexto y vitrina) → US4 (instancias reutilizables).
2. Cada incremento es demostrable por sí solo con la vitrina `/dev/karia` o el flotante.

## Notes

- Riesgo principal en T003: si el recorte deja bordes sucios, aplicar el plan B (fuente transparente del autor + `--ya-transparente`) antes de seguir.
- `<Select>`/Radix no aplican; el Popover es `@base-ui/react` (`render` prop en el trigger, no `asChild`).
- Commit al cerrar cada fase.
