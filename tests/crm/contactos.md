# Pruebas — Contactos

Rol mínimo para modificar: **AGENTE_VENTAS** / **AGENTE_SOPORTE**
Rol mínimo para ver: **INVITADO**

---

## Listado

### C-01 Ver lista de contactos
- [ ] Ir a `/crm/contactos`
- **Esperado**: tabla con contactos, nombre, empresa, email, teléfono, estado visible

### C-02 Búsqueda por nombre o email
- [ ] Escribir en el buscador un nombre parcial
- **Esperado**: la lista se filtra en tiempo real sin recargar la página

### C-03 Estado vacío
- [ ] Con instancia nueva sin contactos
- **Esperado**: mensaje de estado vacío con botón para crear el primero

---

## Creación

### C-04 Crear contacto mínimo
- [ ] Clic en "Nuevo contacto"
- [ ] Completar solo los campos requeridos: nombre, apellido
- [ ] Guardar
- **Esperado**: contacto aparece en la lista, sin errores

### C-05 Crear contacto completo
- [ ] Completar: nombre, apellido, email, teléfono principal, teléfono secundario, cargo, empresa, estado, notas
- [ ] Guardar
- **Esperado**: todos los campos guardados y visibles en el detalle

### C-06 Email duplicado
- [ ] Crear un contacto con el mismo email que otro existente
- **Esperado**: error de validación claro (o el sistema lo permite — verificar comportamiento esperado)

### C-07 Teléfono con formato internacional
- [ ] Ingresar teléfono con formato `+51 999 888 777`
- **Esperado**: teléfono guardado normalizado correctamente

### C-08 Validaciones del formulario
- [ ] Intentar guardar sin nombre → error en campo
- [ ] Email con formato inválido → error en campo

---

## Detalle y edición

### C-09 Ver detalle del contacto
- [ ] Clic en un contacto de la lista
- **Esperado**: página de detalle con todos los campos, actividades asociadas, oportunidades vinculadas

### C-10 Editar contacto
- [ ] Ir al detalle → "Editar"
- [ ] Cambiar nombre y teléfono
- [ ] Guardar
- **Esperado**: cambios reflejados inmediatamente en la vista

### C-11 Eliminar contacto
- [ ] Ir al detalle → "Eliminar"
- [ ] Confirmar el diálogo
- **Esperado**: contacto eliminado, redirige a la lista, no aparece más

---

## Permisos por rol

### C-12 SUPERVISOR solo lectura
- [ ] Con rol SUPERVISOR, ir a `/crm/contactos`
- **Esperado**: puede ver la lista y el detalle, pero no aparece botón "Nuevo contacto" ni "Editar"

### C-13 INVITADO solo lectura
- [ ] Con rol INVITADO, intentar acceder al formulario de creación directamente por URL
- **Esperado**: redirigido o error de acceso denegado
