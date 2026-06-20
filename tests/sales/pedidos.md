# Pruebas — Pedidos

Rol mínimo para modificar: **AGENTE_VENTAS** / **EJECUTIVO_VENTAS**
Rol mínimo para ver: **INVITADO**

---

## Listado

### P-01 Ver lista de pedidos
- [ ] Ir a `/sales/pedidos`
- **Esperado**: tabla con número, cliente, total, etapa del flujo, estado de entrega, fecha

### P-02 Filtrar por etapa del flujo
- [ ] Seleccionar una etapa del flujo de venta
- **Esperado**: lista filtrada a pedidos en esa etapa

### P-03 Búsqueda por número o cliente
- [ ] Buscar por número de pedido o nombre del cliente
- **Esperado**: lista filtrada

---

## Creación

### P-04 Crear pedido mínimo
- [ ] Clic en "Nuevo pedido"
- [ ] Seleccionar contacto o ingresar datos del cliente
- [ ] Agregar al menos un ítem
- [ ] Guardar
- **Esperado**: pedido creado con número correlativo, en la primera etapa del flujo

### P-05 Agregar ítems al pedido
- [ ] Buscar y agregar productos del catálogo
- [ ] Modificar cantidades y descuentos
- **Esperado**: subtotales y total actualizados en tiempo real

### P-06 Crear pedido desde una cotización
- [ ] Convertir una cotización aceptada en pedido (ver CQ-12)
- **Esperado**: pedido con ítems y datos del cliente ya cargados

---

## Edición de pedido

### P-07 Editar datos del cliente
- [ ] Modificar nombre, teléfono, email, RUC en el pedido
- [ ] Guardar
- **Esperado**: cambios reflejados en el detalle y en el historial (`PEDIDO_EDITADO`)

### P-08 Modificar líneas del pedido
- [ ] Agregar un producto nuevo al pedido → guardar
- **Esperado**: nueva línea visible, total actualizado, `PRODUCTO_AGREGADO` en historial
- [ ] Eliminar una línea → guardar
- **Esperado**: línea eliminada, total recalculado, `PRODUCTO_ELIMINADO` en historial
- [ ] Cambiar cantidad de una línea → guardar
- **Esperado**: `CANTIDAD_MODIFICADA` en historial con antes/después

---

## Flujo de venta / etapas

### P-09 Avanzar etapa del pedido
- [ ] Desde el detalle, avanzar a la siguiente etapa del flujo
- **Esperado**: etapa actualizada, entrada registrada en el timeline del historial

### P-10 Retroceder etapa (si aplica)
- [ ] Si el flujo permite retroceso, regresar a una etapa anterior
- **Esperado**: etapa actualizada sin errores

### P-11 Etapa con acción automática
- [ ] Avanzar a una etapa configurada con acción automática (ej: enviar email)
- **Esperado**: acción ejecutada, registro en historial o logs

---

## Entrega y seguimiento

### P-12 Registrar entrega (primera vez)
- [ ] En un pedido en etapa con `permiteEditarEntrega = true`, ir a "Entrega y seguimiento"
- [ ] Completar: método de entrega, estado, transportista, número de guía, fecha estimada
- [ ] Guardar
- **Esperado**: entrega guardada, entrada **"Entrega registrada"** visible en el timeline con los campos ingresados

### P-13 Actualizar estado de entrega
- [ ] Cambiar estado de entrega de `Pendiente` a `En camino`
- [ ] Guardar
- **Esperado**: entrada **"Entrega actualizada"** en el timeline con el estado anterior (`Pendiente`) y el nuevo (`En camino`)

### P-14 Actualizar transportista y número de guía
- [ ] Cambiar el transportista y el número de guía
- [ ] Guardar
- **Esperado**: nuevos valores reflejados en el detalle y en el historial

### P-15 Entrega no disponible en etapa incorrecta
- [ ] En un pedido en etapa donde `permiteEditarEntrega = false`, intentar acceder a la sección de entrega
- **Esperado**: sección bloqueada o no visible, error si se intenta guardar directamente

---

## Timeline e historial

### P-16 Ver historial de cambios completo
- [ ] Abrir el detalle de un pedido al que se le han hecho varios cambios
- **Esperado**: timeline con entradas de: creación, cambios de etapa, ediciones de datos, cambios de líneas, actualizaciones de entrega — ordenadas por fecha

### P-17 Nombre de usuario en el historial
- [ ] Verificar que cada entrada del timeline muestra el nombre del usuario que realizó el cambio
- **Esperado**: nombre visible junto a la fecha; "Sistema" para acciones automáticas

---

## Permisos por rol

### P-18 AGENTE_SOPORTE solo lectura en pedidos
- [ ] Con rol AGENTE_SOPORTE (pedidos: `r`), ver un pedido
- **Esperado**: puede ver, no puede editar ni cambiar de etapa

### P-19 SUPERVISOR solo lectura
- [ ] Con rol SUPERVISOR, acceder a `/sales/pedidos`
- **Esperado**: puede ver lista y detalle, sin botones de modificación
