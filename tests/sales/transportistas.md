# Pruebas — Transportistas

Acceso: **OWNER / ADMIN / GERENTE_VENTAS** (configuración de catálogo)

---

## Listado

### TR-01 Ver lista de transportistas
- [ ] Ir a la sección de transportistas (en configuración o sales)
- **Esperado**: tabla con nombre, RUC/identificación, teléfono, estado activo/inactivo

---

## Creación y edición

### TR-02 Crear transportista
- [ ] Clic en "Nuevo transportista"
- [ ] Completar: nombre, RUC, teléfono, email, notas
- [ ] Guardar
- **Esperado**: transportista creado y disponible al asignarlo en entrega de pedidos

### TR-03 Editar transportista
- [ ] Modificar nombre y teléfono de un transportista existente
- [ ] Guardar
- **Esperado**: cambios reflejados, nombre actualizado en pedidos que ya lo tenían asignado (verificar)

### TR-04 Validaciones
- [ ] Intentar guardar sin nombre → error en campo requerido

### TR-05 Desactivar transportista
- [ ] Marcar un transportista como inactivo
- **Esperado**: no aparece en el selector al registrar entregas de pedidos

---

## Uso en pedidos

### TR-06 Asignar transportista en entrega
- [ ] Al registrar entrega de un pedido, seleccionar un transportista de la lista
- **Esperado**: transportista asignado correctamente, nombre visible en el timeline del pedido

### TR-07 Transportista activo visible en selector
- [ ] Con múltiples transportistas (activos e inactivos), abrir el selector en "Entrega y seguimiento"
- **Esperado**: solo los transportistas activos aparecen en la lista
