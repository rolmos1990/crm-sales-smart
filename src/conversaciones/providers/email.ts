import type { ICanalProvider, CapacidadCanal, MensajeSalientePayload } from "./types";
import type { MensajeEntranteNormalizado } from "../types";
import { EnvioMensajeError } from "../errores";
import { descifrarConexion, leerConfiguracionBuzon } from "@/integraciones/email/configuracion";
import { construirTransporteSmtp } from "@/integraciones/email/conectar";
import { conAngulos } from "@/integraciones/email/mensaje/hilo";

/** Lo que EnviarMensajeSuscriptor resuelve antes de llamar al provider. */
interface ContextoHiloEnPayload {
  asunto?: string;
  inReplyTo?: string | null;
  references?: string[];
  direccionBuzon?: string;
}

/**
 * Traduce un fallo de nodemailer a un error de dominio.
 *
 * El texto crudo del servidor SMTP no viaja al cliente: llega en el idioma y
 * el formato que al proveedor se le ocurra. Lo que el Inbox muestra es el
 * mensaje de acá; el detalle técnico queda en el log de EnviarMensajeSuscriptor.
 */
function traducirFalloSmtp(err: unknown): EnvioMensajeError {
  const e = err as { code?: string; responseCode?: number; message?: string } | null;
  const codigo = (e?.code ?? "").toUpperCase();
  const respuesta = e?.responseCode ?? 0;

  if (codigo === "EAUTH" || respuesta === 535 || respuesta === 534) {
    return new EnvioMensajeError({
      codigo: "CREDENCIALES_RECHAZADAS",
      mensaje:
        "El servidor de salida rechazó las credenciales del buzón. Revisá la contraseña en la configuración del canal.",
      reintentable: false,
    });
  }

  if (codigo === "EENVELOPE" || respuesta === 550 || respuesta === 553) {
    return new EnvioMensajeError({
      codigo: "DESTINATARIO_RECHAZADO",
      mensaje: "El servidor rechazó la dirección del destinatario.",
      reintentable: false,
    });
  }

  if (respuesta === 552 || respuesta === 523) {
    return new EnvioMensajeError({
      codigo: "MENSAJE_RECHAZADO",
      mensaje: "El servidor rechazó el mensaje por su tamaño o por una política propia.",
      reintentable: false,
    });
  }

  if (codigo === "ETIMEDOUT" || codigo === "ESOCKET" || codigo === "ECONNECTION") {
    return new EnvioMensajeError({
      codigo: codigo === "ETIMEDOUT" ? "TIEMPO_AGOTADO" : "SERVIDOR_INALCANZABLE",
      mensaje: "No se pudo conectar con el servidor de salida. Puede ser algo pasajero.",
      reintentable: true,
    });
  }

  return new EnvioMensajeError({
    codigo: "ERROR_DESCONOCIDO",
    mensaje: "No se pudo enviar el correo.",
    reintentable: true,
  });
}

export class EmailProvider implements ICanalProvider {
  readonly canal = "email";

  readonly capacidades: CapacidadCanal = {
    texto: true,
    imagen: true,
    video: false,
    audio: false,
    notaVoz: false,
    documento: true,
    // Las "plantillas" de Karia son las de mensajería (WhatsApp Business), no
    // el cuerpo de un correo: declararlas acá ofrecía en el Inbox una acción
    // que el canal no puede cumplir.
    plantillas: false,
    botones: false,
    marcarLeidoExterno: false,
    reacciones: false,
  };

  async enviarMensaje(payload: MensajeSalientePayload): Promise<{ idExterno: string }> {
    // `configuracion` llega como Record<string, unknown> desde el suscriptor,
    // con la configuración del buzón y el contexto del hilo mezclados.
    // `leerConfiguracionBuzon` valida la forma antes de usarla.
    const configuracion = payload.configuracion as unknown as ContextoHiloEnPayload;

    const buzon = leerConfiguracionBuzon(payload.configuracion);
    if (!buzon) {
      throw new EnvioMensajeError({
        codigo: "CANAL_SIN_CONFIGURAR",
        mensaje: "El buzón de correo no está configurado correctamente.",
        reintentable: false,
      });
    }

    const salida = descifrarConexion(buzon.salida);
    const transporte = construirTransporteSmtp(salida);

    const direccionBuzon = configuracion.direccionBuzon ?? salida.usuario;
    const remitente = salida.nombreRemitente
      ? { name: salida.nombreRemitente, address: direccionBuzon }
      : direccionBuzon;

    try {
      const resultado = await transporte.sendMail({
        from: remitente,
        to: payload.destinatario,
        subject: configuracion.asunto ?? "Mensaje",
        // Solo texto plano: Karia no compone HTML y tampoco lo renderiza al
        // recibir (ver research.md R10). Un correo de texto llega igual a
        // todos los clientes y no arrastra una superficie de rastreo.
        text: payload.contenido ?? "",
        ...(configuracion.inReplyTo ? { inReplyTo: conAngulos(configuracion.inReplyTo) } : {}),
        ...(configuracion.references?.length
          ? { references: configuracion.references.map(conAngulos) }
          : {}),
      });

      // El Message-ID que generó el envío: de acá sale el encadenado cuando el
      // cliente responda.
      const idExterno = (resultado.messageId ?? "").replace(/^</, "").replace(/>$/, "");
      return { idExterno: idExterno || `email_${resultado.response ?? "enviado"}` };
    } catch (err) {
      throw traducirFalloSmtp(err);
    } finally {
      transporte.close();
    }
  }

  /**
   * El correo no llega por webhook: lo lee el worker y lo normaliza en
   * src/integraciones/email/mensaje/normalizar.ts, que tiene el correo MIME
   * completo. Este método existe solo porque el contrato ICanalProvider lo
   * exige para los canales que sí reciben por webhook.
   */
  mapearEntrante(): MensajeEntranteNormalizado {
    throw new Error(
      "[Email] El correo entrante se normaliza en integraciones/email/mensaje/normalizar.ts, no acá",
    );
  }

  /** No hay webhook que validar: la lectura la inicia Karia contra el buzón. */
  validarWebhook(): boolean {
    return false;
  }
}
