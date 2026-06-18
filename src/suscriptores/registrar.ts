import { EnviarMensajeSuscriptor } from "./mensajes/enviar-mensaje.suscriptor";
import { ProcesarEntranteSuscriptor } from "./mensajes/procesar-entrante.suscriptor";
import { MarcarLeidoSuscriptor } from "./mensajes/marcar-leido.suscriptor";
import { EnviarEmailSuscriptor } from "./email/enviar-email.suscriptor";
import { InicializarInstanciaSuscriptor } from "./sistema/inicializar-instancia.suscriptor";
import { PedidoCreadoSuscriptor } from "./pedidos/pedido-creado.suscriptor";
import { PedidoActualizadoSuscriptor } from "./pedidos/pedido-actualizado.suscriptor";

export async function registrarTodosSuscriptores(): Promise<void> {
  const suscriptores = [
    new EnviarMensajeSuscriptor(),
    new ProcesarEntranteSuscriptor(),
    new MarcarLeidoSuscriptor(),
    new EnviarEmailSuscriptor(),
    new InicializarInstanciaSuscriptor(),
    new PedidoCreadoSuscriptor(),
    new PedidoActualizadoSuscriptor(),
  ];
  await Promise.all(suscriptores.map((s) => s.iniciar()));
  console.log("[Suscriptores] Todos activos");
}
