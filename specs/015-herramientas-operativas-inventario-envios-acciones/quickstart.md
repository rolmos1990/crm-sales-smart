# Quickstart: Validación de herramientas operativas y modo de confirmación

## Prerrequisitos

- Migraciones aplicadas.
- Un producto con stock limitado, uno sin stock, uno de tipo SERVICIO (sin stock).
- Al menos un `MetodoEntregaConfig` y una `ZonaCobertura` configurados; una zona sin cobertura para un método.

## Escenario 1 — Inventario y precio reales (Historia 1)

1. Invocar `consultar_disponibilidad` sobre el producto con stock limitado → **verificar**: `disponible: true`, cantidad exacta.
2. Invocar sobre el producto sin stock → **verificar**: `disponible: false`.
3. Invocar sobre el producto SERVICIO → **verificar**: `disponible: true`, `cantidadDisponible: null`.
4. Invocar `consultar_precio_actual` → **verificar**: coincide con `Producto.precio` vigente.
5. Invocar `consultar_promociones` → **verificar**: siempre "sin promociones configuradas".

## Escenario 2 — Envíos y cobertura reales (Historia 2)

1. Invocar `obtener_metodos_entrega` → **verificar**: lista los configurados.
2. Invocar `calcular_costo_envio` para la zona cubierta → **verificar**: refleja `costoBase + costoAdicional`.
3. Invocar `calcular_costo_envio` para la zona sin cobertura → **verificar**: `cubierto: false`.
4. Invocar `estimar_fecha_entrega` → **verificar**: refleja el rango configurado + días adicionales de zona si aplica.
5. Sin ninguna configuración (instancia de prueba nueva), invocar cualquiera de estas tools → **verificar**: mensaje de "sin configuración", sin error ni datos inventados.

## Escenario 3 — Modo de confirmación desactivado (default, Historia 3, SC-003)

1. Con `accionesComercialesModoBorrador: false` (default, sin tocar nada), invocar `crear_cotizacion` vía el agente.
2. **Verificar**: se comporta exactamente igual que antes de esta spec — `generadoPorIA: false`, `confirmadoPorHumano: true`, visible de inmediato en la lista de Cotizaciones sin ninguna marca especial.

## Escenario 4 — Modo de confirmación activado

1. Activar `accionesComercialesModoBorrador: true` para un agente de prueba.
2. Invocar `crear_cotizacion` vía ese agente.
3. **Verificar**: `generadoPorIA: true`, `confirmadoPorHumano: false`, visible en la UI con una marca clara de "generado por IA · pendiente de confirmación".
4. Un humano confirma el documento (`confirmarDocumentoIA`).
5. **Verificar**: `confirmadoPorHumano: true`, `confirmadoPorUsuarioId` registrado, la marca de pendiente desaparece.
6. Desactivar el modo de confirmación para ese agente.
7. **Verificar**: los documentos ya pendientes de confirmación (si los hubiera) siguen pendientes — no se confirman retroactivamente.

## Escenario 5 — Agregar productos a oportunidad y transferencia a humano (Historia 3)

1. Invocar `agregar_productos_oportunidad` con productos válidos → **verificar**: quedan asociados, con las mismas validaciones que si un humano los agregara desde la UI.
2. Invocar `transferir_a_humano` (ya existente) → **verificar**: sigue funcionando exactamente igual que antes de esta spec.

## Escenario 6 — Aislamiento multi-tenant y errores controlados (Edge Cases)

1. Invocar cualquier tool nueva con un `productoId`/`metodoEntrega`/`zona` de otra instancia → **verificar**: rechazado, sin datos de esa instancia expuestos.
2. Simular un fallo de base de datos en una tool → **verificar**: error controlado devuelto, sin detalles internos expuestos, sin interrumpir el resto de la conversación.
