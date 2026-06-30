import { EnviarMensajeSuscriptor } from "./mensajes/enviar-mensaje.suscriptor";
import { ProcesarEntranteSuscriptor } from "./mensajes/procesar-entrante.suscriptor";
import { MarcarLeidoSuscriptor } from "./mensajes/marcar-leido.suscriptor";
import { EnviarEmailSuscriptor } from "./email/enviar-email.suscriptor";
import { InicializarInstanciaSuscriptor } from "./sistema/inicializar-instancia.suscriptor";
import { PedidoHistorialSuscriptor } from "./pedidos/pedido-historial.suscriptor";

export async function registrarTodosSuscriptores(): Promise<void> {
  const suscriptores = [
    new EnviarMensajeSuscriptor(),
    new ProcesarEntranteSuscriptor(),
    new MarcarLeidoSuscriptor(),
    new EnviarEmailSuscriptor(),
    new InicializarInstanciaSuscriptor(),
    new PedidoHistorialSuscriptor(),
  ];
  await Promise.all(suscriptores.map((s) => s.iniciar()));
  console.log("[Suscriptores] Todos activos");
}
