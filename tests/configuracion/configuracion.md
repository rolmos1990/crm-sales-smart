# Pruebas — Configuración General

Rol mínimo para modificar: **OWNER / ADMIN**
Rol mínimo para ver: **SUPERVISOR**
Sin acceso (al módulo completo): **AGENTE_VENTAS**, **EJECUTIVO_VENTAS**, **AGENTE_SOPORTE**, **INVITADO**

---

## Datos de la instancia

### CF-01 Ver datos de la empresa / instancia
- [ ] Ir a `/configuracion`
- **Esperado**: nombre de empresa, logo, moneda principal, zona horaria, datos de contacto

### CF-02 Editar nombre y datos de la empresa
- [ ] Cambiar el nombre de la empresa y la zona horaria
- [ ] Guardar
- **Esperado**: cambios reflejados en toda la aplicación (encabezado, facturas, etc.)

### CF-03 Cambiar moneda principal
- [ ] Cambiar la moneda configurada para la instancia
- [ ] Guardar
- **Esperado**: símbolo de moneda actualizado en cotizaciones y pedidos nuevos

---

## Usuarios y agentes

### CF-04 Ver lista de usuarios de la instancia
- [ ] Ir a la sección de usuarios
- **Esperado**: lista con nombre, email, rol, estado activo/inactivo

### CF-05 Invitar nuevo usuario
- [ ] Ingresar email de la persona a invitar y asignar rol
- [ ] Enviar invitación
- **Esperado**: email de invitación enviado, usuario en estado "pendiente" hasta que acepte

### CF-06 Cambiar rol de un usuario
- [ ] Cambiar el rol de un usuario existente (ej: de AGENTE_VENTAS a SUPERVISOR)
- [ ] Guardar
- **Esperado**: permisos del usuario actualizados de inmediato

### CF-07 Desactivar usuario
- [ ] Marcar un usuario como inactivo
- **Esperado**: usuario no puede iniciar sesión, aún aparece en historial de cambios

---

## Pipelines

### CF-08 Ver pipelines configurados
- [ ] Ir a la sección de pipelines
- **Esperado**: lista de pipelines con nombre y número de etapas

### CF-09 Crear pipeline con etapas
- [ ] Crear un pipeline nuevo con nombre
- [ ] Agregar etapas con nombre y color
- [ ] Guardar
- **Esperado**: pipeline disponible en el formulario de oportunidades

### CF-10 Editar etapas de un pipeline
- [ ] Cambiar el nombre y color de una etapa
- [ ] Reordenar etapas
- [ ] Guardar
- **Esperado**: cambios reflejados en el tablero Kanban y formularios de oportunidades

### CF-11 Eliminar etapa sin oportunidades
- [ ] Eliminar una etapa que no tiene oportunidades asignadas
- **Esperado**: etapa eliminada sin errores

### CF-12 Intentar eliminar etapa con oportunidades
- [ ] Intentar eliminar una etapa que tiene oportunidades en ella
- **Esperado**: error o bloqueo con mensaje explicativo

---

## Flujos de venta

### CF-13 Crear flujo de venta
- [ ] Crear flujo con múltiples etapas, indicando cuál permite editar entrega
- [ ] Guardar
- **Esperado**: flujo disponible al crear pedidos

---

## Integraciones / Webhooks

### CF-14 Ver integraciones configuradas
- [ ] Ir a la sección de integraciones
- **Esperado**: lista de integraciones activas (WhatsApp, email, webhooks)

### CF-15 Configurar webhook de salida
- [ ] Agregar una URL de webhook para un evento (ej: PEDIDO_CREADO)
- [ ] Guardar
- **Esperado**: webhook registrado, se dispara al crear un pedido de prueba

---

## Permisos por rol

### CF-16 Roles sin acceso a configuración
- [ ] Con rol AGENTE_VENTAS, intentar acceder a `/configuracion`
- **Esperado**: redireccionado, módulo no visible en el menú

### CF-17 SUPERVISOR acceso de solo lectura
- [ ] Con rol SUPERVISOR, acceder a configuración
- **Esperado**: puede ver la configuración pero los formularios están deshabilitados
