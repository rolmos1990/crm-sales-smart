# Implementation Plan: Asistente Karia flotante (mascota animada)

**Branch**: `feature/038-asistente-karia-flotante` | **Date**: 2026-11-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/038-asistente-karia-flotante/spec.md`

## Summary

La mascota de Karia se entrega como **un componente reutilizable y controlado, `<KariaAvatar>`**, que encapsula el sprite y su propia máquina de animación por instancia (`state`, `emotion`, `blinking`, `size`, `floating`). El botón flotante `<AsistenteKariaFlotante>` es solo **un uso** de ese componente: lee su estado de un contexto (`usarAsistenteKaria()` → `pensar / celebrar / reposar`) y abre un popover "Próximamente". Todo se monta en `LayoutAppServidor`, por lo que solo existe con sesión iniciada.

El arte sale de la cuadrícula 4×4 entregada (sin alfa): un script con `sharp` recorta los 16 frames, quita el fondo blanco hueso por *flood fill* desde los bordes, alinea la cabeza y genera una tira WebP con alfa. La secuencia de frames la maneja un secuenciador en JS (sin re-render de React); flotación, rebote y balanceo son CSS. Detalle de decisiones en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5, React 19 (Next.js 16.2 App Router)

**Primary Dependencies**: `sharp` (ya instalado, solo en el script), `@base-ui/react` Popover vía `src/components/ui/popover.tsx`, Tailwind v4. Sin dependencias nuevas.

**Storage**: N/A — el estado vive en memoria del navegador.

**Testing**: Vitest (`src/**/*.test.ts`, entorno node) para la lógica pura de animación; Playwright (`tests/e2e/`) para el recorrido del botón flotante.

**Target Platform**: Navegadores modernos de escritorio y móvil (Chrome, Edge, Safari, Firefox).

**Project Type**: Aplicación web (Next.js monolito).

**Performance Goals**: Animación a frecuencia de frames del sprite (≤ 14 fps) sin re-renders de React; 0 trabajo con la pestaña oculta.

**Constraints**: Sprite < 150 KB; carga diferida (`next/dynamic`, `ssr: false`); respeta `prefers-reduced-motion`; colores solo con tokens de `globals.css`.

**Scale/Scope**: 1 asset, 1 componente reutilizable, 1 contexto, 1 botón flotante, 1 página de prueba solo-desarrollo, 1 script.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Arquitectura modular | ✅ Módulo nuevo `src/asistente/` (capacidad "asistente"), UI separada de la lógica pura (`animacion.ts`). No toca Prisma ni SDKs. |
| II. Reglas en servidor | ✅ N/A — no hay validación ni estado de negocio; es presentación. La visibilidad depende de la sesión resuelta en servidor (`LayoutAppServidor`). |
| III. Datos y eventos | ✅ N/A — sin escrituras, transacciones ni eventos. |
| IV. Integraciones reemplazables | ✅ N/A — sin integraciones. El contexto expone verbos de dominio (`pensar/celebrar`), no acoplados a un proveedor de IA. |
| V. Seguridad y calidad | ✅ Sin datos de tenant ni secretos. Tests: unitarios para la resolución de frames y el temporizador de pestañeo; E2E para visibilidad, popover y ausencia en `/login`. |
| Restricciones técnicas | ✅ Responsive y accesible (FR-009/010/011); sin dependencias nuevas. |

**Excepción documentada**: CLAUDE.md pide español en nombres de dominio. La API de `<KariaAvatar>` (`state`, `emotion`, `blinking`, valores `idle/thinking/success`) va en inglés **a pedido explícito del usuario**; es una API de componente visual (como `Button`, `size`, `variant`), no de dominio de negocio. Lo interno y el contexto quedan en español.

**Re-check post-diseño**: ✅ sin cambios — el diseño no introduce datos, eventos ni dependencias.

## Project Structure

### Documentation (this feature)

```text
specs/038-asistente-karia-flotante/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── karia-avatar.md      # API pública del componente y del contexto
└── tasks.md                 # /speckit-tasks
```

### Source Code (repository root)

```text
assets/asistente/
└── KariAI.png                          # Fuente original versionada (fuera de public/)

scripts/
└── generar-sprite-karia.ts             # sharp: recorte, quitar fondo, alinear, empaquetar

public/asistente/
└── karia-sprite.webp                   # Tira 16 × 192 px con alfa (generada y commiteada)

src/asistente/
├── karia/
│   ├── animacion.ts                    # Puro: tablas de frames, resolverAnimacion(), intervaloParpadeo()
│   ├── animacion.test.ts               # Vitest
│   ├── karia-avatar.tsx                # 'use client' — componente reutilizable y controlado
│   └── karia-avatar.css                # flotar / rebote / balanceo / puntos / reduced-motion / print
├── contexto-asistente.tsx              # AsistenteKariaProvider + usarAsistenteKaria()
└── components/
    └── asistente-karia-flotante.tsx    # Botón fijo + Popover; usa <KariaAvatar> y el contexto

src/shared/ui/layout-app-servidor.tsx   # Monta Provider + botón (carga diferida)
src/app/dev/layout.tsx                  # Re-exporta LayoutAppServidor (mismo patrón que crm/layout.tsx)
src/app/dev/karia/page.tsx              # Vitrina solo-desarrollo (notFound() en producción)

tests/e2e/asistente/
└── asistente-karia.spec.ts             # Playwright
```

**Structure Decision**: Módulo propio `src/asistente/` siguiendo la convención por capacidad (`src/[dominio]/...`). `KariaAvatar` vive en `src/asistente/karia/` y no en `src/components/ui/` porque es un componente de marca, no un primitivo genérico de shadcn. El montaje global va en `LayoutAppServidor` (único shell autenticado compartido por todas las secciones), lo que garantiza FR-017 sin lógica extra.

## Complexity Tracking

Sin violaciones que justificar.
