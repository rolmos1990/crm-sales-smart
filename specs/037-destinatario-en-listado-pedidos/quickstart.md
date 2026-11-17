# Quickstart — validación manual de la feature 037

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

Preparación: `npm run dev` → **Ventas → Pedidos**.

## Escenario 1 — Pedido con destinatario (US1)

1. Abrir un pedido con envío, ir a "Entrega y seguimiento" → Editar, cargar "Recibe" con un nombre y guardar.
2. Volver al listado.

✅ En la columna "Cliente", bajo el nombre, aparece el chip `Recibe: <nombre>`.

## Escenario 2 — Pedido sin destinatario (FR-003)

1. Mirar cualquier pedido sin dato de "Recibe" (la mayoría hoy).

✅ La celda se ve exactamente como antes: cliente y nada más. Sin etiqueta vacía, sin espacio reservado, sin cambio de alto de fila.

## Escenario 3 — Destinatario largo (US2)

1. En un pedido de prueba, cargar como "Recibe" un texto largo (p. ej. `Julio Ortiz  6394-4040  8-947-2275  Chitré`).
2. Volver al listado.

✅ El chip se corta con puntos suspensivos, la columna "Cliente" conserva su ancho y la tabla no scrollea horizontalmente. Al pasar el cursor por encima se ve el valor completo.

## Escenario 4 — Cero regresión (FR-005)

1. Ordenar por "Número" y por "Entrega estimada"; aplicar un filtro de estado y el de "Entrega estimada → Hoy"; buscar por número y por nombre de cliente.
   ✅ Todo responde igual que antes.
2. Exportar a CSV desde el menú de acciones.
   ✅ El archivo mantiene las columnas de siempre.
3. Abrir el detalle de un pedido con destinatario.
   ✅ "Entrega y seguimiento" sigue mostrando "Recibe" como siempre.

## Escenario 5 — Modo claro y oscuro

1. Alternar el tema con el control de la barra lateral.

✅ El chip se lee en ambos temas (usa tokens semánticos, igual que el chip de preparación de la misma tabla).
