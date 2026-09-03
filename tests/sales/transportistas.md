# Pruebas — Transportistas

Acceso: **OWNER / ADMIN** (permiso `"transportistas"`)

Automatizado en `tests/e2e/sales/transportistas.spec.ts` (TR-01 a TR-10). Este checklist manual cubre lo mismo más los casos de 022 (zonas/tarifas)/024 (alias/importación) que hoy solo tienen cobertura unitaria — úsalo para una pasada exploratoria antes de un release grande.

---

## Listado

### TR-01 Ver lista de transportistas
- [ ] Ir a `/sales/transportistas`
- **Esperado**: tabla con nombre, país (bandera + nombre, o badge "País pendiente"), tipo, cantidad de zonas activas, estado activo/inactivo

---

## Creación y edición

### TR-02 Crear transportista completo
- [ ] Clic en "Nuevo transportista"
- [ ] Completar nombre, tipo, país (obligatorio) → guardar
- **Esperado**: redirige al detalle; se sembraron 3 servicios (Estándar/Express/Personalizado) y condiciones por defecto

### TR-03 Editar transportista
- [ ] Modificar nombre/persona de contacto/teléfono/correo/notas internas de un transportista existente
- **Esperado**: cambios reflejados; queda registrado en `TransportistaHistorial`

### TR-04 Validación: nombre requerido
- [ ] Intentar guardar sin nombre → error en el campo

### TR-05 Desactivar transportista
- [ ] Marcar un transportista como inactivo
- **Esperado**: no aparece en el selector al registrar entregas de pedidos/cotizaciones

### TR-08 País obligatorio y bloqueo al tener tarifas (023)
- [ ] Crear un transportista sin elegir país → bloqueado, es obligatorio
- [ ] Con un transportista ya con una tarifa configurada, intentar cambiarle el país → bloqueado (candado visible en la pestaña Información)

---

## Zonas y tarifas (022)

### TR-11 Crear una zona con ubicaciones
- [ ] En la pestaña "Zonas y tarifas", "Agregar zona" → completar nombre + al menos una ubicación (país heredado del transportista, provincia del catálogo real)
- **Esperado**: zona creada, visible en la sección "Zonas sin tarifa" hasta que se le agregue una tarifa

### TR-12 Crear/editar una tarifa
- [ ] "Agregar tarifa" para una zona → elegir servicio, costo interno, precio al cliente, tiempos
- **Esperado**: fila visible en la tabla con margen calculado (`precioCliente - costoInterno`)
- [ ] Editar la tarifa, duplicarla a otra zona/servicio, desactivarla, intentar eliminarla si ya fue usada en una cotización/pedido → bloqueado con mensaje claro

---

## Alias y coincidencia aproximada (024)

### TR-13 Agregar y eliminar un alias de un destino
- [ ] Desde el ícono "Alias" junto al nombre de una zona, agregar un alias a una de sus ubicaciones (ej. "Chorrera" para "La Chorrera")
- **Esperado**: el alias queda visible como badge; intentar repetirlo (mismo texto, distinta mayúscula/tilde) en otro destino → rechazado por duplicado
- [ ] Eliminar el alias → desaparece sin afectar la ubicación

### TR-14 La IA reconoce alias y errores de tipeo leves
- [ ] Con un alias ya cargado, simular una consulta a la tool `consultar_opciones_envio` (o preguntarle al agente en una conversación de prueba) usando el alias
- **Esperado**: responde con las opciones correctas, `confianza: "ALIAS"`, sin transferir a un humano
- [ ] Repetir con un error ortográfico leve no registrado como alias → `confianza: "PROBABLE"`, con aclaración
- [ ] Repetir con un texto sin relación a ningún destino → `confianza: "SIN_COINCIDENCIA"`, sin inventar precio

### TR-15 Importar un lote de destinos desde archivo
- [ ] "Importar destinos" → subir un CSV con una mezcla de destinos nuevos, uno que coincide exacto con uno ya configurado, y uno con alias ambiguo (coincide con 2 destinos distintos)
- **Esperado**: el paso de revisión clasifica cada fila correctamente; la fila de alias ambiguo bloquea la confirmación hasta excluirla
- [ ] Confirmar la importación → destinos/tarifas creados o actualizados según lo aprobado, sin duplicados; resultado consultable en el historial de importaciones

---

## Uso en pedidos y cotizaciones

### TR-06 Asignar transportista en entrega de un pedido
- [ ] Al registrar entrega de un pedido, seleccionar un transportista de la lista
- **Esperado**: transportista asignado correctamente, nombre visible en el timeline del pedido

### TR-07 Solo transportistas activos aparecen en el selector
- [ ] Con múltiples transportistas (activos e inactivos), abrir el selector en "Entrega y seguimiento"
- **Esperado**: solo los transportistas activos aparecen en la lista

### TR-09 Zona hereda el país del transportista (023)
- [ ] Agregar una zona desde un transportista con país asignado
- **Esperado**: el país queda pre-completado y bloqueado; la provincia se elige de un catálogo real, no texto libre
