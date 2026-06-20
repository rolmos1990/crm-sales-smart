# Pruebas — Oportunidades

Rol mínimo para modificar: **AGENTE_VENTAS**
Rol mínimo para ver: **INVITADO**
Sin acceso: **EJECUTIVO_VENTAS**

---

## Listado

### O-01 Ver lista de oportunidades
- [ ] Ir a `/crm/oportunidades`
- **Esperado**: lista con título, valor, etapa/stage, empresa, fecha de cierre

### O-02 Filtrado y búsqueda
- [ ] Buscar por nombre parcial de oportunidad
- **Esperado**: lista filtrada

---

## Creación — Sin pipeline

### O-03 Crear oportunidad sin pipeline
- [ ] Ir a `/crm/oportunidades/nueva`
- [ ] Seleccionar "Sin pipeline" en el selector de pipeline
- [ ] Completar: título, valor, etapa (enum: Prospecto/Calificado/etc), fecha de cierre
- [ ] Guardar
- **Esperado**: oportunidad creada con etapa legacy, visible en la lista

### O-04 Validaciones
- [ ] Intentar guardar sin título → error en campo
- [ ] Intentar guardar con valor negativo → error en campo

---

## Creación — Con pipeline

### O-05 Crear oportunidad asignando pipeline
- [ ] Ir a `/crm/oportunidades/nueva`
- [ ] Seleccionar un pipeline de la lista
- **Esperado**: el selector de etapa cambia para mostrar las etapas del pipeline seleccionado (con puntos de color)
- [ ] Seleccionar una etapa del pipeline
- [ ] Guardar
- **Esperado**: oportunidad creada con `pipelineId` y `stageId` asignados

### O-06 Cambiar de pipeline en el formulario
- [ ] En el formulario de nueva oportunidad, seleccionar Pipeline A → luego cambiar a Pipeline B
- **Esperado**: el selector de etapas se vacía y muestra las etapas de Pipeline B
- [ ] Volver a "Sin pipeline"
- **Esperado**: vuelve al selector de etapa legacy (Prospecto/Calificado/etc)

### O-07 Crear oportunidad con empresa y contacto
- [ ] Seleccionar empresa y contacto principal en el formulario
- [ ] Guardar
- **Esperado**: vinculación correcta, visibles en el detalle

---

## Edición

### O-08 Editar oportunidad sin pipeline
- [ ] Abrir edición de una oportunidad existente sin pipeline asignado
- **Esperado**: selector de pipeline en "Sin pipeline", etapa legacy visible

### O-09 Editar oportunidad con pipeline
- [ ] Abrir edición de una oportunidad que ya tiene pipeline asignado
- **Esperado**: pipeline y etapa/stage pre-seleccionados correctamente

### O-10 Cambiar pipeline en edición
- [ ] En la edición, cambiar el pipeline (ej: de Pipeline A a Pipeline B)
- **Esperado**: etapa se resetea, debe seleccionarse una etapa del nuevo pipeline
- [ ] Guardar → sin error de FK

### O-11 Quitar pipeline en edición
- [ ] En la edición, cambiar de pipeline a "Sin pipeline"
- [ ] Seleccionar etapa legacy → guardar
- **Esperado**: `pipelineId` y `stageId` en null, `etapa` guardada correctamente

### O-12 Editar campos de texto y valor
- [ ] Cambiar título, valor, notas, fecha de cierre
- [ ] Guardar
- **Esperado**: cambios reflejados en detalle y lista

---

## Detalle de oportunidad

### O-13 Ver historial de cambios
- [ ] Después de editar una oportunidad (cambiar valor, etapa, etc.)
- **Esperado**: las modificaciones aparecen en el timeline con fecha, campo modificado y valor anterior vs nuevo

### O-14 Cambiar etapa / stage desde el detalle
- [ ] Desde el detalle de una oportunidad con pipeline, usar el selector de stage
- **Esperado**: stage actualizado, movimiento registrado en el historial

### O-15 Oportunidad Ganada / Perdida
- [ ] Marcar una oportunidad como Ganada
- **Esperado**: etapa cambia, se solicita o registra valor final
- [ ] Marcar como Perdida
- **Esperado**: campo de motivo disponible, etapa actualizada

---

## Permisos por rol

### O-16 EJECUTIVO_VENTAS no ve oportunidades
- [ ] Con rol EJECUTIVO_VENTAS, intentar acceder a `/crm/oportunidades`
- **Esperado**: redireccionado o módulo no visible en el menú

### O-17 SUPERVISOR solo lectura
- [ ] Con rol SUPERVISOR, ver oportunidades pero no poder editar
- **Esperado**: botones de edición/creación ocultos
