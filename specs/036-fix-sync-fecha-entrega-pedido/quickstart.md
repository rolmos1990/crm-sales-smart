# Quickstart — validación manual del Hotfix 036

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

Preparación: `npm run dev`, entrar a **Ventas → Pedidos** con un usuario que pueda modificar pedidos, y tener a mano un pedido **con entrega registrada** (tipo envío) en una etapa que permita editarlo.

---

## Escenario 1 — Cambiar la fecha (US1)

1. Abrir el detalle del pedido y anotar la fecha de "Entrega y seguimiento".
2. Abrir **Editar pedido** y cambiar "Fecha de entrega" a otra fecha. Guardar.
3. Recargar el detalle → la sección "Entrega y seguimiento" muestra la **fecha nueva**.
4. Ir al listado → la columna "Entrega estimada" muestra la **misma fecha nueva**.

✅ Las dos pantallas coinciden. (Antes del fix: el listado cambiaba y el detalle se quedaba con la vieja.)

## Escenario 2 — Filtro "Entrega estimada" (US1)

1. Con el pedido del escenario 1, poner su fecha de entrega en **hoy** desde "Editar pedido".
2. En el listado, activar el filtro **Entrega estimada → Hoy**.

✅ El pedido aparece en los resultados y su fecha se ve como "Hoy · <fecha>".

## Escenario 3 — Borrar la fecha (US2)

1. Abrir **Editar pedido** y **vaciar** el campo "Fecha de entrega". Guardar.
2. Listado → la columna "Entrega estimada" muestra `—`.
3. Detalle → "Entrega y seguimiento" **no** muestra fecha estimada.

✅ Ninguna de las dos pantallas muestra fecha. (Antes del fix: el detalle seguía mostrando la fecha borrada.)

## Escenario 4 — Pedido sin entrega (FR-003)

1. Tomar un pedido **sin** entrega registrada (un servicio, una entrega digital, o un envío todavía sin registrar).
2. Abrir **Editar pedido**, ponerle una fecha de entrega y guardar.

✅ La fecha aparece en el listado y el detalle **sigue sin** mostrar un bloque "Entrega y seguimiento" que antes no tenía. El guardado no falla.

## Escenario 5 — Cero regresión (FR-006, obligatorio)

1. En el detalle de un pedido con entrega, abrir **Entrega y seguimiento → Editar**, cambiar la fecha estimada (y de paso el número de guía). Guardar.
   ✅ Listado y detalle muestran la fecha nueva, y la guía se guardó — igual que antes del Hotfix.
2. Abrir **Editar pedido**, cambiar solo una línea o una nota (sin tocar la fecha). Guardar.
   ✅ La fecha de entrega queda igual en ambas pantallas, el transportista, la guía, la dirección y el costo de envío **no** cambian, y el historial del pedido muestra **una** entrada "Pedido editado" con el cambio real.
3. Aprobar una cotización que tenga fecha estimada de entrega.
   ✅ El pedido generado nace mostrando esa fecha en el listado y en el detalle (comportamiento ya corregido en `8b078d1`, no debe alterarse).
