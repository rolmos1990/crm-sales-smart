# Research: Las páginas dejan de esconder los fallos de lectura

**Feature**: 043-fix-errores-tragados | **Fecha**: 2026-11-19

El Diagnóstico previo del spec ya resolvió la causa raíz y el inventario. Este documento cubre las decisiones técnicas que quedaban abiertas para ejecutar el fix sin romper nada.

---

## D1 — ¿Quitar el `catch` rompe `next build`?

**Decisión**: No. Verificado empíricamente, no por razonamiento.

**Rationale**: Era el riesgo que podía invalidar el hotfix entero. Si alguna página afectada se prerenderizara en build, propagar la excepción rompería `npm run build` en cualquier entorno de CI sin base de datos accesible.

Dos verificaciones independientes:

1. **Por código**: `obtenerSesionActual()` (`src/shared/auth/sesion.ts:32`) llama primero a `obtenerAuthProvider().obtenerUsuarioActual()`, que entra a `src/shared/auth/provider/supabase-server.ts:8` → `await cookies()`. Esa llamada ocurre **antes** del `prisma.usuario.findUnique` de `sesion.ts:34`. En el App Router, leer cookies saca la ruta a render dinámico, así que toda página que use `requireSesion()` abandona la prerenderización antes de tocar Prisma.

2. **Por build real** (`npm run build`, exit 0 sobre `main` al día de hoy): 83 rutas, **73 dinámicas (ƒ) y 10 estáticas (○)**. Las 10 estáticas son `/`, `/_not-found`, `/acceso-denegado`, `/auth/configurar-cuenta`, `/auth/magiclink`, `/auth/reset-password`, `/icon.svg`, `/privacy-policy`, `/registro`, `/terms-of-service` — todas públicas o de autenticación, ninguna usa `requireSesion()`. **Ninguna de las 32 páginas afectadas aparece como estática.**

**Corolario que importa**: esto confirma por otra vía que el comentario `// DB no configurada` nunca describió un escenario real. Si el build hubiera dependido de esos `catch`, estas páginas serían estáticas. No lo son.

**Alternativas consideradas**: añadir `export const dynamic = "force-dynamic"` a las páginas que no lo declaran, como red de seguridad. Rechazada: ya son dinámicas de hecho, y agregar la directiva sugeriría que el fix la necesita cuando no es así.

---

## D2 — Forma del cambio: ¿quitar el bloque o relanzar desde él?

**Decisión**: Eliminar el `try/catch` completo y, con él, la variable `let` con valor inicial. El patrón queda:

```
antes:   let x = [];  try { x = await leer(); } catch { /* … */ }
después: const x = await leer();
```

**Rationale**: El `let x = []` **es la mitad del defecto**. Es exactamente lo que permite que la página siga renderizando con un valor inventado. Si se conserva la variable y solo se relanza (`catch (e) { throw e }`), queda en pie la forma que invita a volver a tragar el error la próxima vez que alguien toque el archivo — y el comentario `// DB no configurada` ya demostró que esa invitación se acepta 26 veces.

Quitar ambos deja un código en el que volver al comportamiento viejo requiere escribir estructura nueva, no borrar una línea.

**Alternativas consideradas**:
- *Helper `cargarOPropagar(fn, vacio)`*: rechazada. Añade indirección para expresar "no atrapar", que ya se expresa no escribiendo nada. También reintroduce un punto único donde alguien podría volver a meter tolerancia para las 32 páginas de un plumazo.
- *Relanzar desde el `catch` tras logear*: rechazada para los 36 eliminados; el registro del error es responsabilidad del límite de error (Feature posterior), no de cada página. Sí se aplica a los 4 que se conservan (ver D4).

---

## D3 — El aviso de FR-007 para los bloques que se conservan

**Decisión**: Reutilizar `EmptyState` (`src/shared/ui/empty-state.tsx`) pasándole un ícono de alerta y texto de fallo. No crear un primitivo nuevo.

**Rationale**: `EmptyState` ya acepta `Icono`, `titulo`, `descripcion` y `accion`, y ya resuelve el tratamiento visual en modo claro y oscuro. Cumple la assumption del spec ("puede expresarse con los componentes ya existentes") y la regla de `design-systems` en `CLAUDE.md`: inspeccionar `src/components/ui/` y `src/shared/ui/` antes de crear nada.

**Alternativas consideradas**: crear `ErrorState` o adelantar `AppErrorScreen`. Rechazadas por FR-010: ese diseño pertenece a la Feature posterior y adelantarlo acá obligaría a fijar su forma sin el contexto del resto del sistema de errores, con el costo probable de rehacerlo.

---

## D4 — Registro de los 4 bloques conservados (FR-008)

**Decisión**: `console.error("[NombreDePagina] <qué falló>:", err)`, replicando el formato que el código más reciente del proyecto ya usa.

**Rationale**: El Hallazgo 8 del diagnóstico mostró que el código nuevo (`crm/contactos/page.tsx:31`, `crm/oportunidades/page.tsx:70`, `sales/pedidos/page.tsx:43` y `:73`, los tres de integraciones) ya escribe `catch (err) { console.error("[XPage] …", err) }`. Adoptar ese formato en los 4 que quedan es consistencia con lo que el equipo ya eligió, no una decisión nueva.

**Alternativas consideradas**: introducir un logger estructurado con ruta, operación e `instanciaId`. Rechazada explícitamente por FR-010 — es parte de la Feature posterior. Adelantarlo acá significaría diseñar el esquema de logs para 4 llamadas y luego rediseñarlo para las ~140 restantes.

**Restricción heredada**: el Principio V de la constitución prohíbe datos personales en logs. Se registra el error y el nombre de la operación; nunca el contenido del registro leído.

---

## D5 — Cómo se evita la regresión en una edición de 36 sitios

**Decisión**: Añadir un test-guardia en Vitest que recorra `src/app/**/page.tsx` y falle si aparece cualquier bloque que atrape un fallo de lectura y no esté en una lista blanca de los 6 permitidos (4 conservados + 2 fuera de alcance).

**Debe detectar las dos formas sintácticas**: `try { … } catch` y `.catch(() => …)` encadenado a la promesa. Esto no es exhaustividad defensiva: el inventario original de este mismo hotfix se armó buscando solo `catch {` y se le escaparon 5 bloques reales, incluido el de `productos/[id]/editar/page.tsx:18`, que produce un 404 falso igual que los otros nueve. Si el test repite el sesgo del barrido que lo originó, no protege de nada.

**Rationale**: Es el riesgo operativo real del hotfix. Treinta y seis ediciones mecánicas es precisamente donde se cuela el descuido en ambas direcciones: borrar de más (tocar los 4 legítimos o los 2 de formateo de fecha) o borrar de menos (olvidar uno y dejarlo mintiendo). Y nada impediría que dentro de seis meses alguien agregue una página nueva con el mismo `catch {}` y el mismo comentario.

El proyecto ya tiene **precedente directo** para esta clase de test: `src/worker/grafo-importaciones.test.ts` recorre el grafo de importación del worker y falla si algo no resuelve. Su comentario de cabecera explica que existe por un incidente real que ni los tests ni el build detectaron, y que recorrer el código a mano era la única forma de verlo antes de desplegar. Este caso es idéntico en forma: una invariante estructural que ningún test funcional puede observar.

Esto convierte SC-005 de "contable sobre el diff" a verificable en CI de forma permanente.

**Alternativas consideradas**:
- *Solo revisión del diff*: rechazada. Verifica una vez y no protege del futuro.
- *Regla de ESLint*: rechazada. Expresar "este `catch` sí, aquel no, según qué renderiza la página después" en una regla de lint cuesta mucho más que leer archivos con `readFileSync`, y el proyecto no tiene reglas personalizadas donde apoyarse.

---

## D6 — Cómo se reproduce un fallo para validar

**Decisión**: El quickstart documenta **dos** procedimientos distintos, porque reproducen cosas distintas y confundirlos invalidaría la prueba.

1. **Base caída** (`DATABASE_URL` a un puerto cerrado): reproduce el fallo total. **No sirve para validar este hotfix**: la excepción sale en `requireSesion()`, antes de los `catch` que se están quitando. Se documenta precisamente para que nadie lo use creyendo que prueba el fix.
2. **Fallo parcial** (edición temporal de una query concreta para que lance): es el único procedimiento que ejercita el camino corregido, porque es el fallo que estos `catch` realmente atrapaban.

**Rationale**: Es la consecuencia directa del Hallazgo 1. Un validador que use solo el método 1 vería la pantalla de error y daría el fix por bueno sin haber tocado ni una línea del código modificado.

**Alternativas consideradas**: inyección de fallos automatizada en Playwright. Rechazada por alcance: forzar un error de Prisma desde el navegador requiere infraestructura de pruebas que no existe en el proyecto (un modo de fallo inyectable en la capa de datos). El test-guardia de D5 cubre la regresión estructural, que es el riesgo real; el comportamiento ante fallo se valida a mano con el quickstart.

---

## D7 — Orden de ejecución

**Decisión**: Por historia de usuario, P1 → P3, y el test-guardia de D5 al final.

**Rationale**: Cada historia es un conjunto cerrado de archivos y es desplegable sola. El test-guardia va último porque su lista blanca solo es estable cuando ya se sabe qué quedó: escribirlo antes obligaría a editarlo cuatro veces.

Dentro de ese orden, P1-US1 (los 7 formularios) va primero porque es el único grupo que **persiste** datos equivocados; el resto solo los muestra.

---

## Resumen de decisiones

| # | Decisión | Impacto |
|---|---|---|
| D1 | Quitar los `catch` es seguro para el build — verificado con build real | Desbloquea el hotfix |
| D2 | Eliminar `try/catch` **y** el `let` con valor inicial | Evita que el defecto vuelva |
| D3 | Reutilizar `EmptyState` para el aviso de FR-007 | Sin primitivos nuevos |
| D4 | `console.error` con prefijo, como ya hace el código nuevo | Sin logger nuevo (FR-010) |
| D5 | Test-guardia en Vitest, lista blanca de 6, **ambas formas sintácticas** | Hace SC-005 verificable en CI |
| D6 | Dos procedimientos de fallo; solo el parcial valida el fix | Evita una validación falsa |
| D7 | P1 → P3, guardia al final | Cada historia desplegable sola |
