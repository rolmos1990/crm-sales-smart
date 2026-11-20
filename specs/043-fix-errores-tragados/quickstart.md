# Quickstart: validar que las páginas dejaron de esconder los fallos

**Feature**: 043-fix-errores-tragados

Cinco escenarios. El 1 es el de cero regresión y es el que más importa: un hotfix que arregla lo roto y rompe lo que andaba no sirve. El 2 es el único que ejercita de verdad el código modificado.

## Prerrequisitos

- PostgreSQL accesible y `DATABASE_URL` apuntando a él
- `npm run db:seed` corrido, con al menos un contacto, un pedido y una cotización
- Una instancia **con** flujo de venta dinámico y al menos una etapa marcada `cuentaComoVenta` (necesaria para el escenario 4)

---

## Escenario 1 — Cero regresión (obligatorio)

**Objetivo**: con la base sana, Karia se comporta exactamente igual que antes del cambio.

```bash
npm run build          # debe terminar en exit 0
npm run test:unit      # toda la suite en verde
npm run test:e2e       # toda la suite en verde
```

Y a mano, con `npm run dev`:

| Recorrido | Resultado esperado (idéntico a antes) |
|---|---|
| Listado de contactos con datos | Se ven todos los contactos |
| Listado de contactos de una instancia **sin** contactos | Estado vacío "Sin contactos todavía" con su botón — **debe seguir apareciendo** |
| Detalle de un contacto que existe | Carga normal |
| Detalle con un id inventado en la URL | **404 de siempre** — este comportamiento no cambia |
| "Nuevo pedido" | Moneda y prefijo telefónico correctos según la configuración |
| Dashboard | KPIs con los valores reales |
| Listado de pedidos, instancia **con** flujo dinámico | "Total ventas" cuenta por `cuentaComoVenta` |
| Listado de pedidos, instancia **sin** flujo dinámico | "Total ventas" cuenta por enum `estado` (fallback legacy) — **debe seguir funcionando** |
| Inbox, Productos, Oportunidades, Empresas, Pipeline, Etiquetas, Integraciones | Todo carga igual que antes |

**Falla si**: desaparece algún estado vacío legítimo, el 404 por id inexistente deja de salir, o el fallback legacy de ventas cambia de resultado.

---

## Escenario 2 — Fallo parcial: el único que valida este fix

**Objetivo**: comprobar que una lectura fallida ya no produce una pantalla que miente.

> **Leé esto antes de empezar.** La forma intuitiva de simular un fallo —apagar la base o apuntar `DATABASE_URL` a un puerto cerrado— **no valida este hotfix**. Con la base caída, la excepción sale en `requireSesion()`, muy por encima de los `catch` que se quitaron, y verías una pantalla de error sin que se haya ejecutado una sola línea del código modificado. Ese caso es el escenario 5, y está documentado precisamente para que nadie lo confunda con este.

**Procedimiento**: con la base sana, forzar el fallo de **una** query concreta mediante una edición temporal. Por ejemplo, al principio de `obtenerContactoPorId` en `src/crm/contactos/queries.ts`:

```ts
throw new Error("fallo simulado 043");
```

Con `npm run dev` corriendo, y revirtiendo la edición entre cada caso:

| Query que se fuerza a fallar | Página a visitar | Esperado | Lo que **no** debe pasar |
|---|---|---|---|
| `obtenerContactoPorId` | detalle de un contacto que existe | Pantalla de error | Un 404 "no existe" |
| `obtenerContactos` / `cargarVistaContactos` | listado de contactos | Pantalla de error | "Sin contactos todavía" + "Crear primer contacto" |
| `obtenerConfiguracionEmpresa` | "Nuevo pedido" | Pantalla de error | Un formulario abierto con moneda o país por defecto |
| `obtenerFlujoVenta` | listado de pedidos | Pantalla de error | Un "Total ventas" calculado con la regla legacy |
| los KPIs del dashboard | `/crm` | Pantalla de error | Tarjetas en `$0` / `0` |
| `obtenerCuentasIG` | integración de Instagram | Pantalla de error | La cuenta conectada mostrada como desconectada |
| `obtenerProductosParaComponentes` | editar un producto combo | Pantalla de error | El combo renderizado **sin sus componentes**, listo para guardarse vaciado |

Hasta que exista la Feature posterior, "pantalla de error" significa la pantalla por defecto del framework. Es fea; lo que se valida acá es que sea **honesta**.

**Falla si**: cualquier fila produce la pantalla de la cuarta columna.

---

## Escenario 3 — Los bloques conservados degradan con aviso

**Objetivo**: verificar que lo accesorio sigue degradando, pero sin fingir que está vacío (FR-007, FR-008).

Forzar el fallo, uno por vez:

| Query | Página | Esperado |
|---|---|---|
| conversaciones de la oportunidad | detalle de una oportunidad | La oportunidad carga completa; el panel de conversaciones muestra un aviso de "no se pudo cargar" |
| los KPIs del dashboard | `/crm` | La página falla entera — los KPIs son contenido principal, no accesorio |
| oportunidad de origen de una cotización | "Nueva cotización" desde una oportunidad | El formulario abre usable, sin el prefill |

En los dos, revisar la consola del servidor: debe haber un `console.error` identificando página y operación. **No debe aparecer ningún dato personal del registro leído** (Principio V de la constitución).

**Falla si**: la página entera falla, o la sección se renderiza vacía sin aviso, o no queda registro en consola.

---

## Escenario 4 — 038 sigue intacto

**Objetivo**: confirmar que el fix no alteró la derivación de "cuenta como venta" (FR-009).

1. Instancia **con** flujo dinámico y una etapa marcada `cuentaComoVenta` → "Total ventas" cuenta esos pedidos.
2. Desmarcar la etapa en Configuración y recargar → el total pasa a 0 en el siguiente render, sin recálculo ni migración.
3. Volver a marcarla → el total vuelve.
4. Instancia **sin** flujo dinámico → el total se calcula por enum `estado`, igual que antes.

**Falla si**: el paso 2 no da 0, o el paso 4 cambia de resultado respecto de antes del hotfix.

> El paso 2 es el test de regresión que `CLAUDE.md` regla 10 pide no borrar nunca. Si da un número en vez de 0, la condición volvió a sumar todos los pedidos.

---

## Escenario 5 — Base caída (contexto, no validación)

**Objetivo**: documentar qué pasa y por qué **no** sirve para validar este hotfix.

Con `DATABASE_URL` apuntando a un puerto cerrado, cualquier página autenticada falla en `requireSesion()` → `obtenerSesionActual` → `prisma.usuario.findUnique` (`src/shared/auth/sesion.ts:34`), por encima de todo el código tocado acá.

**Esperado**: pantalla de error. **Antes del hotfix pasaba exactamente lo mismo**, así que este escenario no distingue el código viejo del nuevo.

Se documenta para que nadie lo use como prueba del fix y lo dé por validado sin haberlo ejercitado.

---

## Verificación estructural

```bash
npm run test:unit
```

El test-guardia (D5 de `research.md`) recorre `src/app/**/page.tsx` y falla si aparece cualquier bloque —`try/catch` o `.catch(...)`— fuera de la lista blanca de 6 de [`contracts/catches-permitidos.md`](./contracts/catches-permitidos.md).

Recuento de control manual sobre el diff (SC-005): **38 eliminados, 2 conservados, 2 intactos = 42**, más **9** guards `DATABASE_URL.includes("placeholder")` eliminados.

---

## Lista de verificación final

- [ ] Escenario 1 completo, sin regresiones
- [ ] Escenario 2: las 7 filas dan pantalla honesta
- [ ] Escenario 3: las 2 degradan con aviso y dejan registro sin datos personales
- [ ] Escenario 4: los 4 pasos de 038 se comportan igual que antes
- [ ] Test-guardia en verde
- [ ] Recuento 38 / 2 / 2 y 9 guards confirmado sobre el diff
- [ ] `npm run build` en exit 0
