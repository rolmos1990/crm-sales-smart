---

description: "Task list for 035-inbox-agrupado-contacto"
---

# Tasks: Inbox agrupado por contacto

**Input**: Design documents from `/specs/035-inbox-agrupado-contacto/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/agrupacion.md](./contracts/agrupacion.md),
[quickstart.md](./quickstart.md)

**Tests**: SÍ se incluyen tareas de test. No es opcional acá: el Principio V de la constitución
(NO NEGOCIABLE) exige tests proporcionales al riesgo, y todo el riesgo de esta feature está concentrado en
las tres funciones puras de `agrupacion.ts`. Los componentes `.tsx` no llevan unitarios porque el corredor
del proyecto no puede ejecutarlos (research.md, Decisión 1); se cubren con Playwright y el recorrido manual
del quickstart.

**Organization**: tareas agrupadas por historia de usuario. Cada historia es un incremento entregable por su
cuenta.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ejecutarse en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: a qué historia pertenece (US1, US2, US3)

## Path Conventions

Aplicación web Next.js con módulos por capacidad de negocio. Rutas desde la raíz del repositorio:
`src/conversaciones/` para el dominio, `src/conversaciones/components/` para la UI,
`tests/e2e/conversaciones/` para Playwright.

---

## Phase 1: Setup

**Purpose**: dejar registrada la línea base antes de tocar nada, para poder comparar al final.

- [X] T001 Ejecutar `npm run test:unit` y `npm run build` sobre la rama limpia y anotar el resultado (cantidad de tests y que el build pasa) como línea base de no regresión para T023

---

## Phase 2: Foundational (Bloqueante)

**Purpose**: los tipos, el dato recuperado en el mapeo y el esqueleto del módulo puro. Las tres historias
dependen de esto.

**⚠️ CRÍTICO**: ninguna historia puede empezar hasta terminar esta fase.

- [X] T002 [P] Agregar a `src/conversaciones/types.ts` las interfaces `IdentidadCanalResumen`, `GrupoContacto`, `AvisoOtroCanal` e `IdentidadConAcceso`, y el campo `identificadoresCanal: IdentidadCanalResumen[]` en `ContactoResumen`, con las formas exactas de [data-model.md](./data-model.md)
- [X] T003 En `mapearConversacion` de `src/conversaciones/queries.ts`, poblar `contacto.identificadoresCanal` copiando el arreglo que Prisma ya devuelve — SIN tocar el `select` de `contactoSelect` y CONSERVANDO los campos derivados `identificadorCanal` y `handleCanal` que ya existen (depende de T002)
- [X] T004 [P] Crear `src/conversaciones/agrupacion.ts` con las restricciones del contrato (sin React, sin Prisma, sin `window`, funciones puras) y los helpers compartidos: predicado de "último mensaje del contacto sin leer" y comparador de prioridad. Mover acá la constante `PRIORIDAD` desde `src/conversaciones/components/inbox-layout.tsx` y reimportarla allá, para que el orden sea uno solo y testeable
- [X] T005 Crear `src/conversaciones/agrupacion.test.ts` con un constructor de fixtures de `ConversacionResumen` (contacto, cuenta de canal, último mensaje y estado parametrizables) que usarán los tests de las tres historias (depende de T002, T004)

**Checkpoint**: tipos, dato y módulo listos — las tres historias pueden avanzar en paralelo.

---

## Phase 3: User Story 1 — Ver a quién estoy atendiendo (Priority: P1) 🎯 MVP

**Goal**: la lista del Inbox muestra personas con sus conversaciones adentro, en vez de una fila plana por
conversación.

**Independent Test**: con un contacto que tenga dos o más conversaciones, abrir el Inbox y verificar que
aparece una sola fila de persona con sus conversaciones listadas, que al elegir cualquiera se abre el chat
correcto, y que el estado de colapsado sobrevive al auto-refresco de 30s.

### Tests for User Story 1

> Escribir primero y verificar que fallan antes de implementar.

- [X] T006 [P] [US1] ⚠️ Sin paso "rojo": el módulo se escribió completo en T004 y los tests vinieron después. Se validó su eficacia mutando la implementación a propósito (3 mutaciones → 4 tests en rojo). Tests de `agruparPorContacto` en `src/conversaciones/agrupacion.test.ts`: cobertura total sin grupos vacíos, `esSimple` solo con una conversación, `totalCanales` ignorando conversaciones sin cuenta de canal, `noLeidos` con el mismo predicado de la lista, `requiereAtencionHumana` por `OR` de los hijos, elección de líder por prioridad con desempate por `actualizadoEn`, orden determinista entre grupos y entrada vacía → `[]`

### Implementation for User Story 1

- [X] T007 [US1] Implementar `agruparPorContacto` en `src/conversaciones/agrupacion.ts` según [contracts/agrupacion.md](./contracts/agrupacion.md) — recibe la lista YA filtrada y buscada, nunca filtra por su cuenta (depende de T006)
- [X] T008 [P] [US1] Crear `src/conversaciones/components/grupo-contacto-inbox.tsx`: fila de persona (avatar, nombre, indicador de cantidad de conversaciones, badges agregados, control de expansión) y fila hija por conversación (canal, hora del último mensaje, no leídos, estado). Un grupo con `esSimple` se renderiza como fila simple, sin control de expansión ni indicador de grupo (FR-004). Reutilizar `AvatarContacto`, `infoCanal`, `ESTADO_CFG` y los tokens semánticos existentes — sin inventar estilos nuevos
- [X] T009 [US1] En `src/conversaciones/components/inbox-layout.tsx`: derivar los grupos con `agruparPorContacto(filtradas)` dentro de un `useMemo`, agregar el estado `useState<Set<string>>` de contactos COLAPSADOS (ausencia = expandido) y reemplazar el `.map` plano de la lista por el render de `GrupoContactoInbox`. Conservar intactos el filtrado, la búsqueda, los `conteos` por conversación y el comportamiento de selección (`setSeleccionada` + `setCuentaSeleccionadaId`) (depende de T007, T008)
- [X] T010 [US1] Agregar `data-testid="grupo-contacto"` a la fila de persona y `data-testid="conversacion-item"` a cada conversación hija en `src/conversaciones/components/grupo-contacto-inbox.tsx` (research.md, Decisión 8)

**Checkpoint**: el Inbox agrupa y sigue funcionando igual en todo lo demás — US1 es demostrable sola.

---

## Phase 4: User Story 2 — Enterarme de que el mismo cliente escribió por otro canal (Priority: P2)

**Goal**: el chat avisa cuando esa misma persona tiene algo más nuevo sin leer en otra conversación.

**Independent Test**: con un contacto que tenga dos conversaciones y un mensaje sin leer más reciente en la
segunda, abrir la primera y verificar que aparece el aviso, que el salto abre la otra, y que el descarte lo
oculta sin que vuelva por el mismo mensaje.

### Tests for User Story 2

- [X] T011 [P] [US2] Tests de `elegirAvisoOtroCanal` en `src/conversaciones/agrupacion.test.ts`: ignora conversaciones de otro contacto y la propia, exige último mensaje del contacto sin leer, exige `creadoEn` estrictamente posterior al de la conversación abierta, elige la candidata más reciente cuando hay varias, devuelve `null` si la ganadora está descartada (sin caer a la siguiente), y trata la conversación abierta sin mensajes como "cualquier candidata califica"

### Implementation for User Story 2

- [X] T012 [US2] Implementar `elegirAvisoOtroCanal` en `src/conversaciones/agrupacion.ts` según el contrato, usando SOLO el arreglo de conversaciones recibido — sin ninguna llamada al servidor (FR-015) (depende de T011)
- [X] T013 [P] [US2] Crear `src/conversaciones/components/aviso-otro-canal.tsx`: banner con ícono y nombre del canal, cuándo escribió, acción de salto y acción de descarte. Reutilizar `infoCanal` y el formato de tiempo relativo que ya usa el Inbox
- [X] T014 [US2] En `src/conversaciones/components/inbox-layout.tsx`: agregar el estado `useState<Set<string>>` de ids de mensaje descartados, calcular el aviso con `elegirAvisoOtroCanal` para la conversación abierta y renderizar `AvisoOtroCanal` dentro del área de chat, por encima de los mensajes. El salto reutiliza `setSeleccionada` (depende de T012, T013)

**Checkpoint**: US1 y US2 funcionan, cada una por su cuenta.

---

## Phase 5: User Story 3 — Ver todas las identidades de un cliente (Priority: P3)

**Goal**: el panel derecho lista los canales e identificadores con los que esa persona está registrada.

**Independent Test**: abrir una conversación de un contacto con más de una identidad y verificar que todas
aparecen, que las que tienen conversación cargada se pueden abrir, y que las que no, se muestran sin acción
ni fecha.

### Tests for User Story 3

- [X] T015 [P] [US3] Tests de `resumirIdentidades` en `src/conversaciones/agrupacion.test.ts`: empareja por canal, deja `conversacionId`/`ultimaActividad` en `null` cuando no hay conversación cargada, con varias conversaciones del mismo canal gana la de `actualizadoEn` más reciente, y el orden pone primero las identidades con conversación (por actividad descendente) y después las demás en orden estable

### Implementation for User Story 3

- [X] T016 [US3] Implementar `resumirIdentidades` en `src/conversaciones/agrupacion.ts` según el contrato (depende de T015)
- [X] T017 [P] [US3] Crear `src/conversaciones/components/seccion-identidades-canal.tsx`: encabezado "Identidades / canales vinculados" con el mismo estilo de sección del panel (`text-[9px] font-bold uppercase tracking-widest text-muted-foreground`), una fila por identidad con ícono de canal, identificador o `@handle`, y acción de apertura solo cuando hay conversación cargada. Formatear el identificador de WhatsApp con `formatearIdentificadorWA`, como ya hace el panel
- [X] T018 [US3] Montar `SeccionIdentidadesCanal` en `src/conversaciones/components/panel-contacto-inbox.tsx`, alimentándola con `conversacion.contacto.identificadoresCanal` y las conversaciones del contacto que el Inbox ya tiene cargadas; propagar la apertura hacia `InboxLayout` con el mismo mecanismo de selección que usa la lista (depende de T016, T017)

**Checkpoint**: las tres historias funcionan de forma independiente.

---

## Phase 6: Coherencia del compositor, E2E y validación

**Purpose**: cerrar el requisito de honestidad de la UI (FR-020) y verificar los límites de alcance que el
spec puso por escrito.

- [X] T019 En `src/conversaciones/components/input-mensaje.tsx`, reemplazar `SelectorCuentaCanal` por una etiqueta NO interactiva con el canal y el nombre de la cuenta de la conversación abierta (FR-020). **Conservar el estado `cuentaSeleccionadaId` y la derivación de `instanciaId`** (`input-mensaje.tsx:105-108`): de ahí dependen la consulta de plantillas y la visibilidad del botón "Generar respuesta con IA". Si la conversación no tiene cuenta de canal, mantener el fallback a `cuentas[0]` para `instanciaId` — todas las cuentas comparten instancia (research.md, Decisión 7)
- [X] T020 [P] Extender `tests/e2e/conversaciones/inbox.spec.ts` con el recorrido nuevo: expandir y colapsar un grupo, abrir una conversación desde dentro del grupo, y presencia de la sección de identidades en el panel. Mantener el estilo tolerante de los tests existentes (guardas `if (count > 0)`), ahora apoyados en los `data-testid` reales de T010
- [ ] T021 [P] ⚠️ PENDIENTE (requiere sesión iniciada en la app). Parte verificada por código: el diff contra `origin/main` no agrega ni una llamada a servidor (`fetch(`/`useQuery`/`Action(`/`prisma`). Falta confirmar en DevTools. Verificar el Escenario 4 de [quickstart.md](./quickstart.md): con DevTools → Network, comprobar que expandir grupos y abrir el panel de identidades NO disparan peticiones, y que el ciclo de refresco sigue siendo uno cada 30s (FR-019 / SC-003)
- [ ] T022 ⚠️ PENDIENTE (requiere sesión iniciada en la app). Recorrer la checklist completa del Escenario 5 de [quickstart.md](./quickstart.md) — con atención especial a plantillas y botón de IA (riesgo de T019) y al comportamiento en menos de 768px (FR-022 / SC-005)
- [X] T023 Ejecutar `npm run test:unit` y `npm run build`, y comparar contra la línea base de T001: todos los tests previos siguen pasando y se suman los nuevos de `agrupacion.test.ts`
- [X] T024 [P] Verificar con `git diff --name-only main...HEAD` que el cambio NO toca `prisma/`, `src/worker/`, `src/suscriptores/`, `src/ai/`, `src/workflows/`, `src/integraciones/`, `src/conversaciones/actions.ts` ni `src/conversaciones/envio.ts` (FR-023)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Phase 1. **Bloquea las tres historias.**
- **US1 (Phase 3)**: depende de Phase 2. Sin dependencias sobre otras historias.
- **US2 (Phase 4)**: depende de Phase 2. Es independiente de US1 a nivel de lógica; en el render convive
  con ella en `inbox-layout.tsx`, así que si se hacen en paralelo, T009 y T014 tocan el mismo archivo y hay
  que coordinarlos.
- **US3 (Phase 5)**: depende de Phase 2. Completamente independiente de US1 y US2 (toca otros archivos).
- **Phase 6**: depende de las historias que se vayan a entregar. T019 y T024 se pueden hacer en cualquier
  momento después de Phase 2.

### Within Each User Story

- El test de la función pura va primero y debe fallar antes de implementarla.
- Función pura → componente → integración en el layout/panel.

### Parallel Opportunities

- T002 y T004 en paralelo (archivos distintos).
- Dentro de cada historia: el test (T006 / T011 / T015) y el componente (T008 / T013 / T017) son archivos
  distintos y pueden ir en paralelo con la implementación de la función pura.
- **US3 completa (T015-T018) en paralelo con US1 y US2**: toca `seccion-identidades-canal.tsx` y
  `panel-contacto-inbox.tsx`, que nadie más toca.
- T020, T021 y T024 en paralelo al final.

### Conflictos de archivo a vigilar

| Archivo | Tareas que lo tocan |
|---|---|
| `src/conversaciones/agrupacion.ts` | T004, T007, T012, T016 — secuencial |
| `src/conversaciones/agrupacion.test.ts` | T005, T006, T011, T015 — secuencial |
| `src/conversaciones/components/inbox-layout.tsx` | T004 (mover `PRIORIDAD`), T009, T014 — secuencial |

---

## Parallel Example: Phase 2 + arranque de historias

```bash
# Phase 2, en paralelo:
Task: "T002 Tipos en src/conversaciones/types.ts"
Task: "T004 Crear src/conversaciones/agrupacion.ts con helpers compartidos"

# Con Phase 2 cerrada, tres frentes a la vez:
Task: "T006 Tests de agruparPorContacto"        # US1
Task: "T013 Componente aviso-otro-canal.tsx"    # US2
Task: "T017 Componente seccion-identidades-canal.tsx"  # US3
```

---

## Implementation Strategy

### MVP (solo US1)

1. Phase 1 → Phase 2 → Phase 3.
2. **Parar y validar**: Escenario 1 del quickstart, más la checklist de no regresión (Escenario 5).
3. Con eso ya se puede demostrar: el Inbox muestra personas, no hilos sueltos.

### Entrega incremental

1. Phase 2 → base lista.
2. + US1 → demo (MVP).
3. + US2 → demo: el aviso cruzado, que es el que evita responder dos veces.
4. + US3 → demo: identidades visibles, que es lo que prepara la fusión de contactos de la feature siguiente.
5. Phase 6 cierra el alcance y verifica los límites.

### Nota de expectativa antes de demostrar

El valor visible de US1 depende de la mezcla de canales de la cuenta donde se demuestre: en una cuenta con
un solo canal de mensajería, casi todos los grupos tendrán una sola conversación y la lista se verá parecida
a la de hoy (ver la última *Assumption* del spec). Para la demo conviene usar una cuenta con correo además
de mensajería.

---

## Notes

- `[P]` = archivos distintos, sin dependencias pendientes.
- Commit por tarea o por grupo lógico.
- La regla que no se negocia en toda la feature: **cero consultas nuevas**. Si una tarea parece necesitar
  una, es señal de que se salió del alcance — revisar FR-019 antes de escribirla.
