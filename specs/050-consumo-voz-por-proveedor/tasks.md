---

description: "Task list — 050 consumo de voz por proveedor"
---

# Tasks: Consumo de voz por proveedor

**Input**: Design documents from `specs/050-consumo-voz-por-proveedor/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/consumo-voz.md](./contracts/consumo-voz.md)

**Tests**: SÍ se incluyen. `plan.md` § Technical Context los pide explícitamente, y la
Constitución (principio V) exige tests proporcionales al riesgo. Acá el riesgo es aritmético: el
reparto de redondeo y la derivación del total son lo único que puede fallar en silencio.

**Organization**: por historia de usuario, en orden de prioridad. US1 es el MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (archivo distinto, sin dependencias pendientes)
- **[Story]**: US1 / US2 / US3 — solo en las fases de historia

## Path Conventions

Web app Next.js, monorepo único. Todo cuelga de `src/` en la raíz del repo. Sin `backend/` ni
`frontend/` separados.

---

## Phase 1: Setup

**Purpose**: punto de partida y línea base para poder probar que no hubo regresión.

- [X] T001 Crear la rama `feature/050-consumo-voz-por-proveedor` desde `main` @ `b0949f7`
- [X] T002 Confirmar que `npx prisma migrate status` no reporta nada pendiente y que `prisma/schema.prisma` NO necesita cambios — esta feature no lleva migración (FR-011); si `migrate dev` propone algo, hay un cambio de esquema que no debería estar
- [X] T003 Anotar la línea base de regresión: abrir Configuración → Voz en una cuenta con consumo y registrar los dos valores exactos que muestran las `TarjetaMetrica` de `src/configuracion/components/tab-voz.tsx` (minutos del mes, costo del mes, y el texto de detalle). Son el patrón contra el que se valida FR-003 al final

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: la capa de lectura. Las tres historias se apoyan en esto.

**⚠️ CRITICAL**: ninguna historia puede empezar hasta que esta fase cierre.

- [X] T004 Implementar `repartirRedondeo(valores: number[], decimales: number): number[]` en `src/configuracion/voz/reparto.ts`, por resto mayor, con desempate por índice menor (determinista) y sin desplazar resto a entradas en cero. Documentar en el encabezado POR QUÉ existe: sin ella las filas no suman el total (ver `contracts/consumo-voz.md` § 1)
  > **Desviación del contrato**: la firma lleva un tercer parámetro opcional `objetivo`. Derivar el objetivo de `suma(valores)` deja a merced del punto flotante los casos sobre un límite de redondeo, y con minutos salidos de segundos enteros esos límites caen uno cada 3 segundos. El llamador pasa el total calculado con la MISMA expresión que la tarjeta, lo que ata FR-003 y FR-004 al mismo número. Contrato actualizado.
- [X] T005 [P] Escribir `src/configuracion/voz/reparto.test.ts` con el invariante `suma(repartirRedondeo(v, d)) === redondear(suma(v), d)`, más los casos borde del contrato: `[12.34, 12.34, 12.34]` a 1 decimal ⇒ suma `37.0`; arreglo vacío; un solo valor; `[0,0,0]`; un valor con el resto en cero (el ajuste NO debe caer en una fila sin consumo). Este test no se borra
- [X] T006 [P] Definir en `src/configuracion/voz/queries.ts` los tipos `ConsumoVoz` (`minutos`, `costo`, `costoCobertura`, `transcripciones`), `ConsumoProveedor` (`proveedorVozId`, `consumo`) y extender `ResumenUsoVoz` con `mesPorProveedor`, según `data-model.md` § Formas de datos en memoria. Sin quitar ni renombrar nada de la forma actual
- [X] T007 Reemplazar el `aggregate` del mes por `usoVoz.groupBy({ by: ["proveedorVozId"] })` en `src/configuracion/voz/queries.ts`, con el MISMO `where` (`instanciaId`, `exito: true`, `creadoEn: { gte, lt }` de `rangoEsteMes` + `obtenerZonaNegocio`) y `_sum: { segundos, costoEstimado }`, `_count: { _all: true, costoEstimado: true }`. Dejar el `aggregate` de "hoy" intacto salvo sumarle `costoEstimado` al `_count` para que comparta la forma `ConsumoVoz` (depende de T006)
- [X] T008 Derivar en `src/configuracion/voz/queries.ts` el total del mes sumando los grupos —nunca una consulta aparte (Decisión 1)—, acumulando el costo con `Prisma.Decimal.add` y convirtiendo a `Number` una sola vez al final; derivar `costoCobertura` comparando `_count.costoEstimado` con `_count._all` (Decisión 3); y aplicar `repartirRedondeo` UNA sola vez, al final, sobre los valores exactos (depende de T004, T007)
- [X] T009 Escribir `src/configuracion/voz/queries.test.ts` con Prisma mockeado —mismo patrón que `src/voz/limites.test.ts`— cubriendo: el `where` del `groupBy` lleva los tres filtros y el rango es semiabierto (`gte`/`lt`, nunca `lte`); `mes` coincide con la suma de los grupos; `_count.costoEstimado` entre 1 y `_all - 1` ⇒ `PARCIAL`; `_count.costoEstimado: 0` ⇒ `costo: null`, **nunca** `0`; cuenta sin ninguna fila ⇒ totales en cero y `mesPorProveedor` vacío, sin excepción (depende de T008)

**Checkpoint**: la consulta devuelve el desglose y el total derivado. Nada visible todavía.

---

## Phase 3: User Story 1 — Ver cuánto consumió cada proveedor este mes (Priority: P1) 🎯 MVP

**Goal**: cada fila de proveedor muestra sus minutos y costo del mes en curso, sin ninguna
interacción (FR-001, FR-002).

**Independent Test**: cuenta con dos proveedores configurados y consumo de ambos en el mes
(**sin proveedores eliminados** — ese caso es US2). Abrir Configuración → Voz y verificar que
cada fila muestra lo suyo y que la suma de las filas da la tarjeta de total.

### Tests for User Story 1

- [X] T010 [P] [US1] Escribir `src/configuracion/voz/fusion.test.ts` cubriendo: proveedor configurado sin grupo de consumo ⇒ `ConsumoVoz` en cero con `transcripciones: 0`; orden de `proveedores` preservado con activos e inactivos mezclados; proveedor inactivo con consumo ⇒ su consumo sigue presente (US1 escenario 5). Debe fallar antes de T011

### Implementation for User Story 1

- [X] T011 [US1] Implementar `fusionarConsumoProveedores(proveedores, mesPorProveedor)` en `src/configuracion/voz/fusion.ts` según `contracts/consumo-voz.md` § 2, devolviendo `{ conConsumo, eliminados }`. En esta historia `eliminados` puede quedar sin usar; la extracción del grupo huérfano se completa en US2 (T015)
  > **Implementado completo, incluido `eliminados`.** La tarea preveía dejarlo sin usar hasta US2, pero la extracción del huérfano son 4 líneas en la misma función: separarla habría sido andamiaje falso y un segundo toque al mismo archivo. Lo que sí respeta el corte de historia es la UI — US1 no renderiza esa entrada. Cubre también T016.
- [X] T012 [US1] Exportar el tipo `ProveedorVozConConsumo` (`ProveedorVozListado & { consumoMes: ConsumoVoz }`) desde `src/configuracion/voz/queries.ts` o `fusion.ts`, verificando que sigue SIN exponer `apiKeyEncriptada` (FR-012) — `ProveedorVozListado` ya la excluye por construcción y ese `select` explícito no se toca
- [X] T013 [US1] En `src/configuracion/components/tab-voz.tsx`, llamar a `fusionarConsumoProveedores` con el resultado del `Promise.all` que ya existe y pasar `proveedores` enriquecidos por props a `ListaProveedoresVoz`. **Sin `'use client'`, sin `useState`, sin carga diferida** (FR-013). No tocar las dos `TarjetaMetrica` (depends on T011, T012)
- [X] T014 [US1] En `src/configuracion/components/lista-proveedores-voz.tsx`, cambiar el tipo de la prop a `ProveedorVozConConsumo[]` y agregar UNA línea de texto bajo la que ya existe (`{proveedor} · {modelo} · prioridad {n}`): `"{minutos} min este mes · {costo}"` con consumo, `"Sin consumo este mes"` sin consumo (FR-007). Con `costo: null` mostrar solo los minutos — el texto de "sin tarifa" llega en US3. Usar tokens semánticos (`text-muted-foreground`), sin hex ni valores arbitrarios (depends on T013)
  > **Implementado junto con T018 y T021**: los tres editan el mismo archivo y partirlo en tres pasadas era churn puro. Desviación de texto: dice `· costo no estimado`, no `· sin tarifa cargada` — la línea inmediatamente superior de la fila YA imprime `· sin tarifa cargada` cuando `costoPorHora` es null, y repetirlo dejaba la fila diciendo lo mismo dos veces. Contrato actualizado.

**Checkpoint**: US1 funcional. Escenarios 1, 2 y 5 del quickstart pasan en una cuenta sin
proveedores eliminados.

> **Limitación conocida al desplegar US1 sola**: en una cuenta que SÍ eliminó un proveedor con
> consumo, la suma de las filas queda por debajo de la tarjeta de total — los minutos huérfanos
> no se muestran en ningún lado. Es exactamente el agujero que US2 cierra, y por eso US2 es P2 y
> no P3.

---

## Phase 4: User Story 2 — Que las cifras cuadren aunque se haya borrado un proveedor (Priority: P2)

**Goal**: el consumo cuyo proveedor ya no existe se muestra agrupado, de modo que la suma de las
filas sea exactamente la tarjeta de total (FR-004, FR-005).

**Independent Test**: registrar consumo de un proveedor, eliminarlo desde la UI, recargar y
verificar que aparece una entrada "Proveedor eliminado" con esos minutos y que la suma cuadra.

### Tests for User Story 2

- [X] T015 [P] [US2] Ampliar `src/configuracion/voz/fusion.test.ts` con: grupo `proveedorVozId: null` ⇒ sale por `eliminados`; sin grupo huérfano ⇒ `eliminados` es `null`; **dos** proveedores eliminados distintos ⇒ UNA sola entrada con la suma (Decisión 4); lista de proveedores vacía con consumo huérfano ⇒ solo `eliminados`; grupo con un id que no está en `proveedores` ⇒ se acumula en `eliminados` y **no se descarta** (preservar FR-004 pesa más que la prolijidad de la atribución)
  > **Escrito junto con T010**, en una sola pasada sobre `fusion.test.ts`. Escribirlo después de T011 habría roto el orden TDD para US2; así los 12 casos fallaron antes de existir `fusion.ts`.

### Implementation for User Story 2

- [X] T016 [US2] Completar la extracción del grupo huérfano en `src/configuracion/voz/fusion.ts`: sumar todos los grupos sin proveedor configurado en un único `ConsumoVoz` y devolverlo en `eliminados`, o `null` si no hay ninguno (depends on T015)
- [X] T017 [US2] En `src/configuracion/components/tab-voz.tsx`, pasar `eliminados` por props a `ListaProveedoresVoz` (depends on T016)
- [X] T018 [US2] En `src/configuracion/components/lista-proveedores-voz.tsx`, renderizar la entrada "Proveedor eliminado" al final de la lista cuando `eliminados` no sea `null`: mismo tratamiento visual que una fila, **sin botones de acción** (no hay nada que accionar) y sin `Badge` de activo/inactivo. No renderizar nada cuando sea `null` (depends on T017)
- [X] T019 [US2] Verificar `repartirRedondeo` en `src/configuracion/voz/queries.ts`: la entrada de eliminados participa del reparto como una más, de modo que Σ(filas + eliminados) == tarjeta de total. Si quedó fuera, las cifras no cuadran justo en el caso que esta historia existe para arreglar (depends on T018)

**Checkpoint**: escenarios 2 y 4 del quickstart pasan, incluso tras eliminar dos proveedores.

---

## Phase 5: User Story 3 — Distinguir "no gastó nada" de "falta cargar la tarifa" (Priority: P3)

**Goal**: un proveedor sin tarifa dice que le falta la tarifa, en vez de mostrar un cero que se
lee como "sale gratis" (FR-006).

**Independent Test**: configurar un proveedor sin costo por hora, generar consumo con él y
verificar que la fila muestra los minutos y un aviso de tarifa faltante, no un `0`.

**Nota**: la lógica de datos (`costoCobertura` con sus tres estados) ya quedó en T008 porque es
parte del contrato compartido. Esta fase es la presentación de esos estados.

### Tests for User Story 3

- [X] T020 [P] [US3] Ampliar `src/configuracion/voz/queries.test.ts` con el caso completo de FR-006: grupo con `_sum.costoEstimado: null` y `_count._all > 0` ⇒ `costo: null` y `costoCobertura: "NO_ESTIMABLE"`, distinguible del grupo sin consumo (`transcripciones: 0`). Afirmar explícitamente que `costo` **no** es `0`

### Implementation for User Story 3

- [X] T021 [US3] En `src/configuracion/components/lista-proveedores-voz.tsx`, renderizar los cuatro estados de la tabla de `contracts/consumo-voz.md` § 4: costo completo ⇒ `"12.3 min este mes · 2.61"`; parcial ⇒ `"… · 2.61 (parte del mes sin tarifa)"`; no estimable con consumo ⇒ `"… · sin tarifa cargada"`; sin consumo ⇒ `"Sin consumo este mes"`. Mantener el formato de monto sin símbolo de moneda, igual que la tarjeta de total y la tarifa por hora de la fila (depends on T014)
- [X] T022 [US3] Verificar que la tarjeta "Costo estimado del mes" de `src/configuracion/components/tab-voz.tsx` sigue sumando SOLO lo estimable, con el mismo criterio de hoy, y que el desglose es el único lugar donde se ve la parte no estimada (US3 escenario 3, FR-003)

**Checkpoint**: las tres historias funcionan. Escenario 3 del quickstart pasa en sus dos mitades
(sin tarifa, y después de cargarla).

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T023 Verificar FR-003 en `src/configuracion/components/tab-voz.tsx` contra la línea base de T003: con el mismo dato, las dos `TarjetaMetrica` muestran números y textos **idénticos** a los anotados. Cualquier diferencia es una regresión, no un redondeo nuevo
- [X] T024 Correr `EXPLAIN ANALYZE` del `groupBy` de `src/configuracion/voz/queries.ts` contra una cuenta con volumen real y confirmar `Index Scan` sobre `[instanciaId, creadoEn]` (Decisión 6). Si aparece `Seq Scan`, revisar el plan ANTES de agregar ningún índice
  > **Resultado**: `Index Scan using "UsoVoz_instanciaId_creadoEn_idx"`, 3,4 ms, sin `Seq Scan`. **Salvedad**: la base tiene 11 filas de `UsoVoz` en total, una sola cuenta. El plan confirma que el índice se usa, no que el comportamiento se sostenga a escala.
- [X] T025 [P] Actualizar `docs/proveedores-de-voz.md` con una sección sobre el desglose por proveedor: que el dato sale de `UsoVoz.proveedorVozId` sin esquema nuevo, que el total se deriva del `groupBy` a propósito, que `onDelete: SetNull` es el único origen del grupo huérfano, y la trampa de `_sum` ignorando NULL
- [X] T026 [P] Verificar que `src/voz/limites.ts` sigue intacto y que el tope diario de minutos corta como antes: es la otra lectura de `UsoVoz` y conviene confirmar que nadie la arrastró en la refactorización
- [X] T027 Correr `npm run test:unit` completo y `npm run build`. La Constitución (principio V) no da por completo un cambio que no compile o que rompa tests
- [ ] T028 ⚠️ **PARCIAL — requiere navegador y cuenta real** Ejecutar [quickstart.md](./quickstart.md) de punta a punta, incluidas las verificaciones que no se ven en pantalla: zona horaria, aislamiento entre cuentas, ausencia de `apiKey` en el HTML servido y en el payload RSC, y tiempo de respuesta sin diferencia perceptible (SC-005)
  > **Verificado sin navegador**: aislamiento por `instanciaId` y rango semiabierto (tests de `queries.test.ts`); ausencia de credenciales (`ProveedorVozListado` las excluye por construcción + test dedicado en `fusion.test.ts`); zona de negocio (ambos rangos salen de `obtenerZonaNegocio`); rendimiento (`EXPLAIN ANALYZE` de T024).
  > **Pendiente del usuario**: los cinco escenarios en pantalla (desglose visible, suma a mano contra las tarjetas, proveedor sin tarifa, eliminar un proveedor, proveedor sin consumo).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: depende de Setup — **BLOQUEA las tres historias**
- **US1 (Phase 3)**: depende de Phase 2
- **US2 (Phase 4)**: depende de Phase 2; en la práctica se construye sobre `fusion.ts` de US1 (T011), así que conviene hacerla después
- **US3 (Phase 5)**: depende de Phase 2 y de la línea de texto de US1 (T014)
- **Polish (Phase 6)**: depende de las historias que se decidan entregar

### User Story Dependencies

Las tres comparten `fusion.ts` y `lista-proveedores-voz.tsx`, así que **no conviene
paralelizarlas entre desarrolladores**: el conflicto de merge cuesta más que el tiempo ahorrado.
Son increméntales en el sentido que importa —cada una se puede desplegar y validar sola—, no
en el de poder trabajarse en simultáneo.

### Within Each User Story

- Los tests marcados [P] se escriben primero y deben fallar antes de implementar
- Datos antes que presentación: `queries.ts` → `fusion.ts` → `tab-voz.tsx` → `lista-proveedores-voz.tsx`

### Parallel Opportunities

- **T005 y T006**: archivos distintos (`reparto.test.ts` / `queries.ts`), ambos dependen solo de T004
- **T010, T015, T020**: tests de archivos distintos, cada uno antes de su implementación
- **T025 y T026**: documentación y verificación, independientes entre sí

Fuera de eso el camino es mayormente secuencial, y es lo esperable: la feature son ~250 líneas
sobre cuatro archivos que se tocan en cadena.

---

## Parallel Example: Phase 2

```bash
# Después de T004 (reparto.ts), estos dos van en paralelo:
Task: "Escribir src/configuracion/voz/reparto.test.ts con el invariante de suma"
Task: "Definir ConsumoVoz / ConsumoProveedor / ResumenUsoVoz en src/configuracion/voz/queries.ts"
```

---

## Implementation Strategy

### MVP (US1 sola)

1. Phase 1 → Phase 2 → Phase 3
2. **PARAR y VALIDAR**: escenarios 1, 2 y 5 del quickstart, en una cuenta sin proveedores eliminados
3. Desplegable, con la limitación conocida anotada al final de Phase 3

### Entrega incremental

1. Setup + Foundational → la consulta devuelve el desglose
2. **+ US1** → cada proveedor muestra su consumo (MVP)
3. **+ US2** → las cifras cuadran en toda cuenta, incluidas las que eliminaron proveedores
4. **+ US3** → la tarifa faltante deja de ser invisible
5. Polish → docs, `EXPLAIN ANALYZE`, build y quickstart completo

La recomendación es llegar al menos hasta US2 antes de desplegar: US1 sola puede mostrar cifras
que no suman en cuentas que eliminaron un proveedor, y una pantalla de costos que no cuadra se
lee como rota aunque el total sea correcto.

---

## Notes

- `[P]` = archivo distinto, sin dependencias pendientes
- **Cero migraciones**: si en algún momento `prisma migrate` propone un cambio, algo se desvió del plan (FR-011)
- **Cero dependencias nuevas**
- El invariante de `reparto.test.ts` (T005) y el caso "nunca un cero" (T020) son los dos tests que no se borran: fallan en silencio si se quitan
- Commit por tarea o por grupo lógico
