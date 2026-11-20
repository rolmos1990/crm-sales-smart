# Research: Pantallas de error con la identidad de Karia

**Feature**: 044-pantallas-de-error | **Fecha**: 2026-11-19

Siete decisiones. Las dos primeras cambian el plan respecto de lo que uno asumiría leyendo la documentación actual de Next.js, así que van primero.

---

## D1 — La versión real es Next 15.5.18, no 16.2

**Decisión**: Planificar contra **Next 15.5.18**, que es lo instalado.

**Rationale**: `CLAUDE.md` declara "Next.js 16.2 (App Router)" en su tabla de stack. Es incorrecto: `package.json` pide `^15.5.18` y `node -e "require('next/package.json').version"` devuelve `15.5.18`. La constitución del proyecto sí lo dice bien ("Approved stack: Next.js 15").

No es un detalle cosmético: la documentación pública de Next describe hoy una API de recuperación de errores que **no existe** en 15.5 (ver D2). Planificar contra la documentación sin mirar la versión instalada habría producido un plan que no compila.

**Acción derivada**: corregir `CLAUDE.md`. Queda anotado como tarea de la fase final, fuera del alcance funcional.

---

## D2 — El botón de reintento usa `reset()` + `router.refresh()`, no `retry()`

**Decisión**: El `error.tsx` recibe `{ error, reset }` y el botón ejecuta `router.refresh()` **y después** `reset()`.

**Rationale**: Dos hechos que se combinan mal si se ignora cualquiera de los dos.

1. **`retry` no existe en 15.5.** El historial de versiones de la documentación lo fecha así: `unstable_retry` agregado en **16.2.0**, `retry` estable en **16.3.0**. En 15.5 la única prop de recuperación es `reset`.

2. **`reset()` por sí solo no vuelve a pedir datos al servidor.** Solo limpia el estado del boundary y re-renderiza los hijos. Si el fallo vino de un Server Component —que es el caso de todas las páginas de Karia, porque todas leen con Prisma del lado del servidor— volver a renderizar con los mismos datos vuelve a fallar. El botón "Reintentar" parecería roto.

El patrón que sí funciona en 15.x es pedir primero el refresco del árbol de servidor y después limpiar el boundary:

```
router.refresh()  →  vuelve a pedir los Server Components
reset()           →  limpia el estado de error y re-renderiza
```

**Esto es lo que hace que FR-002 sea cierto y no decorativo.** Un reintento que no vuelve a consultar es un botón que miente, y este proyecto acaba de dedicar un hotfix entero (043) a dejar de mentir.

**Alternativas consideradas**:
- *Solo `reset()`*: rechazada por lo anterior.
- *`window.location.reload()`*: rechazada. Recarga la aplicación entera, que es exactamente lo que FR-002 pide evitar; además pierde el estado del cliente y hace parpadear el menú.
- *Actualizar a Next 16 para tener `retry()`*: fuera de alcance. Una actualización mayor del framework no puede ser un efecto secundario de agregar pantallas de error.

**Fuentes**: [error.js — API reference](https://nextjs.org/docs/app/api-reference/file-conventions/error) (tabla de Version History), [Next.js 15 Error Handling best practices](https://devanddeliver.com/blog/frontend/next-js-15-error-handling-best-practices-for-code-and-routes).

---

## D3 — La pantalla compartida es un Server Component; las acciones entran por slot

**Decisión**: `AppErrorScreen` es un Server Component sin `'use client'`, con las acciones recibidas como `ReactNode` (igual que `EmptyState` ya hace con su prop `accion`). El botón "Reintentar", que necesita `onClick`, vive dentro de cada `error.tsx` —que es Client Component por obligación del framework— y se le pasa como slot.

**Rationale**: La documentación de `not-found.js` trae una advertencia que decide este punto:

> Next.js sends each `not-found.js` file with every route under its segment, not only with pages that are not found […] For the root `app/not-found.js`, that is every page of your app, so prefer Server Components and `<Link>` there over interactive UI.

Si `AppErrorScreen` llevara `'use client'`, ese costo se arrastraría a **todas** las páginas de Karia, porque el `not-found.tsx` raíz la importaría. Para una pantalla que la mayoría de los usuarios no ve nunca, es el peor intercambio posible.

La separación cae naturalmente: las pantallas de "no encontrado" solo necesitan enlaces (`ButtonLink`, que envuelve `next/link` y es server-safe), y las de error necesitan además un botón con handler, que ya está dentro de un Client Component.

**Verificado en el código**: ni `src/shared/ui/empty-state.tsx` ni `src/components/ui/button.tsx` declaran `'use client'`, y `ButtonLink` solo envuelve `next/link`. Las dos piezas sobre las que se construye ya son server-safe.

**Alternativas consideradas**: un único componente cliente con una prop `onReintentar` opcional. Rechazada por el costo de bundle descrito arriba.

---

## D4 — El `not-found.tsx` raíz puede leer la sesión, y eso lo vuelve dinámico

**Decisión**: El `app/not-found.tsx` raíz lee la sesión para decidir el destino del enlace de salida (FR-007), aceptando que deja de prerenderizarse.

**Rationale**: La documentación lo respalda explícitamente —muestra un `not-found.tsx` raíz `async` que usa `headers()`— así que no es un truco.

El costo es verificable en el build actual del proyecto: hoy `/_not-found` aparece como `○ (Static) prerendered as static content`. Al introducir una API dinámica pasará a `ƒ (Dynamic)`. Para una pantalla de 404 global, renderizar bajo demanda es irrelevante en rendimiento y es el precio exacto de FR-007.

> **RESULTADO EN IMPLEMENTACIÓN**: la sesión sí se puede leer, pero el costo no es el que esta decisión anticipaba. No es solo que `/_not-found` deje de prerenderizarse: como este archivo participa del árbol de todas las rutas, usar una API dinámica ahí volvió dinámicas **las nueve páginas públicas** del proyecto. Se revirtió a un enlace fijo con el destino resuelto por el middleware. Ver `plan.md` § Desviaciones.

**Este es el punto del diseño con más riesgo de sorpresa en implementación**, porque depende de un comportamiento del framework que históricamente tuvo asperezas en esta ruta especial. El `quickstart.md` lo trata como escenario propio: si al implementarlo la sesión no se puede leer ahí, la salida es degradar FR-007 a un enlace fijo a `/` y dejar que el middleware resuelva el destino — no pelearse con el framework.

**Alternativas consideradas**: resolver la sesión en el cliente con un hook. Rechazada por D3 (volvería cliente la pantalla que se envía con todas las páginas).

---

## D5 — No se usa `global-not-found.js`

**Decisión**: Cubrir las URLs que no coinciden con ninguna ruta usando el `app/not-found.tsx` raíz de siempre. No activar `experimental.globalNotFound`.

**Rationale**: `global-not-found.js` existe desde 15.4 pero sigue siendo **experimental** y requiere una bandera en `next.config`. La documentación acota para qué sirve: aplicaciones con **varios root layouts**, o con segmentos dinámicos de primer nivel (`app/[country]/layout.tsx`), donde no hay un layout único desde el cual componer el 404.

Karia no está en ninguno de los dos casos: tiene un único `app/layout.tsx`. El camino estándar alcanza, y evita atar una pantalla de error a una bandera experimental.

La constitución además pide que una dependencia o capacidad nueva tenga una necesidad concreta y no duplique algo existente; acá no la hay.

---

## D6 — Dónde va cada archivo, y por qué no se puede poner en otro lado

**Decisión**: La ubicación no es una preferencia, la fija el framework. De la documentación de `error.js`:

> `error.js` wraps `loading.js`, `not-found.js`, `page.js`, and nested `layout.js` files in a React error boundary. It does **not** wrap the `layout.js` or `template.js` above it in the same segment.

Traducido a la estructura de Karia, donde el armazón (`LayoutAppServidor`: sesión, zona horaria, menú, asistente) se monta en los `layout.tsx` de cada segmento:

| Qué falla | Quién lo captura | ¿Conserva el menú? |
|---|---|---|
| Un `page.tsx` de `crm` | `app/crm/error.tsx` | ✅ — está dentro de `app/crm/layout.tsx` |
| `notFound()` desde `crm/contactos/[id]` | `app/crm/not-found.tsx` | ✅ — ídem |
| `LayoutAppServidor` (sesión, zona) | `app/error.tsx` | ❌ — está por encima del armazón |
| Una URL que no coincide con nada | `app/not-found.tsx` | ❌ — ningún segmento se activó |
| El `app/layout.tsx` raíz | `app/global-error.tsx` | ❌ — reemplaza el documento entero |

Las tres ❌ son límites del enrutado, no decisiones de diseño. El spec ya las asume en las historias 3 y 4.

**Consecuencia práctica**: un `not-found.tsx` por segmento cubre todas las rutas anidadas de ese segmento. No hace falta uno por cada `[id]`.

---

## D7 — `global-error.tsx` se escribe con estilos propios y se verá distinto

**Decisión**: Escribir `app/global-error.tsx` con estilos mínimos embebidos y soporte de `prefers-color-scheme`, sin importar `EmptyState` ni ningún componente del producto.

**Rationale**: La documentación es terminante: `global-error` reemplaza el root layout, debe traer sus propios `<html>` y `<body>`, y **no recibe los estilos globales** ni el `ThemeProvider`. Además no admite export de `metadata` por ser Client Component.

Es decir: el tema que el usuario eligió no llega ahí, y tampoco Tailwind. Intentar que se vea igual que el resto es perseguir algo que el framework no permite. Lo alcanzable —y lo que pide FR-010— es que sea legible en claro y oscuro, que diga algo comprensible y que ofrezca una salida.

También es la razón de que esta pantalla no dependa de `AppErrorScreen`: cuanto más arriba está el fallback, menos puede apoyarse en el producto que acaba de fallar.

---

## D8 — El código de soporte sale de `error.digest`, sin infraestructura nueva

**Decisión**: Mostrar `error.digest` como código de soporte (FR-004). No se agrega logger ni servicio de reporte.

**Rationale**: La documentación define `digest` como "an automatically generated hash of the error thrown. It can be used to match the corresponding error in server-side logs". En producción el mensaje real se reemplaza por uno genérico y queda el digest, que es exactamente el comportamiento que FR-005 pide (no filtrar detalles) y FR-004 necesita (poder correlacionar).

Next ya registra el error del lado del servidor con ese digest, así que el código es buscable **hoy**, sin esperar al trabajo de registro estructurado que quedó fuera de alcance.

**Cuidado al implementar**: `error` llega tipado como `unknown` o como `Error` según la versión y el origen (Server o Client Component). Hay que estrechar con `instanceof Error` antes de leer `digest`, y contemplar que puede venir vacío.

---

## D9 — Inventario de archivos

Siete segmentos montan `LayoutAppServidor`: `crm`, `sales`, `configuracion`, `productos`, `integraciones`, `datos` y `dev`.

| Archivo | Cantidad | Nota |
|---|---|---|
| `src/shared/ui/app-error-screen.tsx` | 1 | Server Component compartido (D3) |
| `app/{segmento}/not-found.tsx` | 6 | `dev` queda fuera: es un taller interno, no producto |
| `app/{segmento}/error.tsx` | 6 | ídem |
| `app/not-found.tsx` | 1 | URLs sin coincidencia (D4) |
| `app/error.tsx` | 1 | Fallos del armazón (D6) |
| `app/global-error.tsx` | 1 | Último recurso (D7) |
| `app/acceso-denegado/{layout,page}.tsx` | 2 | Gana armazón sin cambiar de URL (FR-011, D10) |
| **Total** | **18** | |

Los 12 por segmento son envoltorios de pocas líneas sobre el componente compartido. El trabajo real está en el componente y en los tres archivos raíz.

---

## D10 — `/acceso-denegado` se mueve dentro del armazón

**Decisión**: Mover la ruta a un lugar donde herede el menú, en vez de dejarla donde está.

**Rationale**: `src/app/acceso-denegado/` no tiene `layout.tsx` propio ni cuelga de un segmento que monte el armazón, así que hoy se renderiza sin menú. Pero a esa pantalla **solo se llega con sesión iniciada**: todas las páginas hacen `requireSesion()` y luego `redirect("/acceso-denegado")` si el rol no alcanza. Un usuario autenticado que choca con un permiso pierde la navegación sin ninguna razón.

Ya usa `EmptyState` + `ButtonLink` con la anatomía correcta, así que el cambio es de ubicación y de componente compartido, no de diseño.

**Riesgo a vigilar**: hay **40 archivos** que hacen `redirect("/acceso-denegado")`. Cambiar la URL obligaría a tocar los 40 y cualquier olvido manda al usuario a un 404. La alternativa —dejar la dirección como está y agregarle un `layout.tsx` que monte el armazón— consigue el menú sin tocar ninguno, y es la que el plan adopta.

---

## Resumen de decisiones

| # | Decisión | Por qué importa |
|---|---|---|
| D1 | Next 15.5.18, no 16.2 | `CLAUDE.md` está mal; condiciona D2 |
| D2 | `reset()` + `router.refresh()` | `retry()` no existe en 15.5; `reset()` solo no re-consulta |
| D3 | Pantalla compartida como Server Component | El 404 raíz viaja con **todas** las páginas |
| D4 | La raíz lee sesión y deja de ser estática | Habilita FR-007; punto de mayor riesgo |
| D5 | Sin `global-not-found.js` | Experimental y para un caso que Karia no tiene |
| D6 | Ubicación fijada por el framework | Define qué pantallas pueden tener menú |
| D7 | `global-error` con estilos propios | No recibe Tailwind ni el tema; se verá distinto |
| D8 | `error.digest` como código de soporte | Correlacionable hoy, sin infraestructura nueva |
| D9 | 18 archivos | 12 son envoltorios triviales |
| D10 | `acceso-denegado` con armazón vía `layout.tsx` | Evita tocar los 40 redirects |
