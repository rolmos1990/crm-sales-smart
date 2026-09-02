# Quickstart: Validar la gestión integral de transportistas

## Prerequisitos

- Migración aplicada: `npm run db:migrate` (agrega `ZonaEntrega`/`ZonaEntregaUbicacion`/`ServicioTransportista`/`TarifaTransportistaZona`/`CondicionesTransportista`/`TransportistaHistorial`, extiende `Transportista`/`EntregaCotizacion`/`EntregaPedido`, migra y retira `TransportistaCoberturaGeografica` — ver [data-model.md](data-model.md)).
- Sesión con rol `OWNER` o `ADMIN` (permisos `"transportistas"` y `"transportistas-costos"` en `rw`).

## Escenario 1 — Crear un transportista completo (Historia 1)

1. Ir a `/sales/transportistas` → "+ Nuevo transportista" → completar nombre, tipo (`Courier externo`), estado activo → guardar.
2. **Esperado**: redirige a `/sales/transportistas/[id]`, pestaña Información activa, con 3 servicios ya sembrados (Estándar/Express/Personalizado) disponibles en la pestaña Zonas y tarifas (FR-001, FR-016).
3. Completar persona de contacto, teléfono, correo, notas internas → "Guardar cambios".
4. Ir a Zonas y tarifas → "Agregar zona" → crear "Panamá Centro" con ubicaciones (Bella Vista, San Francisco, Obarrio — mismo país, sin provincia/distrito para que cubra ampliamente, o con distrito si se quiere precisión).
5. Crear una tarifa: zona "Panamá Centro", servicio "Estándar", costo interno $3.50, precio cliente $5.00 → guardar.
6. **Esperado**: margen mostrado $1.50; fila visible en la tabla con estado "Activa" (FR-005, FR-023).
7. Repetir el paso 5 con servicio "Express", costo $5.00, precio $7.00 → verificar que ambas tarifas coexisten sin conflicto (FR-026).
8. Intentar crear una tercera tarifa para la misma zona+servicio "Estándar" → **Esperado**: rechazada por duplicado.

## Escenario 2 — Usar la configuración al crear una cotización (Historia 2)

1. Crear una cotización con un producto físico, indicando destino en Panamá Centro (o una de sus ubicaciones, ej. "Obarrio").
2. **Esperado**: la sección de entrega detecta automáticamente la zona "Panamá Centro" y lista las tarifas activas de transportistas que la cubren, ordenadas de menor a mayor precio (FR-035/036).
3. Elegir una opción distinta a la sugerida → guardar → verificar que la cotización usa la elegida.
4. Cambiar manualmente la zona a una que no corresponde al destino real → **Esperado**: se recalculan las opciones para la nueva zona, y queda registrado en `TransportistaHistorial` que el cambio fue manual (FR-038; verificar con una consulta directa o pantalla de auditoría).
5. Crear otra cotización con un destino que no coincide con ninguna zona configurada → **Esperado**: "Costo de entrega por confirmar", sin bloquear el guardado (FR-039).
6. Intentar convertir esa cotización en pedido sin confirmar el costo → **Esperado**: bloqueado, salvo que `ConfiguracionEmpresa.permiteConvertirSinConfirmarCostoEnvio = true` (FR-040).

## Escenario 3 — Snapshot inmutable al convertir en pedido (Historia 3)

1. Aprobar la cotización del Escenario 1/2 que usa una tarifa concreta → convertir en pedido.
2. **Esperado**: el pedido muestra transportista, zona, servicio, tiempo y precio idénticos a los de la cotización (FR-046).
3. Editar esa tarifa (cambiar el precio) o desactivarla.
4. **Esperado**: el pedido ya creado sigue mostrando los valores originales, sin cambios (FR-047).

## Escenario 4 — Permisos financieros (Historia 5)

1. Con un usuario sin `"transportistas-costos"`, revisar la tabla de tarifas, la cotización y el pedido del Escenario 1-3.
2. **Esperado**: ve el precio al cliente en las tres pantallas, pero no ve costo interno ni margen en ninguna (FR-050).
3. Con un usuario que sí tiene el permiso, repetir → **Esperado**: ve ambos valores.

## Escenario 5 — Consulta de opciones de envío para IA (Historia 7)

1. Con las zonas/tarifas del Escenario 1 configuradas, invocar la tool `consultar_opciones_envio` (ver [contracts/ai-tools.md](contracts/ai-tools.md)) con `provinciaEstado` correspondiente a Panamá Centro.
2. **Esperado**: la respuesta lista ambas tarifas (Estándar y Express) con nombre público, precio, tiempo estimado y modalidad de pago — sin ningún id interno, teléfono, correo o nota interna del transportista (FR-059).
3. Invocar la misma tool para un destino sin cobertura → **Esperado**: `opciones: []` con el mensaje de "por confirmar".

## Escenario 6 — Migración de datos existentes (FR-052/053/054)

1. En un entorno de prueba con filas de `TransportistaCoberturaGeografica` previas a esta feature, aplicar la migración.
2. **Esperado**: por cada fila existente, aparece una `ZonaEntrega` (nombrada según el estado/provincia original) con una `TarifaTransportistaZona` de servicio "Estándar" cuyo costo interno y precio al cliente son iguales al `costoEnvio` original — sin pérdida de cobertura ni de transportistas.
3. Verificar que la pantalla/flujo de cobertura país+provincia de spec 019 ya no está disponible, y que el nuevo tab "Zonas y tarifas" muestra la información migrada.

## Validación técnica de respaldo

- `npm run test:unit` — cubre cálculo de margen, detección de tarifas con pérdida, unicidad de tarifas, resolución de zona por destino, exclusión de inactivas/vencidas, snapshot en generación de pedido, y acceso a costo interno según permiso (ver tasks.md para el detalle por historia).
- `npm run test:e2e:transportistas` (o el spec que corresponda en `tests/e2e/`) — flujo de creación, configuración de zonas/tarifas, y uso en una cotización real.
