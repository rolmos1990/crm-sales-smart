# Catálogo de Eventos del Sistema

Todos los eventos representan hechos que **ya ocurrieron** dentro del sistema.

## Cómo usar

```ts
import { EventosSistema, ComandosSistema } from "@/eventos/catalogo";
import type { ContactoCreadoPayload } from "@/eventos";

// Publicar un evento
await publicadorEventos.publicar(EventosSistema.ContactoCreado, instanciaId, payload);

// Suscribirse a un evento (en ConsumidorBase)
readonly routingKeys = [RK.EVENTO_CONTACTO_CREADO];
async manejar(envelope: EventoEnvelope<ContactoCreadoPayload>): Promise<void> { ... }
```

---

## Eventos de Dominio

### ContactoCreado

**Descripción**: Se ejecuta cuando un contacto es creado exitosamente.

**Publicado por**: `src/crm/contactos/actions.ts`

**Contrato**: `src/eventos/contratos/contacto-creado.event.ts`

```ts
interface ContactoCreadoPayload {
  instanciaId: string;
  contactoId: string;
  nombre: string;
  apellido: string;
  email?: string;
  empresaId?: string;
}
```

**Versión**: v1

---

### ContactoActualizado

**Descripción**: Se ejecuta cuando los datos de un contacto son modificados.

**Publicado por**: `src/crm/contactos/actions.ts`

**Contrato**: `src/eventos/contratos/contacto-actualizado.event.ts`

```ts
interface ContactoActualizadoPayload {
  instanciaId: string;
  contactoId: string;
  cambios: Record<string, unknown>;
}
```

**Versión**: v1

---

### ContactoEliminado

**Descripción**: Se ejecuta cuando un contacto es eliminado del sistema.

**Publicado por**: `src/crm/contactos/actions.ts`

**Contrato**: `src/eventos/contratos/contacto-eliminado.event.ts`

```ts
interface ContactoEliminadoPayload {
  instanciaId: string;
  contactoId: string;
}
```

**Versión**: v1

---

### ContactoAsignado

**Descripción**: Se ejecuta cuando un contacto es asignado a un usuario.

**Publicado por**: `src/crm/contactos/actions.ts`

**Contrato**: `src/eventos/contratos/contacto-asignado.event.ts`

```ts
interface ContactoAsignadoPayload {
  instanciaId: string;
  contactoId: string;
  usuarioId: string;
}
```

**Versión**: v1

---

### EmpresaCreada

**Descripción**: Se ejecuta cuando una empresa es creada exitosamente.

**Publicado por**: `src/crm/empresas/actions.ts`

**Contrato**: `src/eventos/contratos/empresa-creada.event.ts`

```ts
interface EmpresaCreadaPayload {
  instanciaId: string;
  empresaId: string;
  nombre: string;
}
```

**Versión**: v1

---

### EmpresaActualizada

**Descripción**: Se ejecuta cuando los datos de una empresa son modificados.

**Publicado por**: `src/crm/empresas/actions.ts`

**Contrato**: `src/eventos/contratos/empresa-actualizada.event.ts`

```ts
interface EmpresaActualizadaPayload {
  instanciaId: string;
  empresaId: string;
  cambios: Record<string, unknown>;
}
```

**Versión**: v1

---

### OportunidadCreada

**Descripción**: Se ejecuta cuando una oportunidad de venta es creada.

**Publicado por**: `src/crm/oportunidades/actions.ts`

**Consumido por**: Automatizaciones, Notificaciones, Analíticas, Agentes IA

**Contrato**: `src/eventos/contratos/oportunidad-creada.event.ts`

```ts
interface OportunidadCreadaPayload {
  instanciaId: string;
  oportunidadId: string;
  titulo: string;
  valor: number;
  contactoId?: string;
  empresaId?: string;
}
```

**Versión**: v1

---

### OportunidadActualizada

**Descripción**: Se ejecuta cuando una oportunidad es modificada.

**Publicado por**: `src/crm/oportunidades/actions.ts`

**Contrato**: `src/eventos/contratos/oportunidad-actualizada.event.ts`

```ts
interface OportunidadActualizadaPayload {
  instanciaId: string;
  oportunidadId: string;
  cambios: Record<string, unknown>;
}
```

**Versión**: v1

---

### EtapaCambiada

**Descripción**: Se ejecuta cuando una oportunidad cambia de etapa en el pipeline.

**Publicado por**: `src/crm/oportunidades/actions.ts`

**Contrato**: `src/eventos/contratos/etapa-cambiada.event.ts`

```ts
interface EtapaCambiadaPayload {
  instanciaId: string;
  oportunidadId: string;
  etapaAnterior: string;
  etapaNueva: string;
}
```

**Versión**: v1

---

### OportunidadGanada

**Descripción**: Se ejecuta cuando una oportunidad es marcada como ganada.

**Publicado por**: `src/crm/oportunidades/actions.ts`

**Contrato**: `src/eventos/contratos/oportunidad-ganada.event.ts`

```ts
interface OportunidadGanadaPayload {
  instanciaId: string;
  oportunidadId: string;
  valor: number;
  contactoId?: string;
}
```

**Versión**: v1

---

### OportunidadPerdida

**Descripción**: Se ejecuta cuando una oportunidad es marcada como perdida.

**Publicado por**: `src/crm/oportunidades/actions.ts`

**Contrato**: `src/eventos/contratos/oportunidad-perdida.event.ts`

```ts
interface OportunidadPerdidaPayload {
  instanciaId: string;
  oportunidadId: string;
  motivo?: string;
}
```

**Versión**: v1

---

### ActividadCreada

**Descripción**: Se ejecuta cuando una actividad (llamada, reunión, tarea) es creada.

**Publicado por**: `src/crm/actividades/actions.ts`

**Contrato**: `src/eventos/contratos/actividad-creada.event.ts`

```ts
interface ActividadCreadaPayload {
  instanciaId: string;
  actividadId: string;
  tipo: string;
  fecha: Date;
  entidadId?: string;
  entidadTipo?: string;
}
```

**Versión**: v1

---

### ActividadCompletada

**Descripción**: Se ejecuta cuando una actividad es marcada como completada.

**Publicado por**: `src/crm/actividades/actions.ts`

**Contrato**: `src/eventos/contratos/actividad-completada.event.ts`

```ts
interface ActividadCompletadaPayload {
  instanciaId: string;
  actividadId: string;
  completadaEn: Date;
}
```

**Versión**: v1

---

### ProductoCreado

**Descripción**: Se ejecuta cuando un producto del catálogo es creado.

**Publicado por**: `src/shared/productos/actions.ts`

**Contrato**: `src/eventos/contratos/producto-creado.event.ts`

```ts
interface ProductoCreadoPayload {
  instanciaId: string;
  productoId: string;
  nombre: string;
  precio: number;
}
```

**Versión**: v1

---

### ProductoActualizado

**Descripción**: Se ejecuta cuando un producto es modificado.

**Publicado por**: `src/shared/productos/actions.ts`

**Contrato**: `src/eventos/contratos/producto-actualizado.event.ts`

```ts
interface ProductoActualizadoPayload {
  instanciaId: string;
  productoId: string;
  cambios: Record<string, unknown>;
}
```

**Versión**: v1

---

### PrecioActualizado

**Descripción**: Se ejecuta cuando el precio de un producto cambia.

**Publicado por**: `src/shared/productos/actions.ts`

**Contrato**: `src/eventos/contratos/precio-actualizado.event.ts`

```ts
interface PrecioActualizadoPayload {
  instanciaId: string;
  productoId: string;
  precioAnterior: number;
  precioNuevo: number;
}
```

**Versión**: v1

---

### CotizacionCreada

**Descripción**: Se ejecuta cuando una cotización es creada exitosamente.

**Publicado por**: `src/sales/cotizaciones/actions.ts`

**Contrato**: `src/eventos/contratos/cotizacion-creada.event.ts`

```ts
interface CotizacionCreadaPayload {
  instanciaId: string;
  cotizacionId: string;
  numero: string;
  total: number;
}
```

**Versión**: v1

---

### CotizacionActualizada

**Descripción**: Se ejecuta cuando una cotización es modificada.

**Contrato**: `src/eventos/contratos/cotizacion-actualizada.event.ts`

```ts
interface CotizacionActualizadaPayload {
  instanciaId: string;
  cotizacionId: string;
  cambios: Record<string, unknown>;
}
```

**Versión**: v1

---

### CotizacionEnviada

**Descripción**: Se ejecuta cuando una cotización es enviada al cliente.

**Publicado por**: `src/sales/cotizaciones/actions.ts`

**Contrato**: `src/eventos/contratos/cotizacion-enviada.event.ts`

```ts
interface CotizacionEnviadaPayload {
  instanciaId: string;
  cotizacionId: string;
  numero: string;
  contactoId?: string;
}
```

**Versión**: v1

---

### PedidoCreado

**Descripción**: Se ejecuta cuando un pedido es creado o confirmado desde una cotización.

**Publicado por**: `src/sales/pedidos/actions.ts`, `src/sales/cotizaciones/actions.ts`

**Consumido por**: `PedidoCreadoSuscriptor` → registra en historial del pedido

**Contrato**: `src/eventos/contratos/pedido-creado.event.ts`

```ts
interface PedidoCreadoPayload {
  instanciaId: string;
  pedidoId: string;
  numero: string;
  total: number;
  usuarioId: string | null;
  usuarioNombre: string | null;
}
```

**Versión**: v1

---

### PedidoActualizado

**Descripción**: Se ejecuta cuando campos de un pedido son modificados.

**Publicado por**: `src/sales/pedidos/actions.ts`

**Consumido por**: `PedidoActualizadoSuscriptor` → registra cambios en historial del pedido

**Contrato**: `src/eventos/contratos/pedido-actualizado.event.ts`

```ts
interface EntradaHistorialPedido {
  accion: string;
  valorAnterior?: Record<string, unknown>;
  valorNuevo?: Record<string, unknown>;
}

interface PedidoActualizadoPayload {
  instanciaId: string;
  pedidoId: string;
  usuarioId: string | null;
  usuarioNombre: string | null;
  cambios: EntradaHistorialPedido[];
}
```

**Versión**: v1

---

### PedidoEntregado

**Descripción**: Se ejecuta cuando un pedido es marcado como entregado.

**Publicado por**: `src/sales/pedidos/actions.ts`

**Contrato**: `src/eventos/contratos/pedido-entregado.event.ts`

```ts
interface PedidoEntregadoPayload {
  instanciaId: string;
  pedidoId: string;
  numero: string;
}
```

**Versión**: v1

---

### MensajeRecibido

**Descripción**: Se ejecuta cuando un mensaje entrante es procesado y guardado.

**Publicado por**: `src/conversaciones/actions.ts`

**Consumido por**: `SSERelaySuscriptor` → retransmite al frontend vía SSE

**Contrato**: `src/eventos/contratos/mensaje-recibido.event.ts`

```ts
interface MensajeRecibidoPayload {
  mensajeId: string;
  conversacionId: string;
  instanciaId: string;
  oportunidadId?: string | null;
}
```

**Versión**: v1

---

### MensajeEnviado

**Descripción**: Se ejecuta cuando un mensaje es enviado exitosamente por el canal externo.

**Publicado por**: `src/conversaciones/actions.ts`, `EnviarMensajeSuscriptor`

**Consumido por**: `SSERelaySuscriptor` → retransmite al frontend vía SSE

**Contrato**: `src/eventos/contratos/mensaje-enviado.event.ts`

```ts
interface MensajeEnviadoPayload {
  mensajeId: string;
  conversacionId: string;
  instanciaId: string;
}
```

**Versión**: v1

---

### ConversacionCreada

**Descripción**: Se ejecuta cuando una nueva conversación es iniciada con un contacto.

**Publicado por**: `src/conversaciones/actions.ts`

**Consumido por**: `SSERelaySuscriptor` → retransmite al frontend vía SSE

**Contrato**: `src/eventos/contratos/conversacion-creada.event.ts`

```ts
interface ConversacionCreadaPayload {
  conversacionId: string;
  instanciaId: string;
  contactoId: string;
}
```

**Versión**: v1

---

### ReaccionActualizada

**Descripción**: Se ejecuta cuando la reacción a un mensaje es actualizada.

**Publicado por**: `src/conversaciones/actions.ts`, `src/integraciones/whatsapp-lite/procesar-reaccion-wa.ts`

**Consumido por**: `SSERelaySuscriptor` → retransmite al frontend vía SSE

**Contrato**: `src/eventos/contratos/reaccion-actualizada.event.ts`

```ts
interface ReaccionActualizadaPayload {
  mensajeId: string;
  conversacionId: string;
  instanciaId: string;
}
```

**Versión**: v1

---

### InstanciaCreada

**Descripción**: Se ejecuta cuando una nueva instancia del CRM es creada en el proceso de registro.

**Publicado por**: `src/shared/auth/registro-service.ts`

**Contrato**: `src/eventos/contratos/instancia-creada.event.ts`

```ts
interface InstanciaCreadaPayload {
  instanciaId: string;
  nombre: string;
  slug: string;
}
```

**Versión**: v1

---

## Comandos Asincrónicos

Los comandos representan operaciones que deben ejecutarse de forma asincrónica vía RabbitMQ.

### EnviarMensaje

**Descripción**: Encola el envío de un mensaje saliente por el canal externo correspondiente.

**Publicado por**: `src/conversaciones/actions.ts`

**Consumido por**: `EnviarMensajeSuscriptor`

**Contrato**: `src/eventos/contratos/enviar-mensaje.comando.ts`

```ts
interface ComandoEnviarMensajePayload {
  instanciaId: string;
  mensajeId: string;
  conversacionId: string;
  cuentaCanalId: string;
  tipo: string;
  destinatario: string;
  contenido?: string;
  mediaUrl?: string;
}
```

---

### ProcesarEntrante

**Descripción**: Encola el procesamiento de un mensaje entrante desde un webhook externo.

**Publicado por**: `src/integraciones/whatsapp-lite/encolar-mensaje.ts`, `src/app/api/webhooks/instagram/route.ts`

**Consumido por**: `ProcesarEntranteSuscriptor`

**Contrato**: `src/eventos/contratos/procesar-entrante.comando.ts`

```ts
interface ComandoProcesarEntrantePayload {
  instanciaId: string;
  canal: string;
  identificadorContacto: string;
  cuentaCanalId: string;
  contenido?: string;
  tipo: string;
  idExterno?: string;
  pushName?: string;
  avatarUrl?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaDuracion?: number;
  mediaArchivoId?: string;
}
```

---

### MarcarLeido

**Descripción**: Encola la operación de marcar mensajes como leídos en el canal externo.

**Publicado por**: `src/conversaciones/actions.ts`

**Consumido por**: `MarcarLeidoSuscriptor`

**Contrato**: `src/eventos/contratos/marcar-leido.comando.ts`

```ts
interface ComandoMarcarLeidoPayload {
  instanciaId: string;
  mensajeIds: string[];
  conversacionId: string;
}
```

---

### EnviarEmail

**Descripción**: Encola el envío de un correo electrónico transaccional.

**Publicado por**: `src/lib/email/encolar-email.ts`

**Consumido por**: `EnviarEmailSuscriptor`

**Contrato**: `src/eventos/contratos/enviar-email.comando.ts`

```ts
interface ComandoEnviarEmailPayload {
  instanciaId: string;
  tipo: string;
  destinatario: string[];
  data: unknown;
}
```

---

### InicializarInstancia

**Descripción**: Encola la inicialización de una nueva instancia del CRM (pipeline default, configuración inicial).

**Publicado por**: `src/shared/auth/registro-service.ts`

**Consumido por**: `InicializarInstanciaSuscriptor`

**Contrato**: `src/eventos/contratos/inicializar-instancia.comando.ts`

```ts
interface ComandoInicializarInstanciaPayload {
  instanciaId: string;
}
```

---

## Estructura del módulo de eventos

```
src/eventos/
├── catalogo.ts              # EventosSistema + ComandosSistema (catálogo oficial)
├── index.ts                 # Re-exports de todos los contratos
└── contratos/
    ├── base.event.ts        # EventoDominio<TDatos> — interfaz base
    ├── contacto-creado.event.ts
    ├── contacto-actualizado.event.ts
    ├── contacto-eliminado.event.ts
    ├── contacto-asignado.event.ts
    ├── empresa-creada.event.ts
    ├── empresa-actualizada.event.ts
    ├── oportunidad-creada.event.ts
    ├── oportunidad-actualizada.event.ts
    ├── etapa-cambiada.event.ts
    ├── oportunidad-ganada.event.ts
    ├── oportunidad-perdida.event.ts
    ├── actividad-creada.event.ts
    ├── actividad-completada.event.ts
    ├── producto-creado.event.ts
    ├── producto-actualizado.event.ts
    ├── precio-actualizado.event.ts
    ├── cotizacion-creada.event.ts
    ├── cotizacion-actualizada.event.ts
    ├── cotizacion-enviada.event.ts
    ├── pedido-creado.event.ts
    ├── pedido-actualizado.event.ts
    ├── pedido-entregado.event.ts
    ├── mensaje-recibido.event.ts
    ├── mensaje-enviado.event.ts
    ├── conversacion-creada.event.ts
    ├── reaccion-actualizada.event.ts
    ├── instancia-creada.event.ts
    ├── enviar-mensaje.comando.ts
    ├── procesar-entrante.comando.ts
    ├── marcar-leido.comando.ts
    ├── enviar-email.comando.ts
    └── inicializar-instancia.comando.ts
```
