# Pruebas — Conversaciones / Inbox

Rol mínimo para modificar: **AGENTE_VENTAS** / **AGENTE_SOPORTE**
Rol mínimo para ver: **INVITADO**
Sin acceso: **EJECUTIVO_VENTAS**

---

## Listado de conversaciones

### IN-01 Ver lista de conversaciones
- [ ] Ir a `/inbox`
- **Esperado**: lista de conversaciones con nombre del contacto/número, último mensaje, fecha, estado (abierta/cerrada)

### IN-02 Buscar conversación
- [ ] Escribir nombre o número en el buscador
- **Esperado**: lista filtrada con las conversaciones que coinciden

### IN-03 Conversaciones no leídas
- [ ] Tener conversaciones con mensajes entrantes sin leer
- **Esperado**: indicador visual de no leído (badge o punto) en las conversaciones pendientes

### IN-04 Filtrar por estado
- [ ] Filtrar por Abierta / Cerrada / Sin asignar
- **Esperado**: lista filtrada correctamente

---

## Vista de conversación

### IN-05 Ver mensajes de una conversación
- [ ] Clic en una conversación de la lista
- **Esperado**: hilo de mensajes ordenados cronológicamente, con distinción visual entre mensajes entrantes y salientes

### IN-06 Mensajes en tiempo real (SSE)
- [ ] Tener la conversación abierta mientras llega un mensaje nuevo desde el canal externo
- **Esperado**: mensaje aparece en tiempo real sin recargar la página

### IN-07 Indicador de tipo de mensaje
- [ ] Ver mensajes con texto, imagen o archivo
- **Esperado**: cada tipo se renderiza correctamente (imagen embebida, link de archivo, texto plano)

---

## Responder y enviar mensajes

### IN-08 Enviar mensaje de texto
- [ ] Escribir un mensaje en el campo de respuesta y enviar
- **Esperado**: mensaje enviado, visible en el hilo, comando `ENVIAR_MENSAJE` publicado en RabbitMQ

### IN-09 Responder con template (si aplica)
- [ ] Seleccionar un template de respuesta predefinido
- **Esperado**: template insertado en el campo, enviado correctamente

### IN-10 Enviar mensaje con archivo / imagen (si aplica)
- [ ] Adjuntar un archivo o imagen y enviar
- **Esperado**: archivo enviado, `mediaUrl` guardado correctamente

---

## Gestión de conversaciones

### IN-11 Marcar conversación como leída
- [ ] Abrir una conversación con mensajes no leídos
- **Esperado**: indicador de no leído desaparece automáticamente

### IN-12 Cerrar conversación
- [ ] Cerrar una conversación abierta
- **Esperado**: estado cambia a "Cerrada", ya no aparece en la vista de abiertas

### IN-13 Asignar conversación a un agente
- [ ] Asignar la conversación a un agente del equipo
- **Esperado**: agente asignado visible, posiblemente notificación al agente

---

## Vinculación con CRM

### IN-14 Conversación vinculada a un contacto
- [ ] Abrir una conversación de un número que ya existe como contacto
- **Esperado**: datos del contacto visibles en el panel lateral (nombre, empresa, etc.)

### IN-15 Crear contacto desde conversación (si aplica)
- [ ] Recibir mensaje de un número desconocido
- **Esperado**: opción para crear el contacto desde la vista de la conversación

---

## Permisos por rol

### IN-16 EJECUTIVO_VENTAS sin acceso al inbox
- [ ] Con rol EJECUTIVO_VENTAS, intentar acceder a `/inbox`
- **Esperado**: redireccionado o módulo no visible en el menú

### IN-17 INVITADO solo lectura
- [ ] Con rol INVITADO, ver conversaciones sin poder responder
- **Esperado**: campo de respuesta oculto o deshabilitado
