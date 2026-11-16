import { describe, expect, it } from "vitest";
import { simpleParser } from "mailparser";
import { evaluarCorreoEntrante, direccionRemitente, nombreRemitente } from "./filtros";

const BUZON = "ventas@negocio.com";

/** Arma un correo crudo con las cabeceras que pida el caso. */
async function correo(cabeceras: Record<string, string>, cuerpo = "Hola, consulto por precios.") {
  const base: Record<string, string> = {
    From: '"Juan Pérez" <juan@cliente.com>',
    To: BUZON,
    Subject: "Consulta",
    "Message-ID": "<m1@cliente.com>",
    ...cabeceras,
  };
  const crudo =
    Object.entries(base)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\r\n") + `\r\n\r\n${cuerpo}`;
  return simpleParser(crudo);
}

describe("filtros de correo entrante — qué NO debe entrar al CRM", () => {
  it("auto-respuesta con Auto-Submitted (RFC 3834)", async () => {
    const r = evaluarCorreoEntrante(await correo({ "Auto-Submitted": "auto-replied" }), BUZON);
    expect(r).toEqual({ descartar: true, motivo: "AUTO_RESPUESTA" });
  });

  it("auto-respuesta de Exchange con X-Auto-Response-Suppress", async () => {
    const r = evaluarCorreoEntrante(await correo({ "X-Auto-Response-Suppress": "All" }), BUZON);
    expect(r.motivo).toBe("AUTO_RESPUESTA");
  });

  it("auto-respuesta con X-Autoreply", async () => {
    const r = evaluarCorreoEntrante(await correo({ "X-Autoreply": "yes" }), BUZON);
    expect(r.motivo).toBe("AUTO_RESPUESTA");
  });

  it("respuesta automática marcada con Precedence", async () => {
    const r = evaluarCorreoEntrante(await correo({ Precedence: "auto_reply" }), BUZON);
    expect(r.motivo).toBe("AUTO_RESPUESTA");
  });

  it("boletín con List-Unsubscribe", async () => {
    const r = evaluarCorreoEntrante(
      await correo({ "List-Unsubscribe": "<https://boletin.com/baja>" }),
      BUZON,
    );
    expect(r.motivo).toBe("LISTA_O_BOLETIN");
  });

  it("lista de correo con List-Id", async () => {
    const r = evaluarCorreoEntrante(await correo({ "List-Id": "<lista.ejemplo.com>" }), BUZON);
    expect(r.motivo).toBe("LISTA_O_BOLETIN");
  });

  it("rebote con Return-Path vacío", async () => {
    const r = evaluarCorreoEntrante(await correo({ "Return-Path": "<>" }), BUZON);
    expect(r.motivo).toBe("REBOTE");
  });

  it("rebote enviado por MAILER-DAEMON", async () => {
    const r = evaluarCorreoEntrante(
      await correo({ From: "MAILER-DAEMON@proveedor.com" }),
      BUZON,
    );
    expect(r.motivo).toBe("REBOTE");
  });

  it("rebote estructurado multipart/report", async () => {
    const r = evaluarCorreoEntrante(
      await correo({ "Content-Type": 'multipart/report; report-type=delivery-status; boundary="b"' }),
      BUZON,
    );
    expect(r.motivo).toBe("REBOTE");
  });

  it("bucle: el correo viene del propio buzón", async () => {
    const r = evaluarCorreoEntrante(await correo({ From: `Ventas <${BUZON}>` }), BUZON);
    expect(r.motivo).toBe("BUCLE_PROPIO_BUZON");
  });

  it("bucle: el remitente coincide con el buzón aunque cambien las mayúsculas", async () => {
    const r = evaluarCorreoEntrante(await correo({ From: "<VENTAS@NEGOCIO.COM>" }), BUZON);
    expect(r.motivo).toBe("BUCLE_PROPIO_BUZON");
  });
});

describe("filtros de correo entrante — qué SÍ debe entrar", () => {
  it("un correo normal de un cliente no se descarta", async () => {
    expect(evaluarCorreoEntrante(await correo({}), BUZON)).toEqual({ descartar: false });
  });

  it("Auto-Submitted: no significa que lo escribió una persona", async () => {
    expect(evaluarCorreoEntrante(await correo({ "Auto-Submitted": "no" }), BUZON).descartar).toBe(false);
  });

  it("una respuesta dentro de un hilo entra normalmente", async () => {
    const r = evaluarCorreoEntrante(
      await correo({ "In-Reply-To": "<anterior@negocio.com>", Subject: "Re: Consulta" }),
      BUZON,
    );
    expect(r.descartar).toBe(false);
  });
});

describe("lectura del remitente", () => {
  it("normaliza la dirección y separa el nombre visible", async () => {
    const c = await correo({ From: '"Juan Pérez" <JUAN@Cliente.COM>' });
    expect(direccionRemitente(c)).toBe("juan@cliente.com");
    expect(nombreRemitente(c)).toBe("Juan Pérez");
  });

  it("sin nombre visible devuelve undefined, no una cadena vacía", async () => {
    const c = await correo({ From: "<juan@cliente.com>" });
    expect(nombreRemitente(c)).toBeUndefined();
  });
});
