# Implementation Plan: Pantallas de error con la identidad de Karia

**Branch**: `feature/044-pantallas-de-error` | **Date**: 2026-11-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/044-pantallas-de-error/spec.md`

## Summary

Karia no tiene ninguna pantalla de error propia: ni un `error.tsx` ni un `not-found.tsx` en todo el repositorio. Cuando algo no existe o falla, el usuario ve el fallback crudo del framework — fondo negro, sin menú, sin marca y sin salida.

Esta Feature construye una familia de 16 pantallas sobre una única anatomía compartida, de modo que un 404 o un error dentro de la aplicación conserve el menú, diga algo comprensible y ofrezca a dónde ir. Se apoya en que el armazón autenticado ya está montado en los `layout.tsx` de cada segmento: una pantalla colocada dentro de un segmento hereda el menú sin trabajo extra.

**Dos límites se asumen y no se combaten**: una URL que no coincide con ninguna sección no puede traer el menú de ninguna sección, y un fallo del propio armazón no puede mostrar el menú que ese armazón construye.

**El hallazgo que más condiciona el plan**: la versión real es **Next 15.5.18**, no la 16.2 que declara `CLAUDE.md`. En 15.5 no existe la prop `retry()`, y `reset()` por sí sola no vuelve a consultar al servidor — así que el botón "Reintentar" debe hacer `router.refresh()` antes de `reset()`, o será un botón que miente.

## Technical Context

**Language/Version**: TypeScript 5, Node.js 20+

**Primary Dependencies**: Next.js **15.5.18** (App Router), React 19.2, Tailwind v4 — sin dependencias nuevas

**Storage**: ninguno. Sin cambios de datos (ver [data-model.md](./data-model.md))

**Testing**: Vitest (`npm run test:unit`), Playwright (`npm run test:e2e`), validación manual con [quickstart.md](./quickstart.md)

**Target Platform**: Aplicación web server-rendered, desplegada en Coolify

**Project Type**: Aplicación web con módulos por capacidad de negocio bajo `src/`

**Performance Goals**: Sin impacto en el camino normal. Un único efecto conocido: el 404 global deja de prerenderizarse al leer la sesión (D4), aceptable para esa pantalla.

**Constraints**:
- No modificar el contrato de retorno de las Server Actions, la validación por campo ni introducir registro estructurado (FR-013)
- No alterar el camino normal: mismos listados, mismos estados vacíos, mismos 404 en los mismos casos (FR-012)
- El componente compartido no puede ser Client Component: el 404 raíz viaja con todas las páginas (D3)
- `global-error.tsx` no recibe los estilos globales ni el tema (D7)

**Scale/Scope**: 18 archivos — 1 componente compartido, 12 envoltorios por segmento, 3 de raíz, 1 layout y 1 reescritura. Sin migraciones, sin dependencias.

**Incógnitas resueltas en Phase 0**: todas. La de mayor riesgo —si el 404 raíz puede leer la sesión— se resolvió contra la documentación oficial, que trae un ejemplo explícito, pero queda como escenario 5 del quickstart con una salida definida por si en la práctica no se sostiene.

## Constitution Check

*GATE: debe pasar antes de Phase 0. Re-evaluado tras Phase 1.*

| Principio | Evaluación | Estado |
|---|---|---|
| **I — Modular Business Architecture** | Solo se agregan archivos de presentación en `src/app` y un primitivo en `src/shared/ui`. Ningún componente accede a Prisma: la única lectura de contexto (sesión en el 404 raíz) usa el resolvedor existente. Se extiende la anatomía de `EmptyState` en vez de introducir una abstracción paralela. | ✅ |
| **II — Server-Enforced Business Rules** | No se toca validación, autorización ni transiciones de estado. La lectura de sesión del 404 raíz solo elige el destino de un enlace; no habilita nada ni sustituye a `requireSesion()`. | ✅ |
| **III — Reliable Data and Events** | Sin transacciones, eventos ni efectos secundarios. El reintento es idempotente por definición: vuelve a renderizar una lectura. | ✅ |
| **IV — Replaceable Integrations** | No se tocan adaptadores. El principio pide "degradación segura" ante fallos, que es exactamente lo que esta Feature construye para la capa de presentación. | ✅ |
| **V — Security and Quality (NO NEGOCIABLE)** | **Secretos y datos personales fuera de la vista y de los registros**: las pantallas nunca reciben el objeto de error, solo texto escrito a mano más `digest` (contrato §1, regla 1). En producción el framework ya reemplaza el mensaje original por uno genérico. El aislamiento por `instanciaId` no se toca. Tests proporcionales al riesgo: el riesgo acá es de comportamiento y de consistencia visual, no de lógica pura, así que se cubre con Playwright y quickstart en vez de pruebas unitarias de componentes. | ✅ |

**Restricciones técnicas de la constitución**: sin dependencias nuevas (se descarta `global-not-found.js` y su bandera experimental, D5), sin migraciones, UI responsive y accesible exigida por FR-010 y verificada a 360 px en el quickstart. Fechas, moneda e identificadores no intervienen.

**Nota sobre la versión declarada**: la constitución dice "Next.js 15" y es correcta; `CLAUDE.md` dice "16.2" y está desactualizado. Corregirlo es una tarea de la fase final (D1) — una discrepancia de documentación que ya estuvo a punto de producir un plan basado en una API inexistente.

**Resultado**: sin violaciones. No hace falta la sección Complexity Tracking.

**Re-evaluación post-Phase 1**: sin cambios. El diseño no introdujo estructuras nuevas: `data-model.md` confirma cero cambios de datos y `contracts/` es un contrato de componente más una matriz de ubicación.

## Project Structure

### Documentation (this feature)

```text
specs/044-pantallas-de-error/
├── plan.md                           # Este archivo
├── spec.md                           # Historias y requisitos
├── research.md                       # Phase 0 — D1..D10
├── data-model.md                     # Phase 1 — sin cambios de datos
├── quickstart.md                     # Phase 1 — 6 escenarios + cero regresión
├── contracts/
│   └── pantallas-de-error.md         # Phase 1 — anatomía + matriz de ubicación
├── checklists/
│   └── requirements.md               # Gate de calidad del spec
└── tasks.md                          # Phase 2 — lo genera /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── shared/ui/
│   ├── empty-state.tsx               # existente — fuente de la anatomía
│   └── app-error-screen.tsx          # NUEVO — Server Component compartido
└── app/
    ├── not-found.tsx                 # NUEVO — URL sin coincidencia (lee sesión)
    ├── error.tsx                     # NUEVO — fallo del armazón
    ├── global-error.tsx              # NUEVO — último recurso, estilos propios
    ├── acceso-denegado/
    │   ├── layout.tsx                # NUEVO — le da el armazón sin mover la URL
    │   └── page.tsx                  # reescrito sobre la pantalla compartida
    ├── crm/            { not-found.tsx, error.tsx }   # NUEVOS
    ├── sales/          { not-found.tsx, error.tsx }   # NUEVOS
    ├── configuracion/  { not-found.tsx, error.tsx }   # NUEVOS
    ├── productos/      { not-found.tsx, error.tsx }   # NUEVOS
    ├── integraciones/  { not-found.tsx, error.tsx }   # NUEVOS
    └── datos/          { not-found.tsx, error.tsx }   # NUEVOS
```

**Structure Decision**: Se conserva la estructura existente. La ubicación de cada archivo **no es una preferencia de diseño**: la fija el enrutado del framework, y es lo que determina qué pantalla puede conservar el menú (ver `research.md` D6 y la matriz del contrato). `dev` queda fuera por ser taller interno, no producto.

Diecisiete de los dieciocho archivos son nuevos; el único que se modifica es `acceso-denegado/page.tsx`. Ninguna página existente se toca, lo que hace de esta Feature un cambio de superficie de riesgo muy baja sobre el camino normal.

## Fases de implementación

| Fase | Historia | Archivos | Por qué este orden |
|---|---|---|---|
| 0 | — | — | **Escenario 5 del quickstart primero**: confirmar que el 404 raíz puede leer la sesión. Si no se sostiene, cambia el alcance de US3 y conviene saberlo antes de escribir doce pantallas |
| 1 | — | 1 | `AppErrorScreen`: la anatomía de la que dependen las demás |
| 2 | US1 (P1) | 8 | 6 `not-found.tsx` + el layout y la reescritura de acceso denegado |
| 3 | US2 (P1) | 6 | 6 `error.tsx`, cada uno con el reintento correcto |
| 4 | US3 (P2) | 1 | `app/not-found.tsx` raíz, con el destino según sesión |
| 5 | US4 (P3) | 2 | `app/error.tsx` y `app/global-error.tsx` |
| 6 | — | 1 | Corregir la versión de Next en `CLAUDE.md` (D1) |

La fase 1 bloquea a las demás. Las fases 2 a 5 son independientes entre sí y cada una es desplegable sola; dentro de cada una, los archivos no comparten nada y se pueden hacer en paralelo.

## Los tres errores que este plan existe para evitar

**1. Que el reintento no reintente.** Es el más probable y el que no se detecta leyendo el código: `reset()` sin `router.refresh()` compila, se ve bien y falla solo cuando alguien lo prueba de verdad con la causa ya resuelta. El escenario 2 del quickstart está escrito para forzar esa comprobación.

**2. Que la pantalla compartida se vuelva Client Component.** Es una línea —`'use client'`— y el efecto es que el bundle del 404 raíz viaje con todas las páginas de la aplicación. No hay señal visible de que pasó.

**3. Que las dieciséis pantallas diverjan.** Si cada una se escribe por separado, en tres meses hay dieciséis textos y dieciséis tratamientos ligeramente distintos. FR-009 y el contrato §1 existen por esto: los doce envoltorios de segmento deben ser casi idénticos entre sí, y si uno necesita apartarse, es una señal de que falta una prop en el componente compartido.

## Qué NO entra (FR-012, FR-013)

1. El contrato de retorno de las Server Actions y sus códigos distinguibles
2. Los errores de validación por campo en los formularios
3. El registro estructurado con ruta, operación e `instanciaId`
4. La idempotencia de crear pedido y enviar mensaje
5. Los 5 fallbacks de `Promise.allSettled` en `crm/contactos/[id]/page.tsx`, que degradan sin aviso — heredado de 043
6. Cualquier cambio en el camino normal: listados, estados vacíos legítimos y los 404 por registro inexistente se comportan igual

Los puntos 1 a 4 son el resto del manejo de errores y merecen su propio trabajo. El 5 quedó anotado en las desviaciones de 043.

## Dependencia con 043

Esta Feature continúa el hotfix `043-fix-errores-tragados`, que ya está en la rama principal. Aquel trabajo eliminó 38 bloques que atrapaban fallos de lectura y renderizaban listas vacías o 404 falsos; sin él, estas pantallas casi nunca se dispararían porque el error no llegaba hasta ellas.

La relación en una línea: **043 hizo que los errores lleguen; 044 decide qué se ve cuando llegan.**

---

## Desviaciones encontradas al implementar

### FR-007 se cumple, pero por otro mecanismo

**Lo que decía el plan (D4)**: el `app/not-found.tsx` raíz lee la sesión y elige el destino del enlace. **Lo que se hizo**: el enlace apunta fijo a `/crm` y el destino lo resuelve el middleware.

La prueba T001 dio verde —`/_not-found` pasó de `○ Static` a `ƒ Dynamic`, confirmando que la sesión *se puede* leer ahí— pero **la prueba era incompleta**: miraba una sola ruta. El build completo mostró el costo real.

`app/not-found.tsx` participa del árbol de render de **todas** las rutas. Usar una API dinámica ahí volvió dinámicas las nueve páginas que se prerenderizaban:

```
/  ·  /privacy-policy  ·  /terms-of-service  ·  /registro
/auth/configurar-cuenta  ·  /auth/magiclink  ·  /auth/reset-password
/acceso-denegado  ·  /_not-found
```

Pagar render bajo demanda en cada página legal, de registro y de recuperación de contraseña, para que una pantalla de 404 pueda personalizar un enlace, es mal negocio.

**La salida no degrada el resultado para el usuario.** El middleware (`src/middleware.ts`) ya redirige con un 307 a `/login?redirect=…` cualquier ruta no pública sin sesión, y lo hace **en el borde, antes de renderizar nada**. Entonces: con sesión, el enlace cae en `/crm`; sin sesión, en el login. Es el mismo destino que prometía FR-007, resuelto por quien ya lo resolvía, y sin el rebote visible por una pantalla de la aplicación que el quickstart descartaba.

Verificado tras el cambio: **cero regresiones de estático a dinámico**, salvo `/acceso-denegado`, que es intencional (ahora monta el armazón autenticado y por definición necesita la sesión).

### Un `try/catch` que había que quitar

La primera versión del 404 raíz envolvía la lectura de sesión en un `try/catch`, para que una base caída no hiciera explotar la propia pantalla de error. El build reveló por qué estaba mal: lo que atrapaba era el `DynamicServerError` que Next lanza **a propósito** para salir del render estático. Es decir, estaba tragando una señal de control del framework — la misma familia de error que `043` acaba de barrer, solo que peor, porque interfiere con el mecanismo de renderizado.

Al quitar la lectura de sesión el problema desapareció solo. Queda anotado porque el patrón es tentador y silencioso: el build seguía en exit 0 y solo se notaba por un error impreso en el log.

### Lección para la próxima prueba de este tipo

Una prueba sobre una ruta especial compartida por todo el árbol tiene que mirar el build **completo**, no la ruta que motiva el cambio. T001 habría dado el mismo verde con el mismo diagnóstico equivocado.
