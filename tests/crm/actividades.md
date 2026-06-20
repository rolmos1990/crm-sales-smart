# Pruebas — Actividades

Rol mínimo para modificar: **AGENTE_VENTAS**
Rol mínimo para ver: **INVITADO**

---

## Listado

### A-01 Ver lista de actividades
- [ ] Ir a `/crm/actividades`
- **Esperado**: lista con tipo, título, fecha/hora, estado (pendiente/completada), responsable

### A-02 Filtrar por tipo
- [ ] Filtrar por tipo: Llamada / Reunión / Tarea / Email
- **Esperado**: lista filtrada con solo el tipo seleccionado

### A-03 Filtrar por estado
- [ ] Filtrar por estado: Pendiente / Completada / Vencida
- **Esperado**: lista filtrada correctamente

---

## Creación

### A-04 Crear actividad mínima
- [ ] Clic en "Nueva actividad"
- [ ] Completar: tipo, título, fecha y hora
- [ ] Guardar
- **Esperado**: actividad creada y visible en la lista

### A-05 Crear actividad vinculada a contacto y oportunidad
- [ ] Seleccionar contacto y oportunidad al crear la actividad
- [ ] Guardar
- **Esperado**: actividad vinculada, visible en el detalle del contacto y de la oportunidad

### A-06 Validaciones del formulario
- [ ] Intentar guardar sin título → error en campo
- [ ] Intentar guardar sin fecha → error en campo

---

## Edición y completar

### A-07 Marcar actividad como completada
- [ ] Desde la lista, marcar una actividad como completada (checkbox o botón)
- **Esperado**: estado cambia a "Completada", registro en historial si aplica

### A-08 Editar actividad pendiente
- [ ] Abrir una actividad pendiente → modificar fecha y notas → guardar
- **Esperado**: cambios reflejados en la lista y detalle

### A-09 Eliminar actividad
- [ ] Eliminar una actividad
- **Esperado**: eliminada de la lista, ya no aparece en los detalles asociados

---

## Actividades desde detalle de contacto/oportunidad

### A-10 Crear actividad desde el detalle de un contacto
- [ ] En el detalle de un contacto, usar el botón de nueva actividad
- **Esperado**: formulario con el contacto pre-seleccionado

### A-11 Ver actividades en el detalle de una oportunidad
- [ ] Abrir el detalle de una oportunidad
- **Esperado**: sección de actividades muestra las actividades vinculadas con estado y fecha

---

## Permisos por rol

### A-12 SUPERVISOR solo lectura
- [ ] Con rol SUPERVISOR, ver actividades pero sin poder crear ni editar
- **Esperado**: botones de creación/edición no visibles

### A-13 INVITADO puede ver actividades
- [ ] Con rol INVITADO, acceder a la lista
- **Esperado**: puede ver, sin acciones de modificación disponibles
