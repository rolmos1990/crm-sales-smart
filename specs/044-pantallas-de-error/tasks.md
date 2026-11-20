---

description: "Task list — 044 pantallas de error"
---

# Tasks: Pantallas de error con la identidad de Karia

**Input**: Design documents from `/specs/044-pantallas-de-error/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/pantallas-de-error.md, quickstart.md

**Tests**: El spec no pide TDD y no se generan tests por historia. La razón: lo que hay que verificar acá no es lógica pura sino comportamiento del framework —que el reintento vuelva a consultar, que el menú siga ahí, que ninguna pantalla quede en blanco— y eso se valida con `quickstart.md` y con la suite de Playwright existente. Un test unitario de un componente de presentación no probaría nada de eso.

**Organization**: Una tarea por archivo. Los doce envoltorios de segmento no comparten nada entre sí y son todos paralelizables.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias)
- **[Story]**: US1, US2, US3, US4 — mapea a las historias de `spec.md`
- Todas las rutas son relativas a la raíz del repositorio

## Antes de escribir una sola línea

Leé [`contracts/pantallas-de-error.md`](./contracts/pantallas-de-error.md). Define la anatomía compartida y la matriz de qué pantalla puede prometer qué. Las tres reglas que más fácil se rompen:

1. **El reintento hace `router.refresh()` y después `reset()`**, en ese orden. `retry()` no existe en Next 15.5 y `reset()` a secas no vuelve a consultar al servidor.
2. **`AppErrorScreen` no lleva `'use client'`.** El `not-found.tsx` raíz viaja con todas las páginas de la aplicación.
3. **Ninguna pantalla muestra texto proveniente del error.** Solo `digest`.

---

## Phase 1: Setup — la verificación que puede cambiar el alcance

**Purpose**: Confirmar, antes de escribir doce pantallas, que el 404 raíz puede leer la sesión. Si no se sostiene, US3 se degrada y conviene saberlo ahora.

- [X] T001 Probar en `src/app/not-found.tsx` un componente mínimo `async` que lea la sesión, correr `npm run build` y confirmar que `/_not-found` pasa de `○ (Static)` a `ƒ (Dynamic)` en la salida. Si queda estático o el build falla por usar una API dinámica en esa ruta, **no insistir**: anotar la degradación de FR-007 en `research.md` D4, dejar el archivo con un enlace fijo a `/` y ajustar T019. El archivo de esta prueba es el punto de partida de T019, no se descarta

**Checkpoint**: se sabe si FR-007 es alcanzable tal como está escrito.

---

## Phase 2: Foundational — la anatomía compartida

**Purpose**: El componente del que dependen las dieciséis pantallas.

**⚠️ BLOQUEANTE**: ninguna historia puede empezar hasta que esté.

- [X] T002 Crear `src/shared/ui/app-error-screen.tsx` como **Server Component** (sin `'use client'`) con las props `titulo`, `descripcion`, `Icono`, `accion`, `accionSecundaria` y `codigoSoporte`, siguiendo el contrato §1. Reutilizar la anatomía de `src/shared/ui/empty-state.tsx` —contenedor centrado, ícono en caja redondeada, título, descripción, zona de acciones— para que esta familia y los estados vacíos se vean hermanas. El componente NO recibe objetos de error, NO consulta datos y NO conoce handlers: solo texto ya resuelto y nodos ya armados. Si `codigoSoporte` llega vacío, esa sección no se renderiza

**Checkpoint**: existe una única anatomía; las dieciséis pantallas son envoltorios sobre ella.

---

## Phase 3: User Story 1 — Un 404 dentro de la app no expulsa al usuario (Priority: P1) 🎯 MVP

**Goal**: Que un registro inexistente dé una pantalla con el menú intacto y una salida, en los seis módulos. Es el caso que originó la Feature.

**Independent Test**: Abrir `/crm/contactos/noexiste` con sesión iniciada y comprobar que el menú lateral sigue visible y hay un botón de regreso.

Los seis `not-found.tsx` son Server Components sin props, con enlaces (`ButtonLink`) y nunca botones con handler — se envían con todas las rutas de su segmento.

- [X] T003 [P] [US1] Crear `src/app/crm/not-found.tsx` con `AppErrorScreen`: mensaje de registro no encontrado en CRM, acción "Volver a contactos" y secundaria "Ir al inicio"
- [X] T004 [P] [US1] Crear `src/app/sales/not-found.tsx`, con el texto y la acción de regreso propios de Ventas
- [X] T005 [P] [US1] Crear `src/app/configuracion/not-found.tsx`, ídem para Configuración
- [X] T006 [P] [US1] Crear `src/app/productos/not-found.tsx`, ídem para Productos
- [X] T007 [P] [US1] Crear `src/app/integraciones/not-found.tsx`, ídem para Integraciones
- [X] T008 [P] [US1] Crear `src/app/datos/not-found.tsx`, ídem para Datos
- [X] T009 [P] [US1] Crear `src/app/acceso-denegado/layout.tsx` que reexporte `LayoutAppServidor` igual que los seis layouts de segmento, para que la pantalla de permiso denegado gane el menú. **No cambiar la URL**: hay 40 archivos que hacen `redirect("/acceso-denegado")` y mover la ruta obligaría a tocarlos todos
- [X] T010 [P] [US1] Reescribir `src/app/acceso-denegado/page.tsx` sobre `AppErrorScreen`, conservando el texto actual y el ícono `ShieldAlert`. Es el único archivo preexistente que esta Feature modifica
- [ ] T011 ⚠️ PENDIENTE (requiere navegador y base de datos) — [US1] Verificar la historia con el escenario 1 de `quickstart.md`: las seis URLs de registro inexistente dan menú visible y salida, y `/acceso-denegado` ahora también conserva el menú

**Checkpoint**: un identificador inexistente ya no expulsa al usuario de la aplicación. Entregable y desplegable por sí solo.

---

## Phase 4: User Story 2 — Un error inesperado no tumba la aplicación (Priority: P1)

**Goal**: Que un fallo de render deje la sección recuperable sin perder el resto de la aplicación.

**Independent Test**: Forzar el fallo de una consulta, comprobar que el menú sigue, pulsar "Reintentar" con la causa ya resuelta y ver que la sección carga.

Los seis son Client Components (`'use client'`, obligatorio para un boundary) y reciben `{ error, reset }`. En los seis: estrechar `error` con `instanceof Error` antes de leer `digest`, registrar con `console.error` dentro de un `useEffect`, y ofrecer siempre una salida además del reintento.

- [X] T012 [P] [US2] Crear `src/app/crm/error.tsx` con el botón de reintento que ejecuta `router.refresh()` **y después** `reset()`, más una acción secundaria "Ir al inicio" y el `digest` como código de soporte
- [X] T013 [P] [US2] Crear `src/app/sales/error.tsx` con la misma forma
- [X] T014 [P] [US2] Crear `src/app/configuracion/error.tsx` con la misma forma
- [X] T015 [P] [US2] Crear `src/app/productos/error.tsx` con la misma forma
- [X] T016 [P] [US2] Crear `src/app/integraciones/error.tsx` con la misma forma
- [X] T017 [P] [US2] Crear `src/app/datos/error.tsx` con la misma forma
- [ ] T018 ⚠️ PENDIENTE (requiere navegador; es el escenario crítico) — [US2] Verificar la historia con el escenario 2 de `quickstart.md`, **ejecutándolo de verdad**: forzar un `throw` en una consulta, abrir la página, quitar el `throw` sin recargar y pulsar "Reintentar". Si vuelve a aparecer la pantalla de error, falta el `router.refresh()`. Este paso no se puede dar por bueno leyendo el código

**Checkpoint**: un fallo de sección es recuperable sin recargar la aplicación ni volver a iniciar sesión.

---

## Phase 5: User Story 3 — Una dirección que no existe sigue pareciendo Karia (Priority: P2)

**Goal**: Que una URL sin coincidencia muestre la identidad del producto y una salida acorde a si hay sesión.

**Independent Test**: Abrir `/una-direccion-inventada` con sesión y sin sesión, y comprobar que el destino del enlace cambia.

- [X] T019 [US3] Completar `src/app/not-found.tsx` sobre el archivo de T001: Server Component `async` que resuelve la sesión y decide el destino de la salida — al inicio de la aplicación si hay sesión, al inicio de sesión si no. Sin menú: ningún segmento se activó y no hay armazón del que heredarlo. Solo enlaces, nunca interactividad (viaja con todas las páginas). Si T001 determinó que la sesión no se puede leer acá, dejar un enlace fijo a `/` y que el middleware resuelva el destino
- [ ] T020 ⚠️ PARCIAL — escenario 5 ejecutado (ver desviación); 3 y 4 requieren navegador. [US3] Verificar la historia con los escenarios 3, 4 y 5 de `quickstart.md`: con sesión el enlace va a la aplicación, sin sesión al inicio de sesión, y `/_not-found` figura como `ƒ (Dynamic)` en el build

**Checkpoint**: ninguna dirección de Karia devuelve ya la pantalla negra por defecto.

---

## Phase 6: User Story 4 — El último recurso también está controlado (Priority: P3)

**Goal**: Que un fallo del armazón o del documento raíz dé una pantalla controlada, no una en blanco.

**Independent Test**: Forzar un `throw` en la resolución de sesión y comprobar que aparece una pantalla con mensaje y acción.

- [X] T021 [P] [US4] Crear `src/app/error.tsx` como Client Component para los fallos de `LayoutAppServidor` (sesión, zona horaria, menú). Va en la raíz porque un `error.tsx` **no** envuelve el `layout.tsx` de su propio segmento. Sin menú — es correcto: lo que falló es justamente lo que lo construye. Acciones: reintentar e ir al inicio de sesión
- [X] T022 [P] [US4] Crear `src/app/global-error.tsx` como Client Component con sus propios `<html>` y `<body>`, estilos embebidos mínimos y soporte de `prefers-color-scheme`. **No importa `AppErrorScreen` ni ningún componente del producto**: este archivo reemplaza el layout raíz y no recibe Tailwind ni el `ThemeProvider`. Tampoco admite export de `metadata`; si hace falta título, usar el componente `<title>` de React
- [ ] T023 ⚠️ PENDIENTE (requiere navegador) — [US4] Verificar la historia con el escenario 6 de `quickstart.md`: forzar un `throw` en `obtenerSesionActual` y otro en `src/app/layout.tsx`, y confirmar que ninguno de los dos da pantalla en blanco

**Checkpoint**: no queda ningún camino que termine en una pantalla sin controlar.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T024 Corregir la versión de Next en `CLAUDE.md`: la tabla de stack dice "Next.js 16.2 (App Router)" y la versión instalada es **15.5.18**. La constitución ya lo dice bien. Esta discrepancia estuvo a punto de producir un plan basado en una API (`retry()`) que no existe en la versión instalada
- [X] T025 Revisar las dieciséis pantallas juntas (las de `src/app/**/{error,not-found,global-error}.tsx` más `src/shared/ui/app-error-screen.tsx`), en una sola pasada, contra el contrato §5: ninguna muestra texto del error, ninguna carece de salida alternativa, ninguna promete menú donde no puede haberlo, y el mismo concepto usa el mismo texto en pantallas hermanas
- [ ] T026 ⚠️ PENDIENTE (requiere navegador) — Ejecutar las comprobaciones transversales de `quickstart.md` sobre la familia completa: sin texto técnico, código de soporte visible y correlacionable con el registro del servidor, modo claro y oscuro, y 360 px de ancho sin desbordes
- [~] T027 Cero regresión: `npm run build` ✅ exit 0 · `npm run test:unit` ✅ 2111/2111 · guardia de 043 ✅ · `npm run test:e2e` ⚠️ PENDIENTE (requiere servidor y DB de prueba)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (T001)**: sin dependencias. Va primero porque su resultado puede cambiar el alcance de US3
- **Phase 2 (T002)**: **BLOQUEA todas las historias** — las dieciséis pantallas son envoltorios sobre `AppErrorScreen`
- **Phases 3 a 6**: dependen solo de la Phase 2. Entre sí son **independientes**: ninguna comparte archivo con otra y cada una es desplegable sola
- **Phase 7**: depende de las cuatro historias

El orden P1 → P3 es por valor, no por dependencia técnica:

1. **US1** primero: es el caso reportado y el más frecuente
2. **US2**: la otra mitad de P1, la que da sentido al trabajo de 043
3. **US3**: menos frecuente y con techo más bajo (no puede haber menú)
4. **US4**: el más raro y el de menor margen de diseño

### Archivos tocados por más de una historia

Solo uno: `src/app/not-found.tsx` se crea como prueba en T001 (Setup) y se completa en T019 (US3). Es deliberado — la prueba no se descarta, se convierte en el archivo final.

### Parallel Opportunities

- **T003–T010** (US1): las 8 en paralelo, archivos distintos
- **T012–T017** (US2): las 6 en paralelo
- **T021–T022** (US4): las 2 en paralelo
- Las cuatro historias completas, en paralelo entre sí, una vez lista la Phase 2

De 27 tareas, **16 son paralelizables**. Las 11 restantes son T001 y T002 (secuenciales por definición), las cuatro verificaciones de cierre de historia y las cuatro de la fase final.

---

## Parallel Example: User Story 1

```bash
# Los seis not-found de segmento no comparten nada — todos a la vez:
Task: "Crear src/app/crm/not-found.tsx"
Task: "Crear src/app/sales/not-found.tsx"
Task: "Crear src/app/configuracion/not-found.tsx"
Task: "Crear src/app/productos/not-found.tsx"
Task: "Crear src/app/integraciones/not-found.tsx"
Task: "Crear src/app/datos/not-found.tsx"
# y, en paralelo, los dos de acceso denegado:
Task: "Crear src/app/acceso-denegado/layout.tsx"
Task: "Reescribir src/app/acceso-denegado/page.tsx"
```

---

## Implementation Strategy

### MVP (Setup + Foundational + US1)

1. T001 — saber si FR-007 es alcanzable
2. T002 — la anatomía compartida
3. T003–T010 — las ocho pantallas de "no encontrado"
4. T011 — validar
5. **PARAR Y VALIDAR**: abrir `/crm/contactos/noexiste` y ver el menú donde antes había una pantalla negra

Eso solo ya responde el caso que originó la Feature y es desplegable.

### Entrega incremental

Cada historia suma sin romper la anterior. US2 completa el par P1 y es la que vuelve útil el trabajo de 043; US3 y US4 cierran los bordes.

---

## Notes

- **Diecisiete de los dieciocho archivos son nuevos.** El único preexistente que se modifica es `acceso-denegado/page.tsx`. Ninguna página de negocio se toca, así que el riesgo sobre el camino normal es muy bajo — pero T027 lo verifica igual.
- **`dev` queda fuera a propósito**: monta el armazón pero es taller interno, no producto.
- **Los doce envoltorios de segmento deben quedar casi idénticos entre sí.** Si uno necesita apartarse de la forma común, es señal de que falta una prop en `AppErrorScreen`, no de que ese segmento sea especial.
- Commit por historia: el diff de cada fase se lee como una unidad.

---

## Estado de cierre

| | |
|---|---|
| Archivos creados/modificados (T001–T010, T012–T017, T019, T021–T022, T024–T025) | ✅ los 18 |
| `npx tsc --noEmit` sobre `src/app` y `src/shared/ui` | ✅ sin errores |
| `npm run build` | ✅ exit 0 |
| Regresiones estático→dinámico | ✅ ninguna, salvo `/acceso-denegado` (intencional) |
| `npm run test:unit` | ✅ 198 archivos, 2111 tests |
| Test-guardia de 043 | ✅ en verde con los archivos nuevos |
| Revisión de consistencia (T025) | ✅ los 5 puntos del contrato §5 |
| Validación en navegador (T011, T018, T020, T023, T026) | ⚠️ **no ejecutada** |
| `npm run test:e2e` | ⚠️ **no ejecutado** — requiere servidor y DB de prueba |

**Lo que no se validó**: cómo se ven y se comportan las pantallas de verdad. Todo lo verificado es estructural —que compile, que no haya regresiones de render, que los contratos se cumplan a nivel de código—. Que el menú efectivamente aparezca, que el reintento recupere, y que ninguna pantalla quede en blanco, se confirma con `quickstart.md` contra una base real.

**El más importante de esos pendientes es T018** (escenario 2): es el único que distingue un reintento que funciona de uno que miente, y no se puede dar por bueno leyendo el código.

**Desviación aplicada**: FR-007 se cumple por redirección en el borde, no por lectura de sesión en la pantalla. Ver `plan.md` § Desviaciones.
