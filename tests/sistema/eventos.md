# Pruebas — Eventos del Sistema

Estas pruebas validan que los eventos de dominio se publican correctamente en RabbitMQ y que los suscriptores los procesan sin errores. Requieren acceso a logs de servidor o RabbitMQ Management UI.

---

## Publicación de eventos

### EV-01 Evento CONTACTO_CREADO al crear un contacto
- [ ] Crear un contacto nuevo desde el formulario
- **Esperado**: en los logs del servidor aparece `[RabbitMQ] Publicando CONTACTO_CREADO`, sin errores

### EV-02 Evento PEDIDO_CREADO al crear un pedido
- [ ] Crear un pedido nuevo
- **Esperado**: evento `PEDIDO_CREADO` publicado; suscriptor `PedidoCreadoSuscriptor` lo procesa y crea el historial correspondiente

### EV-03 Evento ENTREGA_REGISTRADA al guardar entrega por primera vez
- [ ] En un pedido sin entrega previa, registrar la entrega
- **Esperado**: evento `ENTREGA_REGISTRADA` → suscriptor crea entrada en `PedidoHistorial`

### EV-04 Evento ENTREGA_ACTUALIZADA al modificar entrega existente
- [ ] En un pedido con entrega ya registrada, cambiar el estado de entrega
- **Esperado**: evento `ENTREGA_ACTUALIZADA` publicado con `valorAnterior` y `valorNuevo`

### EV-05 Evento COTIZACION_ENVIADA al enviar cotización
- [ ] Desde el detalle de una cotización, hacer clic en "Enviar"
- **Esperado**: evento `COTIZACION_ENVIADA` publicado; email enviado si hay provider de email configurado

### EV-06 Evento OPORTUNIDAD_GANADA al marcar como ganada
- [ ] Marcar una oportunidad como ganada desde el pipeline o el detalle
- **Esperado**: evento `OPORTUNIDAD_GANADA` publicado con los datos de la oportunidad

### EV-07 Evento MENSAJE_RECIBIDO al llegar un mensaje en inbox
- [ ] Recibir un mensaje en el canal de WhatsApp/conversaciones configurado
- **Esperado**: evento `MENSAJE_RECIBIDO` publicado; mensaje aparece en el inbox en tiempo real (SSE)

---

## Consumidores / Suscriptores

### EV-08 Suscriptor de historial de pedidos procesa correctamente
- [ ] Crear un pedido y verificar en la base de datos que `PedidoHistorial` tiene la entrada `PEDIDO_CREADO`
- **Esperado**: registro con `accion = "PEDIDO_CREADO"`, `valorNuevo` con número y total del pedido

### EV-09 Suscriptor de email procesa ENVIAR_EMAIL
- [ ] Disparar una acción que envíe un email (ej: bienvenida al registrar instancia)
- **Esperado**: email recibido en la bandeja, sin errores en el log del suscriptor

### EV-10 Retry ante fallo transitorio
- [ ] Simular un fallo transitorio en el suscriptor (ej: apagar la BD brevemente)
- **Esperado**: el mensaje se reintenta hasta `MAX_INTENTOS` veces, luego se registra en dead-letter si todos fallan

---

## Cola y routing

### EV-11 Mensajes en RabbitMQ Management
- [ ] Abrir RabbitMQ Management UI (puerto 15672)
- **Esperado**: exchange `vento.eventos` visible, colas de suscriptores ligadas con routing keys correctas

### EV-12 Dead-letter queue
- [ ] Verificar existencia de la dead-letter queue configurada
- **Esperado**: queue `vento.dlq` (o equivalente) existe; mensajes fallidos llegan ahí para inspección manual

---

## Payload types

### EV-13 TypeScript compila sin errores de tipo
- [ ] Ejecutar `npm run build` o `tsc --noEmit`
- **Esperado**: sin errores relacionados a tipos de payload en publicadores ni suscriptores

### EV-14 Payload incorrecto en publicador detectado en compilación
- [ ] Intentar pasar un campo incorrecto a `publicadorEventos.publicar(EventosSistema.PedidoCreado, ...)`
- **Esperado**: error de TypeScript en tiempo de desarrollo (no en runtime)
