# Objetivo

Realizar una refactorización controlada del sistema de eventos para que todos los eventos del CRM utilicen **Contratos de Eventos compartidos, tipados y versionados**, eliminando diferencias entre quien publica un evento y quien lo consume.

La arquitectura actual debe mantenerse. No modificar la lógica de negocio, RabbitMQ, Event Bus, Schedulers, Casos de Uso ni la estructura general del sistema.

## Concepto principal

Un evento representa un hecho que **ya ocurrió** dentro del sistema.

Por esta razón, todos los eventos deben nombrarse en pasado.

### Ejemplos

❌ Incorrecto

* CrearOportunidad
* CrearPedido
* EnviarCorreo
* IniciarConversacion
* ActualizarContacto

✅ Correcto

* OportunidadCreada
* PedidoCreado
* CorreoEnviado
* ConversacionIniciada
* ContactoActualizado

## Crear módulo centralizado de Contratos de Eventos

Crear una carpeta compartida para todos los contratos de eventos:

```txt
src/
 ├── eventos/
 │    ├── contratos/
 │    ├── publicadores/
 │    ├── suscriptores/
```

O utilizar la estructura equivalente existente dentro del proyecto.

Todos los eventos deberán existir en un único lugar y ser reutilizados por publicadores y suscriptores.

No se deben crear DTOs separados para el mismo evento.

## Renombrar todos los eventos a hechos ocurridos

Regla:

```txt
Entidad + Acción en Pasado
```

Ejemplos:

```txt
OportunidadCreada
OportunidadActualizada
OportunidadGanada
OportunidadPerdida

ConversacionIniciada
ConversacionCerrada
ConversacionReabierta
MensajeRecibido
MensajeEnviado

PedidoCreado
PedidoActualizado
PedidoPagado
PedidoCancelado
PedidoEnviado
PedidoEntregado

ContactoCreado
ContactoActualizado

EmpresaCreada
EmpresaActualizada

CotizacionCreada
CotizacionAprobada
CotizacionRechazada

TareaCreada
TareaCompletada
TareaVencida

RecordatorioCreado
RecordatorioEjecutado
```

## Crear contrato base para todos los eventos

Todos los eventos deben compartir una estructura común:

```ts
export interface EventoDominio<TDatos> {
  idEvento: string;
  nombreEvento: string;
  version: number;
  fechaOcurrencia: Date;
  instanciaId: string;
  datos: TDatos;
}
```

## Crear contratos específicos por evento

Ejemplo:

```ts
export interface OportunidadCreadaEvent
  extends EventoDominio<{
    oportunidadId: string;
    contactoId?: string;
    pipelineId: string;
    etapaId: string;
    creadoPorUsuarioId: string;
  }> {}
```

Cada evento debe tener su propio contrato claramente definido.

## Eliminar DTOs duplicados

Si actualmente existe:

```txt
DTO para publicar
DTO para consumir
```

para el mismo evento:

```txt
OportunidadCreada
```

deben reemplazarse por un único contrato compartido.

Ejemplo:

```ts
import { OportunidadCreadaEvent }
from "@/eventos/contratos/oportunidad-creada.event";
```

Tanto el publicador como el suscriptor deben utilizar exactamente el mismo contrato.

## Incorporar versionamiento

Todos los eventos deben incluir:

```ts
version: number;
```

Inicialmente:

```ts
version = 1;
```

Esto permitirá evolucionar los contratos sin afectar consumidores existentes.

## Crear catálogo centralizado de eventos

Crear una constante con todos los nombres oficiales de eventos:

```ts
export const EventosSistema = {
  OportunidadCreada: "oportunidad.creada",
  OportunidadActualizada: "oportunidad.actualizada",

  ConversacionIniciada: "conversacion.iniciada",
  ConversacionCerrada: "conversacion.cerrada",

  PedidoCreado: "pedido.creado",
  PedidoPagado: "pedido.pagado",

  ContactoCreado: "contacto.creado",
  ContactoActualizado: "contacto.actualizado",

  TareaCreada: "tarea.creada",
  TareaCompletada: "tarea.completada"
} as const;
```

No utilizar cadenas de texto escritas manualmente.

Incorrecto:

```ts
publicar("oportunidad.creada");
```

Correcto:

```ts
publicar(EventosSistema.OportunidadCreada);
```

## Tipado estricto en publicación y suscripción

Los métodos actuales de publicación y suscripción deben soportar contratos tipados.

Ejemplo:

```ts
publicar<OportunidadCreadaEvent>(evento);
```

```ts
suscribirse<OportunidadCreadaEvent>(
  EventosSistema.OportunidadCreada,
  async (evento) => {
    // procesamiento
  }
);
```

## Mantener compatibilidad con la arquitectura actual

No modificar:

* Casos de Uso
* Servicios
* Dominio
* Repositorios
* RabbitMQ
* Event Bus
* Schedulers
* Workers
* Integraciones
* Automatizaciones

La refactorización debe enfocarse únicamente en contratos y nomenclatura de eventos.

## Generar documentación automática de eventos

Crear:

```txt
docs/eventos.md
```

Cada evento debe documentar:

* Nombre
* Descripción
* Quién lo publica
* Quién lo consume
* Datos enviados
* Versión

Ejemplo:

### OportunidadCreada

**Descripción**

Se ejecuta cuando una oportunidad es creada exitosamente.

**Publicado por**

* Servicio de Oportunidades

**Consumido por**

* Automatizaciones
* Notificaciones
* Analíticas
* Agentes IA

**Datos**

```ts
{
  oportunidadId: string;
  contactoId?: string;
  pipelineId: string;
  etapaId: string;
}
```

**Versión**

```txt
v1
```

## Resultado esperado

* Todos los eventos representan hechos ocurridos.
* Nomenclatura consistente en pasado.
* Contratos únicos compartidos entre publicadores y suscriptores.
* Eliminación de DTOs duplicados.
* Eventos tipados.
* Eventos versionados.
* Catálogo centralizado de nombres de eventos.
* Documentación automática.
* Compatible con la arquitectura actual del CRM.
* Preparado para crecimiento futuro con IA, Automatizaciones, RabbitMQ, Inbox Omnicanal, Pedidos, Cotizaciones y Microservicios.

## Convención oficial recomendada para el CRM

```txt
contacto.creado
contacto.actualizado

empresa.creada
empresa.actualizada

oportunidad.creada
oportunidad.ganada
oportunidad.perdida

cotizacion.creada
cotizacion.aprobada

pedido.creado
pedido.pagado
pedido.enviado
pedido.entregado

conversacion.iniciada
mensaje.recibido
mensaje.enviado

tarea.creada
tarea.completada

recordatorio.ejecutado
```

Esta nomenclatura deja claro que el evento informa algo que ya ocurrió dentro del sistema y no una acción que debe ejecutarse.
