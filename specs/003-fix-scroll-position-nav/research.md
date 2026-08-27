# Research: Reinicio de scroll al navegar entre secciones

**Feature**: `003-fix-scroll-position-nav` | **Date**: 2026-08-27

## Diagnóstico (root cause)

1. El shell de la app (`AppLayout` en `src/shared/ui/app-sidebar.tsx`, usado por `/crm/layout.tsx` y `/sales/layout.tsx`) tiene como contenedor raíz `h-screen overflow-hidden` — la ventana del navegador (`window`/`body`) nunca scrollea. El único elemento que scrollea verticalmente es `<main className="flex-1 overflow-y-auto">`, hijo del layout, hermano del `<header>` de 52px.
2. Next.js App Router solo gestiona automáticamente el scroll de la **ventana** al navegar entre rutas (`window.scrollTo`); no tiene forma de saber que este proyecto usa un contenedor de scroll personalizado (`<main>`) en vez del scroll nativo. No existe en el repo ningún código que reinicie manualmente `scrollTop` de `<main>` al cambiar de ruta (`grep` de `scrollRestoration`/`scrollTop =`/`scrollTo(0` no encontró nada relevante en el layout).
3. El Dashboard (`/crm`, `src/app/crm/page.tsx`) es una página larga (KPIs + listas) que típicamente requiere scroll dentro de `<main>`. El Pipeline (`/crm/pipeline`, vía `pipeline-wrapper.tsx`) renderiza `h-full overflow-hidden` — ocupa exactamente el alto de `<main>`, sin necesitar scroll propio en ese nivel.
4. Consecuencia: si el usuario se desplaza hacia abajo en el Dashboard y hace clic en "Pipeline" en el menú, `<main>` conserva su posición de scroll previa (nada la reinicia), así que el Pipeline se renderiza ya "empujado" — su encabezado/filtros quedan fuera de la vista. Esto reproduce exactamente el ejemplo reportado (Dashboard → Pipeline) y, por la misma causa, cualquier otro par de secciones donde la sección de origen sea más alta que la de destino.
5. Sobre el síntoma "cada vez que refresco": no se encontró código que restaure activamente una posición de scroll guardada (no hay `sessionStorage`/`scrollRestoration` custom), y una recarga completa del navegador (F5) reconstruye el DOM desde cero — `<main>` debería nacer con `scrollTop = 0`. La explicación más consistente con la evidencia es que no es un segundo bug independiente: es el **mismo bug de (4), observado repetidamente** — una vez que `<main>` quedó "atascado" scrolleado tras una navegación normal, se mantiene así en cada re-render posterior (incluyendo el auto-refresh del Pipeline, ver punto 6), y el usuario lo percibe como si "cada refresco" cortara la pantalla. Se documenta como hipótesis principal en vez de certeza, ya que no se pudo reproducir en un navegador real desde este entorno (ver Assumptions en `spec.md`).
6. El Pipeline tiene su propio auto-refresh (`useAutoRefresh` en `src/shared/hooks/use-auto-refresh.ts`, usado en `pipeline-wrapper.tsx`) que llama a `router.refresh()` periódicamente. El comentario del propio código ya documenta la intención: *"router.refresh no navega ni pierde el estado de scroll/UI"* — es decir, el comportamiento de preservar el scroll en un `router.refresh()` ya es intencional y correcto; la corrección de esta feature debe respetarlo (FR-004 en `spec.md`), no revertirlo.

## Decisiones

### D1 — Punto de reinicio: efecto en `AppLayout`, keyed por `pathname`

- **Decisión**: agregar un efecto en `AppLayout` (`src/shared/ui/app-sidebar.tsx`, componente cliente que ya posee la referencia a `<main>`) que reinicia el `scrollTop` de `<main>` a `0` cada vez que cambia el `pathname` (vía `usePathname()` de `next/navigation`), y también en el primer montaje.
- **Rationale**: es el punto único donde vive tanto `<main>` como el pathname actual — no requiere tocar ninguna de las ~30 páginas individuales (cumple el principio de arquitectura modular: extender el componente existente, no introducir una abstracción paralela repetida por página). `usePathname()` cambia únicamente en una navegación real (clic en el menú, cualquier `<Link>`/`router.push` a otra ruta, atrás/adelante del navegador) — **no** cambia en un `router.refresh()` (que re-obtiene el RSC payload de la misma ruta sin disparar el ciclo de enrutamiento), así que este único mecanismo satisface FR-001/002/003 y FR-004 (preservar scroll en auto-refresh) al mismo tiempo, sin lógica adicional para distinguir ambos casos.
- **Alcance explícito**: solo se reinicia `<main>` (el contenedor de nivel de sección). No se toca ningún contenedor de scroll interno de una página (p. ej. el `div[data-pipeline-vscroll]` del tablero Kanban) — así se cumple FR-005 sin tener que enumerar excepciones por pantalla.
- **Alternativas consideradas**:
  - *Rediseñar el layout para usar scroll nativo de la ventana* (quitar `h-screen overflow-hidden`, dejar que `body` scrollee, usar `position: sticky` para el header/sidebar): resuelto "gratis" por el comportamiento nativo de Next.js, pero es un cambio arquitectónico de alto riesgo — afecta el cálculo de altura de todas las páginas que hoy asumen que `<main>` es su propio viewport (el Pipeline entero está construido sobre `h-full`/`overflow-hidden` en cascada). Rechazada por desproporcionada frente al bug reportado.
  - *Reiniciar scroll en cada página individual* (un hook repetido en cada `page.tsx`): rechazada — viola el principio de no duplicar lógica transversal por módulo; además es fácil de olvidar en páginas nuevas.
  - *Forzar remount de `<main>` con `key={pathname}`*: rechazada — ya remonta el árbol de la página en sí (cada ruta ya es un componente distinto), forzar un remount del `<main>` no aporta nada adicional y podría desmontar de más (p. ej. el `<Toaster>` si estuviera anidado ahí, aunque hoy no lo está).

### D2 — Defensa adicional: `history.scrollRestoration = 'manual'`

- **Decisión**: fijar `history.scrollRestoration = "manual"` una sola vez en el layout raíz (`AppLayout` o el `RootLayout`), como medida defensiva estándar en aplicaciones tipo SPA con contenedor de scroll propio.
- **Rationale**: aunque el diagnóstico principal (D1) no depende de esto, es la práctica recomendada al construir el propio manejo de scroll sobre App Router, para evitar que el navegador intente aplicar su propia restauración nativa de scroll de ventana (por ejemplo, en navegación atrás/adelante) y quede en conflicto con el reinicio manual de `<main>`. Costo/riesgo mínimo, refuerza el Edge Case de "atrás/adelante" del navegador ya documentado en `spec.md`.

### D3 — Alcance del disparador: cambios de `pathname`, no de `searchParams`

- **Decisión**: el reinicio se dispara solo cuando cambia el `pathname` (cambio de sección), no cuando solo cambian los parámetros de búsqueda de la URL en la misma sección (por ejemplo, aplicar un filtro, cambiar de pipeline con `?p=id`, paginar).
- **Rationale**: FR-001 y el ejemplo de la spec hablan explícitamente de "navegar hacia otra sección" (Dashboard → Pipeline); resetear también ante cada cambio de filtro sería una ampliación de alcance no pedida y podría sentirse invasivo (perder la posición al aplicar un filtro dentro de la misma lista). Si en el futuro se detecta que algún flujo de filtros específico también necesita este reinicio, es una decisión de producto aparte, no parte de esta corrección.

## Salida

Diagnóstico y enfoque técnico confirmados con evidencia directa del código (no quedan `NEEDS CLARIFICATION` en el Technical Context). La corrección se reduce a un cambio acotado en un único archivo ya existente (`app-sidebar.tsx`), sin tocar páginas individuales ni lógica de datos.
