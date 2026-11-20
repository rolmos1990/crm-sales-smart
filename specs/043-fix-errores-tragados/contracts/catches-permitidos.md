# Contrato: qué bloque puede atrapar un fallo de lectura en `src/app/**/page.tsx`

**Feature**: 043-fix-errores-tragados

Este es el contrato que hace cumplir el test-guardia (decisión D5 de `research.md`). No es documentación descriptiva: es la lista cerrada contra la que el test compara, y la lista de verificación de la implementación.

**Invariante**: una página solo puede atrapar un error de lectura si el contenido principal de esa página ya está resuelto y lo que falló es accesorio. En cualquier otro caso, el error se propaga.

**Dos formas sintácticas**, y el test debe vigilar ambas: `try { … } catch` alrededor de la lectura, y `.catch(() => …)` encadenado a la promesa dentro de un `Promise.all`. El inventario original se construyó buscando solo la primera y por eso se le escaparon 5 bloques; el test no puede repetir ese error.

---

## Lista blanca — los 4 bloques permitidos

Cualquier bloque de cualquiera de las dos formas en `src/app/**/page.tsx` que no esté en esta tabla hace fallar el test.

| # | Archivo | Qué atrapa | Por qué se permite |
|---|---|---|---|
| 1 | `src/app/crm/oportunidades/[id]/page.tsx` | conversaciones de la oportunidad | La oportunidad ya está cargada; las conversaciones son un panel accesorio |
| 2 | `src/app/sales/cotizaciones/nueva/page.tsx` | prefill desde la oportunidad de origen | Prefill opcional; sin él, el formulario sigue siendo correcto y usable |
| 3 | `src/app/crm/oportunidades/[id]/page.tsx` | formateo de una fecha de campo personalizado | No es lectura de datos: es parseo de un valor ya leído. Fuera del alcance del hotfix |
| 4 | `src/app/sales/pedidos/[id]/page.tsx` | formateo de una fecha de campo personalizado | Ídem |

Los dos primeros deben cumplir además FR-007 (aviso visible) y FR-008 (registro del error). Los dos últimos quedan exactamente como están.

> **Las dos entradas de `crm/page.tsx` salieron de esta lista durante la implementación.** Sus `try/catch` eran código muerto: `return prisma…findMany(…)` **sin `await`** deja la promesa rechazada fuera del `try`, así que esas dos funciones ya propagaban. Conservarlos habría exigido agregarles `await` —introduciendo un tragado que no existía— así que se eliminaron. Cambio de comportamiento: ninguno. Ver `plan.md` § Desviaciones.

**Las líneas se omiten a propósito**: se moverán al editar los archivos. El test debe identificar cada entrada por archivo y por una marca estable en el código, no por número de línea.

---

## Inventario completo con veredicto

Los 42 bloques, en el estado de `main` al 2026-11-19. Es la lista de verificación cerrada de la implementación: el recuento final debe dar exactamente 36 / 4 / 2 (SC-005).

### Historia 1 (P1) — Formularios que guardarían datos equivocados · 13 bloques

| Archivo | Línea | Veredicto |
|---|---|---|
| `src/app/crm/contactos/nuevo/page.tsx` | 34 | ELIMINAR |
| `src/app/crm/contactos/[id]/editar/page.tsx` | 39 | ELIMINAR (también 404 falso) |
| `src/app/crm/oportunidades/nueva/page.tsx` | 47 | ELIMINAR |
| `src/app/crm/oportunidades/[id]/editar/page.tsx` | 35 | ELIMINAR (también 404 falso) |
| `src/app/crm/actividades/nueva/page.tsx` | 41 | ELIMINAR |
| `src/app/sales/cotizaciones/nueva/page.tsx` | 43 | ELIMINAR |
| `src/app/sales/cotizaciones/[id]/editar/page.tsx` | 41 | ELIMINAR (también 404 falso, sin guard) |
| `src/app/sales/pedidos/nuevo/page.tsx` | 37 | ELIMINAR |
| `src/app/productos/[id]/editar/page.tsx` | 19, 20 | ELIMINAR (forma `.catch`) |
| `src/app/productos/nuevo/page.tsx` | 17, 18 | ELIMINAR (forma `.catch`) |

**Cuidado**: en `productos/nuevo/page.tsx:16`, `obtenerMonedaPrincipal` ya propaga (no lleva `.catch`). No agregarle uno «por consistencia»: la consistencia correcta es que las otras dos tampoco lo lleven.

**Cuidado**: `sales/cotizaciones/nueva/page.tsx` tiene **dos** `catch` (43 y 77). Se elimina solo el de la línea 43. El de la 77 es la entrada 2 de la lista blanca.

### Historia 2 (P1) — Registros que existen reportados como inexistentes · 7 bloques

| Archivo | Línea | Veredicto |
|---|---|---|
| `src/app/crm/contactos/[id]/page.tsx` | 47 | ELIMINAR + quitar guard `placeholder` |
| `src/app/crm/empresas/[id]/page.tsx` | 33 | ELIMINAR + quitar guard `placeholder` |
| `src/app/crm/empresas/[id]/editar/page.tsx` | 21 | ELIMINAR + quitar guard `placeholder` |
| `src/app/crm/oportunidades/[id]/page.tsx` | 53 | ELIMINAR + quitar guard `placeholder` |
| `src/app/sales/cotizaciones/[id]/page.tsx` | 45 | ELIMINAR + quitar guard `placeholder` |
| `src/app/sales/pedidos/[id]/page.tsx` | 80 | ELIMINAR + quitar guard `placeholder` |
| `src/app/productos/[id]/editar/page.tsx` | 18 | ELIMINAR (forma `.catch`) + quitar guard `placeholder` |

Los otros 2 guards `placeholder` están en los archivos de edición de la Historia 1 (`contactos/[id]/editar`, `oportunidades/[id]/editar`); `cotizaciones/[id]/editar` no lo tiene. **Total de guards a eliminar: 9, en 9 archivos.**

**Cuidado**: `crm/oportunidades/[id]/page.tsx` tiene **tres** `catch` (53, 76, 98). Se elimina solo el de la 53. Los otros dos son las entradas 1 y 5 de la lista blanca.

**Cuidado**: `sales/pedidos/[id]/page.tsx` tiene **dos** `catch` (49 y 80). Se elimina solo el de la 80. El de la 49 es la entrada 6 de la lista blanca.

**Regla al quitar el guard**: el `notFound()` se conserva, pero su condición pasa a ser únicamente `if (!registro)`. Eso preserva el 404 legítimo (FR-009) y elimina el falso, porque tras quitar el `try/catch` un error ya no puede dejar la variable en `null`.

### Historia 3 (P2) — Números falsos · 2 bloques

| Archivo | Línea | Veredicto |
|---|---|---|
| `src/app/crm/page.tsx` | 78 | ELIMINAR (devuelve los KPIs en cero) |
| `src/app/sales/pedidos/page.tsx` | 43 | ELIMINAR (revierte 038 en silencio) |

**Cuidado**: `crm/page.tsx` tiene **tres** `catch` (78, 105, 126). Se elimina solo el de la 78. Los otros dos son las entradas 3 y 4 de la lista blanca.

**Cuidado**: `sales/pedidos/page.tsx` tiene **dos** `catch` (43 y 73). Ambos se eliminan, pero pertenecen a historias distintas: el 43 a esta, el 73 a la Historia 4.

**Nota sobre 038**: al eliminar el bloque de la línea 43, `construirCondicionVenta` deja de recibir `[]` por un fallo. Su fallback legacy para instancias sin flujo dinámico **no se toca** (FR-009). El cambio es que `[]` vuelve a significar solo una cosa — "esta instancia no tiene flujo dinámico" — en vez de dos.

### Historia 4 (P3) — Listas vacías creíbles · 15 bloques

| Archivo | Línea | Veredicto |
|---|---|---|
| `src/app/crm/contactos/page.tsx` | 31 | ELIMINAR |
| `src/app/crm/empresas/page.tsx` | 20 | ELIMINAR |
| `src/app/crm/actividades/page.tsx` | 20 | ELIMINAR |
| `src/app/crm/etiquetas/page.tsx` | 15 | ELIMINAR |
| `src/app/crm/inbox/page.tsx` | 25 | ELIMINAR |
| `src/app/crm/oportunidades/page.tsx` | 70 | ELIMINAR |
| `src/app/crm/pipeline/page.tsx` | 86 | ELIMINAR |
| `src/app/sales/cotizaciones/page.tsx` | 26 | ELIMINAR |
| `src/app/sales/pedidos/page.tsx` | 73 | ELIMINAR |
| `src/app/productos/page.tsx` | 27 | ELIMINAR |
| `src/app/datos/page.tsx` | 23 | ELIMINAR |
| `src/app/integraciones/page.tsx` | 17 | ELIMINAR |
| `src/app/integraciones/instagram/page.tsx` | 89 | ELIMINAR |
| `src/app/integraciones/facebook-messenger/page.tsx` | 45 | ELIMINAR |
| `src/app/integraciones/whatsapp-lite/page.tsx` | 45 | ELIMINAR |

**Regla**: al eliminar, los estados vacíos legítimos se conservan intactos. Una condición como `if (!inicial || inicial.indicadores.total === 0)` pasa a ser `if (inicial.indicadores.total === 0)`: tras quitar el `try/catch`, la variable ya no puede ser nula por un fallo, así que la rama `!inicial` deja de tener sentido y mantenerla volvería a confundir fallo con vacío.

### Conservados · 4 bloques

| Archivo | Línea | Veredicto |
|---|---|---|
| `src/app/crm/oportunidades/[id]/page.tsx` | 76 | CONSERVAR + aviso (FR-007) + registro (FR-008) |
| `src/app/sales/cotizaciones/nueva/page.tsx` | 77 | CONSERVAR + aviso + registro |
| `src/app/crm/page.tsx` | 105 | CONSERVAR + aviso + registro |
| `src/app/crm/page.tsx` | 126 | CONSERVAR + aviso + registro |

### Fuera de alcance · 2 bloques

| Archivo | Línea | Veredicto |
|---|---|---|
| `src/app/crm/oportunidades/[id]/page.tsx` | 98 | NO TOCAR |
| `src/app/sales/pedidos/[id]/page.tsx` | 49 | NO TOCAR |

---

## Recuento de control (SC-005)

| | Bloques |
|---|---|
| Eliminados | 13 + 7 + 2 + 15 = **36** (31 `try/catch` + 5 `.catch`) |
| Conservados con aviso y registro | **4** |
| Intactos (fuera de alcance) | **2** |
| **Total** | **42** |

Guards `DATABASE_URL.includes("placeholder")` eliminados: **9**, en 9 archivos.

Los 13 y 7 de arriba suman 20, pero `productos/[id]/editar` aporta bloques a ambas historias (el `.catch` de la línea 18 es el que produce el 404 falso, los de 19 y 20 son los del formulario). Archivos tocados: 32.

Archivos con más de un bloque, donde el riesgo de borrar el equivocado es mayor: `crm/page.tsx` (3, se conservan 2), `crm/oportunidades/[id]/page.tsx` (3, se conservan 2), `productos/[id]/editar/page.tsx` (3, se eliminan los 3), `sales/cotizaciones/nueva/page.tsx` (2, se conserva 1), `sales/pedidos/[id]/page.tsx` (2, se conserva 1), `sales/pedidos/page.tsx` (2, se eliminan los 2), `productos/nuevo/page.tsx` (2, se eliminan los 2).
