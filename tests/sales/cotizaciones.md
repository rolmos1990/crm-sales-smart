# Pruebas — Cotizaciones

Rol mínimo para modificar: **AGENTE_VENTAS** / **EJECUTIVO_VENTAS**
Rol mínimo para ver: **INVITADO**
Sin acceso: **AGENTE_SOPORTE**

---

## Listado

### CQ-01 Ver lista de cotizaciones
- [ ] Ir a `/sales/cotizaciones`
- **Esperado**: tabla con número, cliente, total, estado, fecha de expiración

### CQ-02 Filtrar por estado
- [ ] Filtrar por Borrador / Enviada / Aceptada / Rechazada / Vencida
- **Esperado**: lista filtrada correctamente

### CQ-03 Búsqueda por número o cliente
- [ ] Buscar por número de cotización o nombre del cliente
- **Esperado**: lista filtrada en tiempo real

---

## Creación

### CQ-04 Crear cotización mínima
- [ ] Clic en "Nueva cotización"
- [ ] Seleccionar contacto o ingresar datos de cliente
- [ ] Agregar al menos un ítem (producto o línea manual)
- [ ] Guardar como borrador
- **Esperado**: cotización creada con número generado automáticamente, estado "Borrador"

### CQ-05 Agregar ítems a la cotización
- [ ] Agregar múltiples productos desde el catálogo
- [ ] Modificar cantidad y descuento por ítem
- **Esperado**: subtotal, descuento y total calculados correctamente en tiempo real

### CQ-06 Aplicar descuento global
- [ ] Ingresar descuento en porcentaje a nivel de cotización
- **Esperado**: total recalculado correctamente

### CQ-07 Seleccionar moneda
- [ ] Cambiar la moneda de la cotización (si hay más de una configurada)
- **Esperado**: total mostrado en la moneda seleccionada

### CQ-08 Agregar notas y condiciones
- [ ] Completar campo de notas y condiciones comerciales
- [ ] Guardar
- **Esperado**: notas visibles en el PDF/detalle generado

### CQ-09 Validaciones
- [ ] Intentar guardar sin ítems → error claro
- [ ] Ítem con cantidad cero o negativa → error de validación

---

## Estados y flujo

### CQ-10 Enviar cotización al cliente
- [ ] Desde el detalle, clic en "Enviar"
- **Esperado**: estado cambia a "Enviada", evento registrado, email enviado al cliente si está configurado

### CQ-11 Marcar como Aceptada
- [ ] Desde el detalle, marcar la cotización como aceptada
- **Esperado**: estado "Aceptada", posibilidad de convertir en pedido

### CQ-12 Convertir cotización en pedido
- [ ] Desde una cotización Aceptada, usar "Convertir en pedido"
- **Esperado**: pedido creado con los mismos ítems y datos del cliente, cotización vinculada

### CQ-13 Marcar como Rechazada
- [ ] Marcar como rechazada
- **Esperado**: estado "Rechazada", campo de motivo disponible

### CQ-14 Cotización vencida
- [ ] Cotización con fecha de expiración pasada
- **Esperado**: estado muestra "Vencida" automáticamente

---

## PDF y visualización

### CQ-15 Generar / descargar PDF
- [ ] Desde el detalle, generar o descargar el PDF de la cotización
- **Esperado**: PDF con datos del cliente, ítems, totales, condiciones y número de cotización

---

## Permisos por rol

### CQ-16 AGENTE_SOPORTE sin acceso
- [ ] Con rol AGENTE_SOPORTE, intentar acceder a `/sales/cotizaciones`
- **Esperado**: redireccionado o módulo no visible en el menú

### CQ-17 SUPERVISOR solo lectura
- [ ] Con rol SUPERVISOR, ver cotizaciones sin poder crear ni editar
- **Esperado**: botones de modificación no visibles
