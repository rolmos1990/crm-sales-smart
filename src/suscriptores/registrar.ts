import { EnviarMensajeSuscriptor } from "./mensajes/enviar-mensaje.suscriptor";
import { ProcesarEntranteSuscriptor } from "./mensajes/procesar-entrante.suscriptor";
import { MarcarLeidoSuscriptor } from "./mensajes/marcar-leido.suscriptor";
import { EnviarEmailSuscriptor } from "./email/enviar-email.suscriptor";
import { InicializarInstanciaSuscriptor } from "./sistema/inicializar-instancia.suscriptor";
import { PedidoHistorialSuscriptor } from "./pedidos/pedido-historial.suscriptor";
import { CotizacionAprobadaSuscriptor } from "./cotizaciones/cotizacion-aprobada.suscriptor";
import { GenerarRespuestaIASuscriptor } from "./ai/generar-respuesta-ia.suscriptor";
import { OrquestarIASuscriptor } from "./ai/orquestar-ia.suscriptor";
import { InvalidarPerfilSuscriptor } from "@/ai/perfil-cliente/suscriptores/invalidar-perfil.suscriptor";

export async function registrarTodosSuscriptores(): Promise<void> {
  const suscriptores = [
    new EnviarMensajeSuscriptor(),
    new ProcesarEntranteSuscriptor(),
    new MarcarLeidoSuscriptor(),
    new EnviarEmailSuscriptor(),
    new InicializarInstanciaSuscriptor(),
    new PedidoHistorialSuscriptor(),
    new CotizacionAprobadaSuscriptor(),
    new GenerarRespuestaIASuscriptor(),
    new OrquestarIASuscriptor(),
    new InvalidarPerfilSuscriptor(),
  ];
  await Promise.all(suscriptores.map((s) => s.iniciar()));
  console.log("[Suscriptores] Todos activos");
}
