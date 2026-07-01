// Mapa de tipos: NombreEvento → Payload.
// Permite inferencia automática del payload al publicar o consumir un evento.
//
// Uso en publicador:
//   publicadorEventos.publicar(EventosSistema.ContactoCreado, instanciaId, { ... })
//   → TypeScript exige exactamente ContactoCreadoPayload
//
// Uso en consumidor:
//   class MiSuscriptor extends ConsumidorBase<"CONTACTO_CREADO"> { ... }
//   → envelope.payload es automáticamente ContactoCreadoPayload

import type { ContactoCreadoPayload }      from "./contratos/contacto-creado.event";
import type { ContactoActualizadoPayload } from "./contratos/contacto-actualizado.event";
import type { ContactoEliminadoPayload }   from "./contratos/contacto-eliminado.event";
import type { ContactoAsignadoPayload }    from "./contratos/contacto-asignado.event";
import type { EmpresaCreadaPayload }       from "./contratos/empresa-creada.event";
import type { EmpresaActualizadaPayload }  from "./contratos/empresa-actualizada.event";
import type { OportunidadCreadaPayload }      from "./contratos/oportunidad-creada.event";
import type { OportunidadActualizadaPayload } from "./contratos/oportunidad-actualizada.event";
import type { EtapaCambiadaPayload }          from "./contratos/etapa-cambiada.event";
import type { OportunidadGanadaPayload }      from "./contratos/oportunidad-ganada.event";
import type { OportunidadPerdidaPayload }     from "./contratos/oportunidad-perdida.event";
import type { ActividadCreadaPayload }     from "./contratos/actividad-creada.event";
import type { ActividadCompletadaPayload } from "./contratos/actividad-completada.event";
import type { ProductoCreadoPayload }      from "./contratos/producto-creado.event";
import type { ProductoActualizadoPayload } from "./contratos/producto-actualizado.event";
import type { PrecioActualizadoPayload }   from "./contratos/precio-actualizado.event";
import type { CotizacionCreadaPayload }     from "./contratos/cotizacion-creada.event";
import type { CotizacionActualizadaPayload } from "./contratos/cotizacion-actualizada.event";
import type { CotizacionEnviadaPayload }    from "./contratos/cotizacion-enviada.event";
import type { PedidoCreadoPayload }      from "./contratos/pedido-creado.event";
import type { PedidoActualizadoPayload } from "./contratos/pedido-actualizado.event";
import type { PedidoEntregadoPayload }   from "./contratos/pedido-entregado.event";
import type { MensajeRecibidoPayload }    from "./contratos/mensaje-recibido.event";
import type { MensajeEnviadoPayload }     from "./contratos/mensaje-enviado.event";
import type { ConversacionCreadaPayload } from "./contratos/conversacion-creada.event";
import type { ReaccionActualizadaPayload } from "./contratos/reaccion-actualizada.event";
import type { InstanciaCreadaPayload }    from "./contratos/instancia-creada.event";
import type { ComandoEnviarMensajePayload }        from "./contratos/enviar-mensaje.comando";
import type { ComandoProcesarEntrantePayload }     from "./contratos/procesar-entrante.comando";
import type { ComandoMarcarLeidoPayload }          from "./contratos/marcar-leido.comando";
import type { ComandoEnviarEmailPayload }          from "./contratos/enviar-email.comando";
import type { ComandoInicializarInstanciaPayload } from "./contratos/inicializar-instancia.comando";
import type { ComandoGenerarRespuestaIAPayload }   from "./contratos/generar-respuesta-ia.comando";

export interface MapaPayloads {
  // Contactos
  CONTACTO_CREADO:         ContactoCreadoPayload;
  CONTACTO_ACTUALIZADO:    ContactoActualizadoPayload;
  CONTACTO_ELIMINADO:      ContactoEliminadoPayload;
  CONTACTO_ASIGNADO:       ContactoAsignadoPayload;
  // Empresas
  EMPRESA_CREADA:          EmpresaCreadaPayload;
  EMPRESA_ACTUALIZADA:     EmpresaActualizadaPayload;
  // Oportunidades
  OPORTUNIDAD_CREADA:      OportunidadCreadaPayload;
  OPORTUNIDAD_ACTUALIZADA: OportunidadActualizadaPayload;
  ETAPA_CAMBIADA:          EtapaCambiadaPayload;
  OPORTUNIDAD_GANADA:      OportunidadGanadaPayload;
  OPORTUNIDAD_PERDIDA:     OportunidadPerdidaPayload;
  // Actividades
  ACTIVIDAD_CREADA:        ActividadCreadaPayload;
  ACTIVIDAD_COMPLETADA:    ActividadCompletadaPayload;
  // Productos
  PRODUCTO_CREADO:         ProductoCreadoPayload;
  PRODUCTO_ACTUALIZADO:    ProductoActualizadoPayload;
  PRECIO_ACTUALIZADO:      PrecioActualizadoPayload;
  // Cotizaciones
  COTIZACION_CREADA:       CotizacionCreadaPayload;
  COTIZACION_ACTUALIZADA:  CotizacionActualizadaPayload;
  COTIZACION_ENVIADA:      CotizacionEnviadaPayload;
  // Pedidos
  PEDIDO_CREADO:           PedidoCreadoPayload;
  PEDIDO_ACTUALIZADO:      PedidoActualizadoPayload;
  PEDIDO_ENTREGADO:        PedidoEntregadoPayload;
  // Mensajería
  MENSAJE_RECIBIDO:        MensajeRecibidoPayload;
  MENSAJE_ENVIADO:         MensajeEnviadoPayload;
  CONVERSACION_CREADA:     ConversacionCreadaPayload;
  REACCION_ACTUALIZADA:    ReaccionActualizadaPayload;
  // Sistema
  INSTANCIA_CREADA:        InstanciaCreadaPayload;
  // Comandos
  ENVIAR_MENSAJE:          ComandoEnviarMensajePayload;
  PROCESAR_ENTRANTE:       ComandoProcesarEntrantePayload;
  MARCAR_LEIDO:            ComandoMarcarLeidoPayload;
  ENVIAR_EMAIL:            ComandoEnviarEmailPayload;
  INICIALIZAR_INSTANCIA:   ComandoInicializarInstanciaPayload;
  GENERAR_RESPUESTA_IA:    ComandoGenerarRespuestaIAPayload;
}

export type NombreEvento = keyof MapaPayloads;
export type PayloadDe<K extends NombreEvento> = MapaPayloads[K];
