# Pruebas — Flujo de Venta

Acceso para configurar: **OWNER / ADMIN**
Acceso para ver: todos los roles con permiso en Pedidos

---

## Configuración del flujo

### FV-01 Ver flujos de venta configurados
- [ ] Ir a la sección de configuración de flujos de venta
- **Esperado**: lista de flujos con nombre y número de etapas

### FV-02 Crear flujo de venta
- [ ] Crear un flujo nuevo con nombre
- [ ] Agregar varias etapas con nombres y orden definido
- [ ] Guardar
- **Esperado**: flujo disponible para ser asignado a nuevos pedidos

### FV-03 Configurar etapa con `permiteEditarEntrega`
- [ ] Editar una etapa del flujo
- [ ] Activar la opción "Permite editar entrega"
- [ ] Guardar
- **Esperado**: al avanzar un pedido a esa etapa, la sección de entrega queda habilitada

### FV-04 Reordenar etapas
- [ ] Cambiar el orden de las etapas en un flujo
- **Esperado**: etapas reordenadas, pedidos en esas etapas no afectados

### FV-05 Eliminar flujo sin pedidos asociados
- [ ] Eliminar un flujo que no tiene pedidos vinculados
- **Esperado**: flujo eliminado sin errores

### FV-06 Intentar eliminar flujo con pedidos activos
- [ ] Intentar eliminar un flujo que tiene pedidos en alguna etapa
- **Esperado**: error o bloqueo, con mensaje explicativo

---

## Uso del flujo en pedidos

### FV-07 Pedido avanza por las etapas del flujo
- [ ] Crear un pedido → avanzar manualmente etapa por etapa
- **Esperado**: cada transición registrada en el timeline con fecha y tipo (MANUAL/AUTOMATICO)

### FV-08 Etapa final del flujo
- [ ] Avanzar un pedido a la última etapa configurada
- **Esperado**: pedido marcado como completado, sin poder avanzar más
