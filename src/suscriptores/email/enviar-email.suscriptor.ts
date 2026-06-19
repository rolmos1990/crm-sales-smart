import { ConsumidorBase } from "@/shared/rabbitmq/consumidor";
import { QUEUES, RK } from "@/shared/rabbitmq/exchanges";
import type { EventoEnvelope } from "@/shared/rabbitmq/tipos";
import type { ComandoEnviarEmailPayload } from "@/eventos/contratos/enviar-email.comando";
import { getEmailProvider } from "@/lib/email/providers/factory";
import { renderTemplate } from "@/lib/email/templates/index";
import type { TemplatePayload } from "@/lib/email/templates/types";

export class EnviarEmailSuscriptor extends ConsumidorBase {
  readonly queue = QUEUES.EMAIL_ENVIAR;
  readonly routingKeys = [RK.COMANDO_EMAIL_ENVIAR];

  async manejar(envelope: EventoEnvelope<ComandoEnviarEmailPayload>): Promise<void> {
    const { tipo, destinatario, data, instanciaId } = envelope.payload;
    const sufijo = instanciaId ? ` | instanciaId: ${instanciaId}` : "";
    console.log(`[EnviarEmail] ${tipo}${sufijo}`);

    const templateInput: TemplatePayload = {
      tipo: tipo as TemplatePayload["tipo"],
      data: data as never,
    };
    const rendered = renderTemplate(templateInput);
    const provider = getEmailProvider();
    const result = await provider.enviar({
      to: destinatario,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    console.log(`[EnviarEmail] Enviado OK → idExterno: ${result.idExterno}`);
  }
}
