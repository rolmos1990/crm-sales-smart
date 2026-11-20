# Feature Specification: Las páginas dejan de esconder los fallos de lectura

**Feature Branch**: `hotfix/043-fix-errores-tragados`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "Las páginas de Karia atrapan errores de base de datos y los esconden, mostrando pantallas vacías creíbles o 404 falsos en vez del fallo real."

## Diagnóstico previo (investigación de código)

### Qué se investigó y dónde

Barrido de los **42 bloques** que atrapan un fallo de lectura en los `page.tsx` bajo `src/app`, repartidos en **32 archivos**, leyendo en cada uno qué se atrapa y qué renderiza la página después. En paralelo: `src/shared/auth/sesion.ts`, `src/sales/pedidos/condicion-venta.ts`, los tres `.env` del proyecto, y el inventario de límites de error del App Router.

**El defecto tiene dos formas sintácticas y conviene no buscar solo una.** 37 bloques son `try/catch` y los otros 5 son `.catch(() => null)` / `.catch(() => [])` encadenados a la promesa dentro de un `Promise.all`:

```ts
// src/app/productos/[id]/editar/page.tsx:18-20
const [producto, productosComponentes, etiquetas] = await Promise.all([
  obtenerProductoPorId(id, sesion.instanciaId).catch(() => null),
  obtenerProductosParaComponentes(sesion.instanciaId, id).catch(() => []),
  obtenerEtiquetasProducto(sesion.instanciaId).catch(() => []),
]);
```

Es el mismo defecto con otra escritura: el fallo se convierte en un valor inventado y la página sigue. La segunda forma se encontró recién al verificar el recuento de guards, porque un barrido por `catch {` no la ve — razón por la cual el test-guardia de este hotfix debe detectar ambas (ver `research.md`, D5).

### La premisa que esos `catch` declaran es falsa

26 de los 37 llevan un comentario de la forma `// DB no configurada` o `// DB not configured`. **No pueden estar atrapando eso.**

`requireSesion()` → `obtenerSesionActual()` (`src/shared/auth/sesion.ts:34`) ejecuta `prisma.usuario.findUnique` **antes** del `try`, en las 86 páginas que la usan. Si no hubiera base de datos, la excepción sale ahí y ninguno de estos `catch` llega a ejecutarse.

El guard que los acompaña en las páginas de detalle es código muerto:

```ts
if (!registro && process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("placeholder")) {
  notFound();
}
```

Ninguno de los tres entornos del proyecto (`.env`, `.env.local`, `.env.prod`) tiene la cadena `placeholder` en `DATABASE_URL`, así que la condición es **siempre verdadera**. El camino alternativo —el fallback "no disponible"— es inalcanzable.

**Causa raíz**: estos `catch` no protegen contra "no hay base de datos". Atrapan **fallo parcial con la base operativa**: pool de conexiones agotado, `statement_timeout` en un tenant grande, deadlock, o un error de Prisma por datos inesperados. Es decir, atrapan exactamente el fallo realista de producción, y lo convierten en una pantalla que miente.

### Por qué el síntoma se explica por esta causa y no por otra

El repositorio tiene **42 `loading.tsx` y cero `error.tsx`**. No existe ningún límite de error en toda la aplicación. Por lo tanto el único comportamiento posible ante un fallo de lectura es el que decide cada bloque: dejar la variable en su valor inventado (`[]`, `null`, `0`) y seguir renderizando. El síntoma —pantallas vacías creíbles, 404 falsos, totales en cero— es consecuencia directa y única de eso.

### Las cuatro formas del síntoma

**A — Un registro que existe se reporta como inexistente (10 sitios).** El bloque deja el registro en `null` y la línea siguiente dispara `notFound()`. El guard está invertido: protege al desarrollador sin base de datos y castiga a producción.

| Archivo | Línea |
|---|---|
| `src/app/crm/contactos/[id]/page.tsx` | 47 |
| `src/app/crm/contactos/[id]/editar/page.tsx` | 39 |
| `src/app/crm/empresas/[id]/page.tsx` | 33 |
| `src/app/crm/empresas/[id]/editar/page.tsx` | 21 |
| `src/app/crm/oportunidades/[id]/page.tsx` | 53 |
| `src/app/crm/oportunidades/[id]/editar/page.tsx` | 35 |
| `src/app/sales/cotizaciones/[id]/page.tsx` | 45 |
| `src/app/sales/cotizaciones/[id]/editar/page.tsx` | 41 |
| `src/app/sales/pedidos/[id]/page.tsx` | 80 |
| `src/app/productos/[id]/editar/page.tsx` | 18 (forma `.catch`) |

`sales/cotizaciones/[id]/editar/page.tsx:41` ni siquiera tiene el guard: es `if (!cotizacion) notFound()` a secas.

**B — El formulario guarda datos equivocados (11 sitios).** El más grave: no esconde, corrompe. Los formularios degradan a valores por defecto cableados en el código y el usuario guarda con ellos sin ver ninguna advertencia.

| Archivo | Línea | Qué degrada en silencio |
|---|---|---|
| `src/app/crm/contactos/nuevo/page.tsx` | 34 | `defaultCountryCode` cae a `"PA"` → el teléfono se guarda con prefijo de Panamá aunque el comercio sea de otro país |
| `src/app/crm/contactos/[id]/editar/page.tsx` | 39 | ídem, más empresas y etiquetas vacías |
| `src/app/sales/cotizaciones/nueva/page.tsx` | 43 | `monedaDefault`, `defaultCountryCode`, `filtroCatalogoInicial` → cotización en la moneda equivocada |
| `src/app/sales/cotizaciones/[id]/editar/page.tsx` | 41 | ídem |
| `src/app/sales/pedidos/nuevo/page.tsx` | 37 | ídem → pedido con moneda y país equivocados |
| `src/app/crm/oportunidades/nueva/page.tsx` | 47 | `pipelines` vacío → formulario sin etapas |
| `src/app/crm/actividades/nueva/page.tsx` | 41 | todos los selectores de vínculo vacíos → actividad sin relacionar |
| `src/app/productos/[id]/editar/page.tsx` | 18, 19, 20 | forma `.catch`: el producto, sus componentes y sus etiquetas → **se edita un combo sin ver sus componentes y se guarda vaciado** |
| `src/app/productos/nuevo/page.tsx` | 17, 18 | forma `.catch`: componentes y etiquetas → producto nuevo sin composición ni clasificación |

Cuatro de estos once son el mismo bloque que ya aparece en la categoría A.

El de `productos/[id]/editar` es el peor del grupo: un combo cuya lista de componentes falla se renderiza como un combo sin componentes, y guardar el formulario persiste esa composición vacía. Es pérdida de datos, no solo un dato mal elegido. Nótese además que en ese mismo `Promise.all`, `obtenerMonedaPrincipal` (en `productos/nuevo/page.tsx:16`) **no** lleva `.catch` y ya propaga: el defecto es inconsistente incluso dentro de una misma llamada.

**C — Lista vacía creíble: el usuario concluye que se borraron sus datos (17 sitios).**

El caso más claro es `src/app/crm/contactos/page.tsx:31`. Si la carga falla, `inicial` queda `null` y la página renderiza:

```
EmptyState  "Sin contactos todavía"
            "Crea tu primer contacto para empezar a gestionar tus relaciones."
            [ Crear primer contacto ]
```

…a un comercio con 5.000 contactos.

Resto: `crm/empresas/page.tsx:20`, `crm/actividades/page.tsx:20` (renderiza el `EmptyState` explícitamente con `if (length === 0)`), `crm/etiquetas/page.tsx:15`, `crm/inbox/page.tsx:25` ("no hay conversaciones"), `crm/oportunidades/page.tsx:70`, `crm/pipeline/page.tsx:86`, `sales/cotizaciones/page.tsx:26`, `sales/pedidos/page.tsx:43` y `:73`, `productos/page.tsx:27`, `datos/page.tsx:23` (la importación entra sin campos personalizados), `integraciones/page.tsx:17`, `integraciones/instagram/page.tsx:89`, `integraciones/facebook-messenger/page.tsx:45`, `integraciones/whatsapp-lite/page.tsx:45`.

Los cuatro de integraciones comparten un daño extra: mostrar una cuenta conectada como "no instalada" invita al usuario a reconectarla.

**D — Números falsos (3 sitios).** `src/app/crm/page.tsx:78` devuelve el objeto completo de KPIs en cero. "Pipeline: $0" cuando hay $400.000 no es un vacío, es un dato falso — y es la pantalla sobre la que se toman decisiones. `crm/page.tsx:105` y `:126` devuelven `[]` para dos listas secundarias.

### El caso que revierte 038 en silencio

`src/app/sales/pedidos/page.tsx:43` carga el flujo de venta. Si esa query falla, `etapasFlujo` queda `[]`, y `construirCondicionVenta([])` (`src/sales/pedidos/condicion-venta.ts:37`) cae al fallback legacy `{ estado: "ENTREGADO" }`.

Ese fallback es **correcto y debe conservarse** para instancias sin flujo dinámico (FR-010 de 038). El problema es que un fallo transitorio es indistinguible de "no hay flujo configurado": en una instancia **con** flujo, "Total ventas" pasa a contarse por el enum `estado` —que, según el comentario del propio archivo, queda congelado desde la creación del pedido y no sirve para esto— en vez de por `cuentaComoVenta`. El total sale mal, sin ningún error visible.

Es exactamente la trampa que la regla 10 de `CLAUDE.md` advierte, llegando por una puerta que esa regla no contempla: no una refactorización, sino un `catch`.

### Qué se confirmó que SÍ funciona (no tocar)

1. **Degradación legítima de carga secundaria, con el contenido principal ya resuelto** — 2 sitios:
   - `src/app/crm/oportunidades/[id]/page.tsx:76` — conversaciones de la oportunidad
   - `src/app/sales/cotizaciones/nueva/page.tsx:77` — prefill opcional desde la oportunidad de origen
2. **Las dos listas secundarias del dashboard** — `crm/page.tsx:105` (oportunidades recientes) y `:126` (actividades de hoy). Pueden seguir degradando; lo que no deben es renderizar vacío sin avisar.
3. **El fallback legacy de `construirCondicionVenta`** para instancias sin flujo dinámico.
4. **El `notFound()` real** cuando el registro efectivamente no existe (devuelve `null` sin excepción).
5. **Fuera de alcance, no son de este tema** — 2 sitios: `crm/oportunidades/[id]/page.tsx:98` y `sales/pedidos/[id]/page.tsx:49` son `try/catch` alrededor del formateo de una fecha de campo personalizado.

### Deriva ya existente hacia el patrón correcto

El código más reciente (`crm/contactos/page.tsx:31`, `crm/oportunidades/page.tsx:70`, `sales/pedidos/page.tsx:43` y `:73`, y los tres de integraciones de canal) ya usa `catch (err) { console.error(...) }` en lugar de `catch {}` pelado. Sigue tragando el error, pero al menos deja rastro. Este hotfix formaliza y completa esa deriva.

### Recuento

| Categoría | Bloques | Acción |
|---|---|---|
| A — 404 falso | 10 | eliminar |
| B — datos equivocados (4 solapan con A) | 11 | eliminar |
| C — vacío creíble | 17 | eliminar |
| D — KPIs en cero | 1 | eliminar |
| D — listas secundarias del dashboard | 2 | conservar, con aviso visible |
| E — degradación legítima | 2 | conservar, con aviso visible |
| Fuera de alcance (formateo de fecha) | 2 | no tocar |
| **Total** | **42** | **36 se eliminan, 4 se conservan, 2 quedan fuera** |

Por forma sintáctica: 37 `try/catch` (31 se eliminan) y 5 `.catch(...)` (los 5 se eliminan). Guards `DATABASE_URL.includes("placeholder")` a eliminar: **9**, en 9 archivos.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El formulario no guarda datos con valores por defecto equivocados (Priority: P1)

Un vendedor abre "Nuevo pedido" en el momento en que una lectura falla. Hoy el formulario se abre igual, con la moneda y el prefijo telefónico cambiados a valores cableados, y el pedido se graba mal sin que nadie lo note. Debe, en cambio, no dejarlo llegar a un formulario que guardaría datos incorrectos.

**Why this priority**: Es el único caso del hotfix que **produce datos erróneos persistidos** en lugar de solo mostrarlos. Un 404 molesta durante un minuto; una cotización emitida en la moneda equivocada se factura y hay que corregirla aguas abajo.

**Independent Test**: Forzar el fallo de la carga de configuración en `sales/pedidos/nuevo` y verificar que no se renderiza el formulario. Entregable por sí solo: arregla los 7 formularios sin tocar ninguna otra pantalla.

**Acceptance Scenarios**:

1. **Given** una instancia cuya moneda principal es PEN y cuyo país es Perú, **When** la lectura de configuración falla al abrir "Nuevo pedido", **Then** el usuario ve una pantalla de error y **no** un formulario con moneda o prefijo telefónico por defecto.
2. **Given** las mismas condiciones, **When** la lectura funciona normalmente, **Then** el formulario se abre con la moneda y el prefijo correctos, exactamente como hoy.
3. **Given** "Nueva oportunidad" con un fallo en la carga de pipelines, **When** el usuario abre la página, **Then** ve una pantalla de error en vez de un formulario sin etapas seleccionables.

---

### User Story 2 - Un registro que existe nunca se reporta como inexistente (Priority: P1)

Un usuario abre el detalle de un contacto que existe. Si la lectura falla, hoy recibe un 404 que afirma que el contacto no existe. Debe recibir un error que diga que no se pudo cargar.

**Why this priority**: Es la mentira más dañina del conjunto porque es **afirmativa**: no omite información, asegura un hecho falso sobre los datos del usuario. Dispara tickets de soporte y erosiona la confianza en que Karia conserva la información.

**Independent Test**: Forzar el fallo de `obtenerContactoPorId` y verificar que la respuesta no es un 404. Entregable por sí solo: arregla las 9 páginas de detalle y edición.

**Acceptance Scenarios**:

1. **Given** un contacto que existe en la base, **When** su lectura falla por un error transitorio, **Then** el usuario ve una pantalla de error, no un 404.
2. **Given** un identificador de contacto que no corresponde a ningún registro, **When** el usuario navega a su detalle, **Then** sigue viendo el 404 de siempre — este comportamiento no cambia.
3. **Given** una cotización que existe, **When** su lectura falla al entrar a editarla, **Then** el usuario ve una pantalla de error, no un 404.

---

### User Story 3 - Los totales nunca muestran un número inventado (Priority: P2)

El dueño del comercio abre el dashboard o el listado de pedidos. Si un total no se pudo calcular, debe decirlo; nunca mostrar `0` ni un total calculado con una regla distinta de la configurada.

**Why this priority**: Un número falso es peor que un número ausente porque **no se percibe como un fallo**. Un "$0" en Pipeline o un "Total ventas" calculado con la regla legacy se lee como un dato y se decide sobre él. Va en P2 y no P1 porque no persiste datos erróneos.

**Independent Test**: Forzar el fallo de la carga del flujo de venta en el listado de pedidos y verificar que no se muestra ningún total. Entregable por sí solo: toca el dashboard y el listado de pedidos.

**Acceptance Scenarios**:

1. **Given** una instancia con $400.000 en pipeline, **When** el cálculo de KPIs del dashboard falla, **Then** el usuario ve una pantalla de error, no tarjetas en cero.
2. **Given** una instancia **con** flujo de venta dinámico configurado y etapas marcadas `cuentaComoVenta`, **When** la lectura del flujo falla, **Then** no se muestra ningún total de ventas calculado con la regla legacy.
3. **Given** una instancia **sin** flujo dinámico, **When** todo funciona normalmente, **Then** los totales se siguen calculando con el fallback legacy por enum `estado`, exactamente como hoy.
4. **Given** un fallo en la carga de oportunidades recientes del dashboard, **When** el resto del dashboard carga bien, **Then** esa sección muestra un aviso de "no se pudo cargar" y el resto de la pantalla sigue funcionando.

---

### User Story 4 - Una lista vacía significa que no hay datos, nunca que no se pudieron leer (Priority: P3)

Un usuario entra a Contactos, Inbox, Productos o cualquier listado. Si la lectura falló, la pantalla debe decirlo en lugar de mostrar el estado vacío de "todavía no creaste nada".

**Why this priority**: Es el grupo más numeroso (17 bloques) y el más visible, pero el daño es reversible: el usuario recarga y ve sus datos. Va último porque las tres historias anteriores atacan daño que persiste o que se decide.

**Independent Test**: Forzar el fallo de la carga de contactos y verificar que la pantalla no ofrece "Crear primer contacto". Entregable por sí solo, listado por listado.

**Acceptance Scenarios**:

1. **Given** un comercio con 5.000 contactos, **When** la carga del listado falla, **Then** el usuario ve una pantalla de error y nunca el mensaje "Sin contactos todavía".
2. **Given** un comercio sin ningún contacto creado, **When** la carga funciona normalmente, **Then** sigue viendo el estado vacío "Sin contactos todavía" con su llamada a la acción — este comportamiento no cambia.
3. **Given** una cuenta de Instagram conectada, **When** la carga de cuentas del canal falla, **Then** el usuario no ve la integración presentada como desconectada ni se le invita a reconectarla.

---

### Edge Cases

- **El fallo ocurre en el layout, no en la página.** `obtenerSesionActual` corre en `LayoutAppServidor`, por encima de cada página. Un fallo ahí no lo captura ningún límite de la sección; escapa a la raíz. Queda registrado como límite conocido de este hotfix (ver Assumptions).
- **El fallo ocurre después de empezar a transmitir la respuesta.** Una página parcialmente enviada no puede reemplazarse por una pantalla de error completa. El resultado será una página truncada; sigue siendo preferible a una pantalla completa que miente.
- **Fallo durante un desarrollo local sin Postgres levantado.** Las páginas pasarán a fallar de forma visible en lugar de renderizar vacías. No es una regresión: ya fallaban antes, en `requireSesion()`, por la misma razón.
- **Dos lecturas en la misma página, una falla y la otra no.** El criterio es la categoría: si lo que falló es el contenido principal, la página entera falla; si es secundario, se degrada con aviso.
- **Un registro devuelve `null` legítimamente y además hay un error en otra query de la misma `Promise.all`.** El error gana: se propaga, no se emite 404.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Cuando la lectura del contenido principal de una página falle, el sistema MUST propagar el fallo en lugar de renderizar la página con valores inventados. Aplica por igual a las dos formas sintácticas del defecto: `try/catch` alrededor de la lectura y `.catch(...)` encadenado a la promesa.
- **FR-002**: El sistema MUST NOT presentar un registro como inexistente cuando su lectura falló por una excepción. El resultado "no existe" MUST derivarse únicamente de una lectura exitosa que no devolvió fila.
- **FR-003**: El sistema MUST NOT renderizar un formulario de creación o edición cuyos valores por defecto provengan de una lectura de configuración fallida.
- **FR-004**: El sistema MUST NOT mostrar un total, KPI o contador calculado a partir de una lectura fallida, ni sustituirlo por cero.
- **FR-005**: El sistema MUST NOT presentar un estado vacío ("todavía no hay…") cuando la lectura que alimenta esa lista falló.
- **FR-006**: El sistema MUST eliminar el guard `DATABASE_URL.includes("placeholder")` de los 9 archivos que lo contienen, por ser código inalcanzable en todos los entornos del proyecto.
- **FR-007**: Cuando una lectura **secundaria** falle y el contenido principal esté disponible, el sistema MUST renderizar la página y MUST mostrar un aviso visible de que esa sección no se pudo cargar, en lugar de renderizarla vacía.
- **FR-008**: Todo bloque que se conserve MUST registrar el error con suficiente contexto para identificar la página y la operación.
- **FR-009 (NO ALTERAR LO EXISTENTE)**: El sistema MUST NOT alterar el comportamiento actual de:
  - los 2 bloques de degradación legítima identificados en el diagnóstico (`crm/oportunidades/[id]/page.tsx:76`, `sales/cotizaciones/nueva/page.tsx:77`), más allá de agregarles el aviso de FR-007;
  - el fallback legacy de `construirCondicionVenta` para instancias **sin** flujo de venta dinámico, que MUST seguir contando por enum `estado` (FR-010 de 038);
  - la respuesta 404 para un registro que efectivamente no existe;
  - los estados vacíos legítimos, que MUST seguir apareciendo cuando la lectura fue exitosa y no hay datos;
  - los 2 bloques de formateo de fecha fuera de alcance (`crm/oportunidades/[id]/page.tsx:98`, `sales/pedidos/[id]/page.tsx:49`).
- **FR-010**: El sistema MUST NOT introducir límites de error, pantallas de error con la identidad visual del producto, ni infraestructura de registro estructurado. Ese alcance pertenece a la Feature posterior (ver Assumptions).

### Key Entities

Sin entidades nuevas ni cambios en el modelo de datos. Este hotfix solo modifica el flujo de control de lectura en páginas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ante un fallo de lectura, en el 100% de las páginas afectadas el usuario recibe una indicación de error; en ninguna recibe un estado vacío, un 404 ni un total en cero. Ninguna de las dos formas sintácticas del defecto sobrevive en el código.
- **SC-002**: Cero formularios de creación o edición quedan accesibles con valores por defecto provenientes de una lectura fallida, verificado sobre los 10 formularios del diagnóstico. Incluye que un combo nunca se renderice sin sus componentes por un fallo de lectura.
- **SC-003**: Con la base operativa, el 100% de los recorridos existentes se comporta de forma idéntica a antes del cambio: mismos listados, mismos estados vacíos legítimos, mismos 404 para registros inexistentes, mismos totales.
- **SC-004**: Una instancia con flujo de venta dinámico nunca muestra un total de ventas calculado con la regla legacy; una instancia sin flujo dinámico lo sigue calculando así siempre.
- **SC-005**: De los 42 bloques inventariados, 38 quedan eliminados, 2 conservados con aviso y registro, y 2 intactos por estar fuera de alcance — contable sobre el diff. Los 9 guards `placeholder` quedan en cero.
  - *Resultado*: 42 → 4. Son 38 eliminados y no 36 porque los dos bloques de `crm/page.tsx` que el plan daba por conservables resultaron ser código muerto (ver `plan.md` § Desviaciones).
- **SC-006**: Un fallo de lectura deja un registro identificable con la página y la operación en el 100% de los bloques conservados.

## Assumptions

- **Este hotfix solo deja de mentir; no construye la pantalla bonita.** Hasta que exista la Feature posterior, un error propagado produce la pantalla de error por defecto del framework: visualmente pobre, pero **honesta**. Es una mejora estricta sobre el 404 falso y el vacío creíble, y se asume aceptable como estado intermedio.
- **Dependencia declarada**: la Feature posterior aporta los límites de error por sección, la pantalla de error con la identidad visual del producto, el fallback global y el registro estructurado. Este hotfix es su condición previa: sin él, esos límites casi nunca se dispararían, porque el error no llega hasta ellos.
- **Fuera de alcance: los fallos originados en el layout.** `obtenerSesionActual` corre por encima de las páginas y un fallo suyo escapa a cualquier límite de sección. Cubrirlo requiere un límite en el segmento padre, que pertenece a la Feature posterior.
- **Fuera de alcance: los 134 `try/catch` de las Server Actions.** Este hotfix se limita a la lectura en páginas. El manejo de errores en escritura (contrato de retorno unificado, códigos discriminables, errores por campo) pertenece a la Feature posterior.
- Se asume que los fallos de lectura son infrecuentes y transitorios, de modo que fallar de forma visible es preferible a degradar en silencio. Si una lectura resultara crónicamente inestable, el remedio es arreglar esa lectura, no volver a esconderla.
- Se asume que el aviso de FR-007 puede expresarse con los componentes ya existentes en el proyecto, sin introducir primitivos nuevos.
