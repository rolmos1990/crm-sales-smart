# Quickstart: validación del canal de correo

**Feature**: 034-canal-correo-electronico

Guía de verificación manual de punta a punta. Cada bloque corresponde a una historia del spec y se puede
correr apenas esa historia está implementada, sin esperar a las demás.

---

## Prerrequisitos

1. **Dos casillas de correo reales** con IMAP y SMTP habilitados:
   - una que haga de **buzón del negocio** (la que se registra en Karia);
   - otra que haga de **cliente** (la que le escribe).
   Si el proveedor exige contraseña de aplicación, generarla antes.
2. Variables de entorno, en la app **y en el worker**:
   - `TOKENS_CIFRADO_KEY` (32 bytes en base64: `openssl rand -base64 32`). Sin ella, registrar un buzón
     falla a propósito.
   - Las de base de datos y RabbitMQ que el proyecto ya usa.
3. Red: el worker debe poder salir a los puertos IMAP/SMTP del proveedor (993/143 y 465/587).
4. Migración aplicada:
   ```bash
   npm run db:migrate
   ```
   > Revisar el diff que proponga Prisma **antes** de aceptarlo: no debe borrar los índices únicos
   > parciales de `instagram` ni de `facebook_messenger`.
5. Levantar app y worker juntos:
   ```bash
   npm run dev:full
   ```

---

## Historia 1 — Registrar el buzón y recibir correos

### 1.1 Alta con validación

1. Ir a **Integraciones** → la tarjeta **Correo electrónico** debe aparecer en la categoría Mensajería.
2. Entrar y pulsar **Agregar buzón**. Completar dirección, nombre, y los datos de entrada y salida.
3. Pulsar **Probar conexión** con la contraseña **mal escrita a propósito**.
   - ✅ Se informa un problema de credenciales, en español, sin texto crudo del servidor.
   - ✅ El botón de guardar sigue deshabilitado y los datos cargados no se pierden.
4. Corregir la contraseña y volver a probar.
   - ✅ Entrada y salida se informan por separado, ambas en verde.
5. Elegir pipeline y etapa de entrada. Guardar y activar.
   - ✅ El buzón aparece activo en la lista.
6. En la base: `CuentaCanal.configuracion` → ✅ las dos contraseñas empiezan con `enc:v1:`.
7. En el navegador, pestaña Red, respuesta de la acción que lista buzones → ✅ no aparece ninguna
   contraseña ni ningún valor `enc:v1:`.

### 1.2 Primer correo

8. Desde la casilla **cliente**, enviar un correo al buzón con asunto y cuerpo reconocibles.
9. Esperar un ciclo de lectura (hasta 60 s). En el log del worker: ✅ una línea con el buzón y 1 correo.
10. Abrir el **Inbox**:
    - ✅ Aparece la conversación con el ícono de correo.
    - ✅ El cuerpo se lee bien, sin etiquetas HTML.
    - ✅ Hay un contacto nuevo con esa dirección de correo.
    - ✅ Hay una oportunidad en la etapa configurada (verificar en el Kanban).

### 1.3 Sin historial y sin duplicados

11. Antes del paso 8 la casilla tenía correos viejos → ✅ ninguno de ellos entró a Karia (FR-023).
12. Reiniciar el worker (`Ctrl-C` y `npm run dev:worker`) y esperar dos ciclos.
    - ✅ El correo del paso 8 **no** aparece dos veces.
13. Enviar un segundo correo desde la misma dirección.
    - ✅ Se suma a la misma conversación; ✅ **no** se crea una segunda oportunidad.

### 1.4 Contacto existente y separación por canal

14. Crear un contacto en el CRM con una dirección distinta y escribir desde ella.
    - ✅ El correo se asocia a **ese** contacto; ✅ no se duplica el contacto.
15. Si ese contacto ya tiene una conversación de WhatsApp abierta:
    - ✅ El correo abre su **propia** conversación; ✅ la de WhatsApp queda intacta.

### 1.5 Correo que no debe entrar

16. Activar la respuesta automática de vacaciones en la casilla cliente y responder desde Karia (o enviarle
    un correo desde el buzón).
    - ✅ La auto-respuesta **no** crea conversación, contacto ni oportunidad.
    - ✅ En el log aparece el descarte con su motivo, **sin el cuerpo del correo**.
17. Enviar un correo a una dirección inexistente del mismo dominio para provocar un rebote.
    - ✅ El rebote no entra.
18. Enviar un correo **desde el propio buzón hacia sí mismo**.
    - ✅ No entra (prevención de bucle).

### 1.6 Buzón roto

19. Cambiar la contraseña del buzón en el proveedor, sin actualizarla en Karia. Esperar dos ciclos.
    - ✅ El buzón se muestra con estado de error y un motivo entendible.
    - ✅ Los demás canales (WhatsApp/Instagram) siguen funcionando.
    - ✅ El worker no se cae.

---

## Historia 2 — Responder desde el Inbox

1. Abrir la conversación de correo y responder desde el Inbox.
   - ✅ El mensaje aparece como enviado por el agente.
2. En la casilla cliente:
   - ✅ Llegó desde la dirección del buzón.
   - ✅ Aparece **dentro del hilo** del correo original (verificar en al menos dos clientes distintos, por
     ejemplo Gmail web y Apple Mail).
   - ✅ El asunto es `Re: <asunto original>`, sin `Re: Re:`.
3. Responder desde el cliente **citando todo el hilo** y esperar el ciclo.
   - ✅ En el Inbox se ve solo el texto nuevo, sin el historial citado repetido.
4. Si la conversación estaba en la etapa inicial:
   - ✅ Tras la primera respuesta, la oportunidad se movió a la etapa de respuesta configurada.
5. Romper a propósito el servidor de salida (puerto equivocado) y responder.
   - ✅ El mensaje queda marcado como fallido, con motivo entendible, y se puede reintentar.

---

## Historia 3 — Aprobación de remitentes desconocidos

1. Editar el buzón y **desactivar** "Crear contactos automáticamente".
2. Escribir desde una dirección **nueva**, nunca vista.
   - ✅ La conversación aparece marcada como pendiente de aprobación.
   - ✅ La oportunidad se distingue como pendiente en el Kanban.
   - ✅ El contacto provisional **no** ensucia el listado de contactos.
3. Intentar responder desde el Inbox.
   - ✅ No se envía nada y se explica que hay que aprobar primero.
4. Con una etapa que tenga respuesta automática de IA habilitada, escribir de nuevo desde esa dirección.
   - ✅ La IA **no** responde. En el log del orquestador aparece el motivo.
   - ✅ Se suma a la **misma** conversación pendiente: no hay un segundo pendiente ni una segunda
     oportunidad.
5. Con un Workflow activo que se dispara por mensaje entrante:
   - ✅ El Workflow no toma la conversación.
6. Aprobar **creando un contacto nuevo**.
   - ✅ La conversación se desbloquea; ✅ los correos recibidos mientras estuvo pendiente siguen ahí.
   - ✅ Responder ahora funciona.
7. Escribir otra vez desde esa misma dirección.
   - ✅ Entra directo, sin pedir aprobación (FR-037).
8. Con otra dirección nueva, aprobar **asociando a un contacto existente**.
   - ✅ La conversación queda bajo ese contacto; ✅ no quedó ningún contacto duplicado ni provisional
     huérfano.
9. Volver a **activar** "Crear contactos automáticamente" y escribir desde una tercera dirección.
   - ✅ No aparece ningún estado pendiente.

---

## Historia 4 — Ajustes de recepción

1. Cambiar la agrupación a **por hilo** y abrir dos hilos distintos desde el mismo remitente.
   - ✅ Cada hilo tiene su conversación.
2. Volver a **por remitente** y repetir.
   - ✅ Ambos hilos caen en la misma conversación.
3. Rotar la contraseña en el proveedor, actualizarla en Karia y probar la conexión.
   - ✅ Vuelve a leer; ✅ las conversaciones anteriores siguen ahí.
4. Desactivar el buzón.
   - ✅ Deja de leer y de poder responder; ✅ las conversaciones quedan visibles.
5. Enviar un correo con un PDF adjunto.
   - ✅ Se puede abrir o descargar desde la conversación.
6. Enviar un correo solo en HTML, con imágenes y tablas.
   - ✅ Se lee como texto, sin etiquetas ni código visible.
7. Enviar un correo con un adjunto que supere el límite.
   - ✅ El correo entra igual, marcado como recortado.

---

## Cero regresión en los canales existentes *(obligatorio antes de cerrar la feature)*

Esta feature toca `resolverContactoYConversacion`, `enviarMensajeInterno`, el orquestador de IA y el motor
de Workflows: los cuatro son compartidos por todos los canales. Verificar, **con el canal correo
funcionando**:

```bash
npm run test:unit
npm run test:e2e:conversaciones
```

Y a mano, sobre WhatsApp o Instagram:

1. ✅ Un mensaje entrante de un contacto nuevo crea contacto, conversación y oportunidad igual que antes.
2. ✅ Un mensaje de un contacto con conversación abierta **sigue cayendo en esa misma conversación**
   (incluido el caso de re-escaneo de QR en WhatsApp, donde la cuenta de canal cambió).
3. ✅ La IA responde cuando la etapa lo permite.
4. ✅ Un Workflow activo sigue tomando sus conversaciones.
5. ✅ Enviar un mensaje desde el Inbox funciona igual.

Si alguno de los cinco cambia de comportamiento, SC-011 no se cumple y la feature no se cierra.
