# Implementation Plan: Las páginas dejan de esconder los fallos de lectura

**Branch**: `hotfix/043-fix-errores-tragados` | **Date**: 2026-11-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/043-fix-errores-tragados/spec.md`

## Summary

Treinta y seis bloques en las páginas de Karia atrapan fallos de lectura y renderizan la página con valores inventados: listas vacías, 404 sobre registros que existen, totales en cero y formularios con la moneda y el país cambiados. El comentario que los justifica (`// DB no configurada`) describe un escenario imposible, porque la sesión consulta la base antes del `try`.

El fix es sustractivo: se eliminan esos 36 bloques —31 escritos como `try/catch` y 5 como `.catch(...)` sobre la promesa— junto con la variable `let` de valor inicial que los acompaña y los 9 guards `DATABASE_URL.includes("placeholder")` que son código muerto, de modo que el error se propague. Cuatro bloques de degradación legítima se conservan, pasando a mostrar un aviso y a registrar el error; dos de formateo de fecha quedan intactos.

No se construye todavía la pantalla de error con la identidad visual del producto: eso es la Feature posterior. Este hotfix solo deja de mentir.

**Riesgo principal**: 36 ediciones mecánicas sobre 32 archivos, siete de los cuales tienen más de un bloque — y el defecto se escribe de dos formas distintas, así que un barrido por una sola de ellas deja sitios sin tocar (le pasó al inventario original de este mismo hotfix). Se mitiga con una lista de verificación cerrada ([`contracts/catches-permitidos.md`](./contracts/catches-permitidos.md)) y un test-guardia permanente en Vitest.

## Technical Context

**Language/Version**: TypeScript 5, Node.js 20+

**Primary Dependencies**: Next.js 16.2 (App Router), React 19, Prisma 7

**Storage**: PostgreSQL vía Prisma — **sin cambios** (ver [data-model.md](./data-model.md))

**Testing**: Vitest (`npm run test:unit`, 187 archivos de test en `src/`), Playwright (`npm run test:e2e`)

**Target Platform**: Aplicación web server-rendered, desplegada en Coolify

**Project Type**: Aplicación web con módulos por capacidad de negocio bajo `src/`

**Performance Goals**: Sin impacto. Se eliminan bloques `try/catch`; no se agregan consultas, llamadas ni render.

**Constraints**:
- No se pueden introducir límites de error, pantalla de error con identidad visual, ni registro estructurado (FR-010 — pertenecen a la Feature posterior)
- No se puede alterar el comportamiento de los 4 bloques conservados más allá del aviso, el fallback legacy de `construirCondicionVenta`, el 404 legítimo, ni los estados vacíos legítimos (FR-009)
- El registro de errores no puede contener datos personales (Principio V de la constitución)

**Scale/Scope**: 32 archivos `page.tsx`, 42 bloques inventariados (36 eliminados, 4 conservados, 2 intactos), 9 guards eliminados, 1 archivo de test nuevo. Sin migraciones.

**Incógnitas resueltas en Phase 0**: ninguna quedó pendiente. La única que podía invalidar el hotfix —si eliminar los `catch` rompía `npm run build`— se cerró con un build real: 73 rutas dinámicas, 10 estáticas, ninguna de las 32 páginas afectadas entre las estáticas. Detalle en [research.md](./research.md), D1.

## Constitution Check

*GATE: debe pasar antes de Phase 0. Re-evaluado tras Phase 1.*

| Principio | Evaluación | Estado |
|---|---|---|
| **I — Modular Business Architecture** | Solo se tocan páginas de `src/app`. No se mueve lógica entre capas, no se introducen abstracciones paralelas, ningún componente pasa a acceder a Prisma que no lo hiciera ya. | ✅ |
| **II — Server-Enforced Business Rules** | No se toca validación ni autorización. `requireSesion()` y `verificarAcceso()` siguen corriendo antes que todo en cada página, sin cambios. El fix refuerza el principio: deja de permitir que un formulario se abra con valores por defecto no provenientes de la configuración del servidor. | ✅ |
| **III — Reliable Data and Events** | Sin transacciones, eventos ni efectos secundarios involucrados. Solo lectura. | ✅ |
| **IV — Replaceable Integrations** | Las cuatro páginas de integraciones afectadas solo dejan de esconder el fallo de su propia lectura; no se tocan adaptadores ni contratos de canal. Nota: el principio pide "degradación segura", y presentar una cuenta conectada como desconectada no lo es — el fix la corrige. | ✅ |
| **V — Security and Quality (NO NEGOCIABLE)** | El aislamiento por `instanciaId` no se toca: las mismas queries con los mismos argumentos. El registro de los 4 bloques conservados lleva página y operación, nunca contenido del registro leído. Tests proporcionales al riesgo: el riesgo acá es estructural (borrar de más o de menos), y se cubre con el test-guardia de D5; el comportamiento ante fallo se valida con el quickstart. | ✅ |

**Restricciones técnicas de la constitución**: sin dependencias nuevas, sin migraciones de Prisma, sin cambios de UI responsive más allá del aviso de FR-007 construido con `EmptyState` ya existente. Fechas, monedas e identificadores no se tocan — al contrario, el fix impide que la moneda y el país degraden a valores cableados.

**Resultado**: sin violaciones. No hace falta la sección Complexity Tracking.

**Re-evaluación post-Phase 1**: sin cambios. Los artefactos de diseño no introdujeron ninguna estructura nueva: `data-model.md` confirma cero cambios de datos, `contracts/` es una lista de verificación y no una interfaz nueva, y el único archivo nuevo es un test.

## Project Structure

### Documentation (this feature)

```text
specs/043-fix-errores-tragados/
├── plan.md                           # Este archivo
├── spec.md                           # Diagnóstico previo + requisitos
├── research.md                       # Phase 0 — D1..D7
├── data-model.md                     # Phase 1 — sin cambios de datos
├── quickstart.md                     # Phase 1 — 5 escenarios de validación
├── contracts/
│   └── catches-permitidos.md         # Phase 1 — lista blanca + inventario de los 42
├── checklists/
│   └── requirements.md               # Gate de calidad del spec
└── tasks.md                          # Phase 2 — lo genera /speckit-tasks
```

### Source Code (repository root)

```text
src/app/
├── crm/
│   ├── page.tsx                      # 3 catch → elimina 1 (KPIs), conserva 2
│   ├── contactos/
│   │   ├── page.tsx                  # elimina 1
│   │   ├── nuevo/page.tsx            # elimina 1
│   │   └── [id]/
│   │       ├── page.tsx              # elimina 1 + guard
│   │       └── editar/page.tsx       # elimina 1 + guard
│   ├── empresas/                     # page, [id], [id]/editar — elimina 3 + 2 guards
│   ├── oportunidades/
│   │   ├── page.tsx                  # elimina 1
│   │   ├── nueva/page.tsx            # elimina 1
│   │   └── [id]/
│   │       ├── page.tsx              # 3 catch → elimina 1 + guard, conserva 2
│   │       └── editar/page.tsx       # elimina 1 + guard
│   ├── actividades/                  # page, nueva — elimina 2
│   ├── etiquetas/page.tsx            # elimina 1
│   ├── inbox/page.tsx                # elimina 1
│   └── pipeline/page.tsx             # elimina 1
├── sales/
│   ├── cotizaciones/
│   │   ├── page.tsx                  # elimina 1
│   │   ├── nueva/page.tsx            # 2 catch → elimina 1, conserva 1
│   │   └── [id]/                     # page, editar — elimina 2 + 1 guard
│   └── pedidos/
│       ├── page.tsx                  # 2 catch → elimina 2
│       ├── nuevo/page.tsx            # elimina 1
│       └── [id]/page.tsx             # 2 catch → elimina 1 + guard, conserva 1
├── productos/
│   ├── page.tsx                      # elimina 1
│   ├── nuevo/page.tsx                # elimina 2 (.catch)
│   └── [id]/editar/page.tsx          # elimina 3 (.catch) + guard
├── datos/page.tsx                    # elimina 1
└── integraciones/                    # page, instagram, facebook-messenger, whatsapp-lite — elimina 4

src/app/paginas-sin-catch.test.ts     # NUEVO — test-guardia (D5)
```

**Structure Decision**: Se conserva la estructura existente sin excepción. El cambio es sustractivo dentro de archivos que ya existen, más un único archivo nuevo de test. El test-guardia se ubica junto a lo que vigila (`src/app/`), siguiendo la convención del proyecto de colocar los `.test.ts` al lado del código — igual que `src/worker/grafo-importaciones.test.ts`, que es su precedente directo.

## Fases de implementación

El orden sale de D7. Cada fase es desplegable por sí sola y corresponde a una historia del spec.

| Fase | Historia | Bloques | Archivos | Por qué este orden |
|---|---|---|---|---|
| 1 | US1 (P1) — Formularios | 13 | 10 | Único grupo que **persiste** datos equivocados |
| 2 | US2 (P1) — 404 falso | 7 + 7 guards | 7 | La mentira afirmativa; dispara soporte |
| 3 | US3 (P2) — Números falsos | 2 | 2 | Se decide sobre esos números; incluye la reversión silenciosa de 038 |
| 4 | US4 (P3) — Listas vacías | 15 | 15 | El grupo más visible, pero de daño reversible |
| 5 | Test-guardia | — | 1 nuevo | Al final: la lista blanca solo es estable cuando se sabe qué quedó |

Los 2 guards restantes (de `contactos/[id]/editar` y `oportunidades/[id]/editar`) se eliminan en la fase 1, junto con el bloque de esos mismos archivos. `productos/[id]/editar` aparece en las fases 1 y 2 a la vez: su `.catch` de la línea 18 produce el 404 falso, los de 19 y 20 degradan el formulario.

El aviso de FR-007 y el registro de FR-008 sobre los 4 bloques conservados se aplican donde cae cada archivo: `crm/page.tsx` en la fase 3, `crm/oportunidades/[id]/page.tsx` en la 2, `sales/cotizaciones/nueva/page.tsx` en la 1.

## Patrón de cambio

Tres formas, según qué contenía el bloque. Detalle por archivo en [`contracts/catches-permitidos.md`](./contracts/catches-permitidos.md).

**1. Lectura principal** — se elimina el `try/catch` (o el `.catch(...)` encadenado) y la variable `let` con valor inicial pasa a `const` con `await` directo. Quitar el valor inicial es parte del fix, no cosmética: es lo que hacía posible renderizar con un valor inventado (D2).

**2. Página de detalle** — además, el guard de `placeholder` desaparece y la condición del `notFound()` queda en `if (!registro)`. Eso conserva el 404 legítimo y elimina el falso, porque sin el `catch` un error ya no puede dejar la variable en `null`.

**3. Bloque conservado** — el `catch` se mantiene, se le agrega `console.error` con prefijo de página y operación, y la sección afectada renderiza un aviso con `EmptyState` en vez de quedar vacía.

**Trampa a vigilar al eliminar**: condiciones como `if (!inicial || inicial.indicadores.total === 0)` deben quedar en `if (inicial.indicadores.total === 0)`. Dejar la rama `!inicial` reintroduce justo la confusión entre fallo y vacío que el hotfix elimina.

## Qué NO se toca (FR-009)

1. Los 4 bloques conservados, más allá del aviso y el registro
2. Los 2 bloques de formateo de fecha (`crm/oportunidades/[id]/page.tsx:98`, `sales/pedidos/[id]/page.tsx:49`)
3. `construirCondicionVenta` y su fallback legacy para instancias sin flujo dinámico
4. El `notFound()` cuando el registro efectivamente no existe
5. Los estados vacíos legítimos
6. Los 134 `try/catch` de las Server Actions — fuera de alcance, pertenecen a la Feature posterior
7. `requireSesion()` y el layout — un fallo ahí escapa a cualquier límite de sección y necesita un límite en el segmento padre, que es de la Feature posterior

## Dependencia declarada

Este hotfix es la condición previa de la Feature de manejo de errores (pantalla `AppErrorScreen`, `error.tsx` por sección, `app/error.tsx` para fallos del layout, `global-error.tsx`, contrato unificado de Server Actions y registro estructurado).

Sin este hotfix, esos límites casi nunca se dispararían: el error no llega hasta ellos. Entre los dos trabajos, la pantalla de error es la que trae el framework por defecto — fea, pero honesta, y estrictamente mejor que el 404 falso y el vacío creíble.

---

## Desviaciones encontradas al implementar

Dos cosas que el plan no podía saber hasta tocar el código. Ambas se resolvieron en la dirección de **no** cambiar comportamiento.

### 1. Dos de los cuatro bloques "conservables" eran código muerto

`crm/page.tsx` tenía esta forma en `obtenerUltimasOportunidades` y `obtenerActividadesHoy`:

```ts
async function f() {
  try {
    return prisma.x.findMany(…);   // ← sin await
  } catch { return []; }
}
```

Dentro de una función `async`, `return promesa` sin `await` deja el rechazo **fuera** del `try`: la promesa la resuelve la maquinaria de la función, ya fuera del bloque. Verificado con un caso mínimo en Node: sin `await` propaga, con `await` atrapa.

Es decir, esas dos listas secundarias **ya propagaban** desde siempre. Conservarlas con aviso (FR-007) habría exigido agregarles `await`, es decir, **introducir un tragado que hoy no existe** — exactamente lo contrario de lo que persigue este hotfix. Se eliminaron los dos `catch` muertos, con cambio de comportamiento nulo.

Consecuencias: la lista blanca pasa de 6 entradas a 4, y el recuento de SC-005 de 36/4/2 a **38/2/2**. El total de 42 no cambia.

### 2. Hay una tercera forma del defecto, fuera de alcance

`src/app/crm/contactos/[id]/page.tsx` usa `Promise.allSettled` y después `r.status === "fulfilled" ? r.value : []` en **5** cargas secundarias (conversaciones, cuentas de canal, resumen, perfil de IA, empresas).

No se tocó, por dos razones: es la degradación deliberada que `012` documenta como FR-004, y es la categoría "conservar", no "eliminar". Pero **le falta el aviso de FR-007**: esas cinco secciones se renderizan vacías cuando fallan, igual que las dos que sí recibieron aviso en este hotfix.

Queda anotado como trabajo de la Feature posterior, que es donde vive el diseño de la pantalla y el aviso de error. El test-guardia no la vigila: con `allSettled` la distinción entre degradar y mentir no es sintáctica, y una regla mecánica daría falsos positivos.
