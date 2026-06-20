# Pruebas — Pipeline Kanban

Rol mínimo para modificar: **AGENTE_VENTAS**
Rol mínimo para ver: **INVITADO**
Sin acceso: **EJECUTIVO_VENTAS**

---

## Visualización del tablero

### PL-01 Ver tablero Kanban
- [ ] Ir a `/crm/pipeline`
- **Esperado**: columnas con las etapas del pipeline, oportunidades como cards en cada columna

### PL-02 Selector de pipeline
- [ ] Si hay múltiples pipelines, cambiar el selector en la parte superior
- **Esperado**: el tablero se recarga mostrando las etapas y oportunidades del pipeline seleccionado

### PL-03 Ver valor total por columna
- [ ] Observar el encabezado de cada columna
- **Esperado**: suma del valor de las oportunidades visible bajo el nombre de la etapa

### PL-04 Estado vacío de columna
- [ ] Columna sin oportunidades asignadas
- **Esperado**: columna vacía con mensaje o área de drop visible, sin errores

---

## Drag & Drop

### PL-05 Mover oportunidad a otra etapa
- [ ] Arrastrar una oportunidad de una columna a otra
- **Esperado**: oportunidad se mueve visualmente, stage actualizado en base de datos, sin recargar página

### PL-06 Mover al inicio o al final de una columna
- [ ] Arrastrar oportunidad y soltarla en la primera posición de una columna
- **Esperado**: oportunidad aparece al tope de la columna
- [ ] Arrastrar oportunidad al final de la columna
- **Esperado**: oportunidad aparece al final

### PL-07 Mover a columna "Ganado" o "Perdido"
- [ ] Arrastrar oportunidad a la etapa marcada como Ganado
- **Esperado**: modal o confirmación de oportunidad ganada, registro en historial
- [ ] Arrastrar a la etapa de Perdido
- **Esperado**: modal con campo de motivo, registro en historial

### PL-08 Cancelar drag
- [ ] Iniciar arrastre y soltar fuera del tablero (o presionar Escape)
- **Esperado**: oportunidad regresa a su posición original, sin cambios persistidos

---

## Cards de oportunidades

### PL-09 Información visible en el card
- [ ] Observar un card de oportunidad en el tablero
- **Esperado**: título, empresa (si tiene), valor, fecha de cierre o indicador de urgencia visible

### PL-10 Acceder al detalle desde el card
- [ ] Clic en el título o el card de la oportunidad
- **Esperado**: navega al detalle de la oportunidad

---

## Permisos por rol

### PL-11 EJECUTIVO_VENTAS no ve el pipeline
- [ ] Con rol EJECUTIVO_VENTAS, intentar acceder a `/crm/pipeline`
- **Esperado**: redireccionado o módulo no visible en el menú

### PL-12 SUPERVISOR solo lectura
- [ ] Con rol SUPERVISOR, ver el tablero
- **Esperado**: cards visibles, drag & drop deshabilitado o sin efecto

### PL-13 AGENTE_SOPORTE solo puede ver
- [ ] Con rol AGENTE_SOPORTE (pipeline: `r`), acceder al tablero
- **Esperado**: puede ver, no puede mover cards
