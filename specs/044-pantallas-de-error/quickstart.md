# Quickstart: validar las pantallas de error

**Feature**: 044-pantallas-de-error

Seis escenarios. El 1 es el que motivó la Feature y el 5 es el de mayor riesgo técnico — conviene hacerlo temprano, porque si falla cambia el alcance de una historia.

## Prerrequisitos

- `npm run dev` corriendo, con base de datos accesible
- Una sesión iniciada en un navegador y **otra ventana sin sesión** (modo incógnito) para los escenarios 3 y 4
- Un contacto real cuyo identificador puedas copiar

---

## Escenario 1 — Un 404 dentro de la app conserva el menú (US1)

**Objetivo**: el caso que originó esta Feature.

Con sesión iniciada, abrir cada una de estas URLs cambiando el identificador por uno inventado:

| URL | Esperado |
|---|---|
| `/crm/contactos/noexiste` | Menú lateral visible, mensaje de "no encontramos este contacto", botón para volver al listado |
| `/crm/empresas/noexiste` | Ídem, adaptado a Empresas |
| `/crm/oportunidades/noexiste` | Ídem |
| `/sales/pedidos/noexiste` | Ídem |
| `/sales/cotizaciones/noexiste` | Ídem |
| `/productos/noexiste/editar` | Ídem |

**Falla si**: desaparece el menú, el fondo queda negro, o no hay forma de volver sin usar el botón "atrás" del navegador.

**Comparar con el antes**: esa misma URL hoy devuelve la pantalla por defecto del framework, sin menú y sin marca. Ese es el punto de partida.

---

## Escenario 2 — El reintento vuelve a consultar de verdad (US2)

**Objetivo**: comprobar que "Reintentar" no es decorativo. Es el escenario que más fácil pasa por bueno estando roto.

1. Forzar el fallo de una consulta con una edición temporal. Por ejemplo, al principio de `obtenerContactos` en `src/crm/contactos/queries.ts`:
   ```ts
   throw new Error("fallo simulado 044");
   ```
2. Abrir `/crm/contactos` → debe verse el menú, un mensaje comprensible, un botón "Reintentar" y una salida alternativa.
3. **Sin recargar la página**, quitar la línea del paso 1 y guardar.
4. Pulsar "Reintentar".

**Esperado**: el listado carga con sus datos reales, sin recargar la aplicación entera y sin volver a iniciar sesión.

**Falla si**: al pulsar "Reintentar" vuelve a aparecer la misma pantalla de error aunque la causa ya no exista. Eso significa que el botón hace `reset()` sin `router.refresh()`, y el reintento no está volviendo a consultar al servidor (ver `research.md` D2).

> Este paso es la diferencia entre un botón que funciona y uno que miente. No se puede validar leyendo el código: hay que ejecutarlo.

---

## Escenario 3 — URL inexistente, con sesión (US3)

Con sesión iniciada, abrir `/una-direccion-inventada`.

**Esperado**: pantalla con la identidad de Karia, mensaje claro, y un enlace que lleva **al inicio de la aplicación**. Sin menú — es el límite aceptado.

**Falla si**: se ve la pantalla negra por defecto, o el enlace lleva al inicio de sesión teniendo sesión activa.

---

## Escenario 4 — URL inexistente, sin sesión (US3)

En una ventana de incógnito, abrir `/una-direccion-inventada`.

**Esperado**: la misma pantalla, pero el enlace lleva **al inicio de sesión**.

**Falla si**: el enlace lleva a una pantalla de la aplicación que rebota a login, o el destino es el mismo que en el escenario 3.

---

## Escenario 5 — El 404 raíz puede leer la sesión (riesgo técnico)

**Objetivo**: confirmar que la decisión D4 se sostiene. **Hacerlo temprano**: si falla, hay que degradar FR-007 y conviene saberlo antes de escribir las doce pantallas de segmento.

```bash
npm run build
```

Buscar `/_not-found` en la salida:

- **Esperado**: aparece como `ƒ (Dynamic)`. Antes de esta Feature era `○ (Static)`; el cambio confirma que la pantalla está leyendo contexto de la petición.
- **Si sigue como `○ (Static)`**: la sesión no se está leyendo y los escenarios 3 y 4 darán el mismo resultado. Salida prevista: dejar un enlace fijo a `/` y que el middleware resuelva el destino, anotando la degradación de FR-007 en el plan.
- **Si el build falla** señalando el uso de una API dinámica en esa ruta: misma salida que el punto anterior. No pelearse con el framework.

---

## Escenario 6 — Los últimos recursos (US4)

**6a. Fallo del armazón.** Forzar un `throw` al principio de `obtenerSesionActual` (`src/shared/auth/sesion.ts`) y abrir cualquier página autenticada.

**Esperado**: pantalla controlada, con mensaje y acción. **Sin menú** — es correcto: lo que falló es justamente lo que lo construye.

**6b. Fallo del layout raíz.** Forzar un `throw` en `src/app/layout.tsx`.

**Esperado**: pantalla mínima, legible, con una acción. Se verá distinta del resto y eso está previsto: no recibe los estilos globales ni el tema (`research.md` D7).

**Falla si**: en cualquiera de los dos casos aparece una pantalla en blanco.

---

## Comprobaciones transversales

Sobre cualquiera de las pantallas anteriores:

- [ ] **Ningún texto técnico.** Nada de nombres de tabla, rutas de archivo, trazas ni el texto crudo de la excepción (FR-005, SC-005).
- [ ] **Código de soporte visible** y seleccionable, con una etiqueta que explique para qué sirve (FR-004).
- [ ] **Ese código aparece también en los registros del servidor.** Buscarlo en la consola de `npm run dev`: debe coincidir.
- [ ] **Modo claro y oscuro**, alternando el tema de la aplicación. Excepción conocida: la pantalla de último recurso de 6b, que solo debe ser legible.
- [ ] **A 360 px de ancho** no hay desbordes ni texto cortado.
- [ ] **Siempre hay una salida** además del reintento.

---

## Cero regresión

```bash
npm run build          # exit 0
npm run test:unit      # toda la suite en verde
npm run test:e2e       # toda la suite en verde
```

Y a mano, con la aplicación sana:

| Recorrido | Esperado |
|---|---|
| Abrir un contacto que **sí** existe | Carga normal, sin pantalla de error |
| Listado de contactos de una instancia sin contactos | Estado vacío "Sin contactos todavía" — **no** debe confundirse con una pantalla de error |
| Un rol sin permiso entrando a un módulo | Mensaje de acceso denegado, ahora **con** menú |
| Navegación general por los seis módulos | Sin cambios |

**Falla si**: algún estado vacío legítimo se convirtió en pantalla de error, o alguna página que funcionaba dejó de cargar.

> La distinción entre "no hay datos" y "algo falló" es lo que 043 acaba de arreglar. Esta Feature no puede volver a borrarla.

---

## Lista de verificación final

- [ ] Escenario 1: los 6 módulos dan 404 con menú
- [ ] Escenario 2: el reintento recupera de verdad
- [ ] Escenarios 3 y 4: el destino del enlace cambia según haya sesión
- [ ] Escenario 5: `/_not-found` quedó dinámico (o se documentó la degradación)
- [ ] Escenario 6: ningún caso da pantalla en blanco
- [ ] Comprobaciones transversales, en las 16 pantallas
- [ ] Cero regresión completo
