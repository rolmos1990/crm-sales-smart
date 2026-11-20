# Contrato: la familia de pantallas de error

**Feature**: 044-pantallas-de-error

Dos contratos. El primero es la anatomía única que exige FR-009; el segundo, dónde va cada pantalla y qué puede prometer cada una.

---

## 1. `AppErrorScreen` — la anatomía compartida

**Ubicación**: `src/shared/ui/app-error-screen.tsx`
**Tipo**: Server Component (sin `'use client'` — ver `research.md` D3)

### Entradas

| Prop | Tipo | Obligatoria | Para qué |
|---|---|---|---|
| `titulo` | `string` | sí | Qué pasó, en lenguaje de negocio |
| `descripcion` | `string` | no | Qué puede hacer el usuario |
| `Icono` | `LucideIcon` | no | Por defecto, uno de alerta |
| `accion` | `ReactNode` | no | Salida principal |
| `accionSecundaria` | `ReactNode` | no | Salida alternativa |
| `codigoSoporte` | `string` | no | `error.digest`; se omite si no hay |

### Reglas

1. **Nunca recibe un objeto de error.** Recibe texto ya resuelto. Así es imposible que una traza llegue a la pantalla por descuido (FR-005), y el componente no necesita saber de dónde vino el fallo.
2. **Las acciones entran como nodos, no como handlers.** El componente no conoce `onClick`; quien necesita interactividad la construye en su propio Client Component y la pasa armada (D3).
3. **El código de soporte se muestra discreto y seleccionable**, con una etiqueta que diga para qué sirve. Si llega vacío o no es texto, la sección no se renderiza.
4. **Reutiliza la anatomía de `EmptyState`**: contenedor centrado, ícono en caja redondeada, título, descripción, zona de acciones. No se inventa un tratamiento visual nuevo; esta familia y los estados vacíos deben verse hermanas.
5. **No hace consultas ni lee sesión.** Es presentación pura; quien la monta resuelve el contexto.

### Lo que NO va en este componente

- `'use client'` — rompería D3
- Lecturas de base de datos
- Texto fijo en español cableado adentro: cada pantalla aporta el suyo, porque "no encontramos este contacto" y "no se pudo cargar el listado" no son el mismo mensaje

---

## 2. Matriz de ubicación

Qué archivo captura qué, y qué puede prometer. Las tres filas sin menú son límites del enrutado, no decisiones (`research.md` D6).

| # | Archivo | Captura | Menú | Acciones | Historia |
|---|---|---|---|---|---|
| 1 | `app/crm/not-found.tsx` | `notFound()` en cualquier ruta de CRM | ✅ | Volver al listado · Ir al inicio | US1 |
| 2 | `app/sales/not-found.tsx` | ídem en Ventas | ✅ | ídem | US1 |
| 3 | `app/configuracion/not-found.tsx` | ídem en Configuración | ✅ | ídem | US1 |
| 4 | `app/productos/not-found.tsx` | ídem en Productos | ✅ | ídem | US1 |
| 5 | `app/integraciones/not-found.tsx` | ídem en Integraciones | ✅ | ídem | US1 |
| 6 | `app/datos/not-found.tsx` | ídem en Datos | ✅ | ídem | US1 |
| 7 | `app/acceso-denegado/layout.tsx` | — (monta el armazón) | ✅ | — | US1 |
| 8 | `app/crm/error.tsx` | error de render en CRM | ✅ | **Reintentar** · Ir al inicio | US2 |
| 9 | `app/sales/error.tsx` | ídem en Ventas | ✅ | ídem | US2 |
| 10 | `app/configuracion/error.tsx` | ídem en Configuración | ✅ | ídem | US2 |
| 11 | `app/productos/error.tsx` | ídem en Productos | ✅ | ídem | US2 |
| 12 | `app/integraciones/error.tsx` | ídem en Integraciones | ✅ | ídem | US2 |
| 13 | `app/datos/error.tsx` | ídem en Datos | ✅ | ídem | US2 |
| 14 | `app/not-found.tsx` | URL sin coincidencia | ❌ | Ir al inicio **o** Iniciar sesión | US3 |
| 15 | `app/error.tsx` | fallo de `LayoutAppServidor` | ❌ | Reintentar · Iniciar sesión | US4 |
| 16 | `app/global-error.tsx` | fallo del layout raíz | ❌ | Reintentar | US4 |

Más `src/shared/ui/app-error-screen.tsx` y la reescritura de `app/acceso-denegado/page.tsx`: **18 archivos**.

**`dev` queda fuera a propósito**: monta el armazón pero es un taller interno, no producto. Si alguna vez se vuelve producto, suma sus dos archivos.

---

## 3. Contrato de los `error.tsx`

Los 6 de segmento más `app/error.tsx` comparten forma.

```
'use client'

props: { error: Error & { digest?: string }, reset: () => void }
```

**Reglas no negociables**:

1. **El botón de reintento hace `router.refresh()` y después `reset()`**, en ese orden. Solo `reset()` no vuelve a consultar al servidor, y como todas las páginas de Karia leen del lado del servidor, el botón parecería roto (`research.md` D2). **Este es el punto que más fácil se implementa mal.**
2. **`error` se estrecha antes de leerlo.** Puede no ser un `Error`; se usa `instanceof Error` antes de tocar `digest`.
3. **El mensaje visible nunca sale del error.** Es texto escrito a mano por pantalla. Lo único que viaja del error a la UI es `digest`.
4. **Se registra el error con `console.error`** y un prefijo que identifique la pantalla, dentro de un `useEffect`.
5. **Siempre hay una salida que no es el reintento.** Si la causa persiste, un botón que siempre falla deja al usuario encerrado.

## 4. Contrato de los `not-found.tsx`

```
Server Component, sin props
```

1. **No reciben props**: el framework no les pasa nada. El contexto sale de dónde está el archivo.
2. **Solo enlaces, nunca botones con handler** — se envían con todas las rutas de su segmento (D3).
3. **El de la raíz (#14) decide el destino según haya sesión o no** (FR-007). Es el único que lee contexto, y por eso deja de prerenderizarse (D4).

## 5. Qué hace fallar la revisión

- Una pantalla que muestra `error.message` o cualquier texto del error
- Un `error.tsx` cuyo reintento no llama a `router.refresh()`
- Una pantalla de error sin salida alternativa al reintento
- Un `'use client'` en `AppErrorScreen`
- Una pantalla que prometa menú en las filas 14, 15 o 16
- Texto distinto para el mismo concepto entre dos pantallas hermanas
