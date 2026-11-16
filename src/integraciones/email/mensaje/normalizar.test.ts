import { describe, expect, it } from "vitest";
import { calcularIdExterno, normalizarCorreo, normalizarMessageId, MAX_CARACTERES_CUERPO } from "./normalizar";

const CTX = {
  cuentaCanalId: "cc-1",
  instanciaId: "inst-1",
  direccionBuzon: "ventas@negocio.com",
  uid: 42,
  uidValidity: BigInt(100),
};

function crudo(cabeceras: Record<string, string>, cuerpo: string): Buffer {
  const base: Record<string, string> = {
    From: '"Juan Pérez" <JUAN@Cliente.COM>',
    To: "ventas@negocio.com",
    Subject: "Consulta de precios",
    "Message-ID": "<abc123@cliente.com>",
    ...cabeceras,
  };
  const texto =
    Object.entries(base)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\r\n") + `\r\n\r\n${cuerpo}`;
  return Buffer.from(texto, "utf-8");
}

async function normalizar(cabeceras: Record<string, string>, cuerpo: string) {
  return normalizarCorreo(crudo(cabeceras, cuerpo), CTX);
}

describe("normalización de un correo entrante", () => {
  it("arma el payload del comando ProcesarEntrante que ya usan los demás canales", async () => {
    const r = await normalizar({}, "Hola, quiero cotizar 20 unidades.");

    expect(r.tipo).toBe("ACEPTADO");
    if (r.tipo !== "ACEPTADO") return;

    expect(r.correo.payload).toMatchObject({
      canal: "email",
      instanciaId: "inst-1",
      cuentaCanalId: "cc-1",
      identificadorContacto: "juan@cliente.com",
      tipo: "TEXTO",
      idExterno: "abc123@cliente.com",
      pushName: "Juan Pérez",
      contenido: "Hola, quiero cotizar 20 unidades.",
    });
    expect(r.correo.asunto).toBe("Consulta de precios");
  });

  // 035 — Reemplaza la regla de 034 ("el HTML nunca se guarda"). La nueva:
  // el texto sigue igual para IA/búsqueda/lista, y el HTML se guarda SOLO
  // limpio, para mostrarse en un iframe aislado.
  describe("HTML del correo (035)", () => {
    const HTML =
      '<html><body><p>Hola, quiero el <b>precio</b>.</p><p>Ver <a href="https://x.com/p">catálogo</a></p>' +
      '<script>alert(1)</script><img src="https://t.test/p.gif" onerror="alert(2)"></body></html>';

    it("el texto del mensaje sigue siendo texto legible, igual que antes (FR-008)", async () => {
      const r = await normalizar({ "Content-Type": "text/html; charset=utf-8" }, HTML);

      if (r.tipo !== "ACEPTADO") throw new Error("debería aceptarse");
      const contenido = r.correo.payload.contenido ?? "";

      expect(contenido).toContain("Hola, quiero el precio.");
      expect(contenido).toContain("https://x.com/p");
      expect(contenido).not.toContain("<p>");
      expect(contenido).not.toContain("<html");
    });

    it("se guarda una versión LIMPIA del HTML, nunca el original", async () => {
      const r = await normalizar({ "Content-Type": "text/html; charset=utf-8" }, HTML);

      if (r.tipo !== "ACEPTADO") throw new Error("debería aceptarse");
      const correo = r.correo.payload.correo;
      expect(correo?.estadoHtml).toBe("DISPONIBLE");
      expect(correo?.htmlLimpio).toContain("<b>precio</b>");
      expect(correo?.htmlLimpio).not.toBe(HTML);
      expect(correo?.htmlLimpio).not.toMatch(/<script|onerror|alert|t\.test/i);
      expect(correo?.imagenesExternas).toEqual(["https://t.test/p.gif"]);
    });

    it("guarda las cabeceras propias del correo (US2)", async () => {
      const r = await normalizar(
        {
          To: "ventas@negocio.com, Gerente <gerente@negocio.com>",
          Cc: "compras@cliente.com",
          Subject: "Cambio de asunto",
          Date: "Mon, 16 Nov 2026 10:30:00 -0500",
        },
        "Texto.",
      );

      if (r.tipo !== "ACEPTADO") throw new Error("debería aceptarse");
      expect(r.correo.payload.correo).toMatchObject({
        de: { nombre: "Juan Pérez", direccion: "juan@cliente.com" },
        para: [
          { nombre: null, direccion: "ventas@negocio.com" },
          { nombre: "Gerente", direccion: "gerente@negocio.com" },
        ],
        paraTotal: 2,
        cc: [{ nombre: null, direccion: "compras@cliente.com" }],
        ccTotal: 1,
        asunto: "Cambio de asunto",
        fechaEnvio: "2026-11-16T15:30:00.000Z",
      });
    });

    it("un correo solo texto no tiene HTML", async () => {
      const r = await normalizar({}, "Solo texto.");

      if (r.tipo !== "ACEPTADO") throw new Error("debería aceptarse");
      expect(r.correo.payload.correo).toMatchObject({ estadoHtml: "SIN_HTML", htmlLimpio: null });
    });

    it("un HTML más grande que el límite entra solo como texto, sin perder el correo", async () => {
      const enorme = `<p>Inicio del correo.</p><p>${"x".repeat(1_100_000)}</p>`;
      const r = await normalizar({ "Content-Type": "text/html; charset=utf-8" }, enorme);

      if (r.tipo !== "ACEPTADO") throw new Error("debería aceptarse");
      expect(r.correo.payload.correo).toMatchObject({
        estadoHtml: "NO_DISPONIBLE",
        motivoHtml: "DEMASIADO_GRANDE",
        htmlLimpio: null,
      });
      expect(r.correo.payload.contenido).toContain("Inicio del correo.");
      // El tiempo de este caso es del recorte de cita sobre ~1 MB de texto
      // (camino previo a 035); la limpieza de HTML corta antes por tamaño.
    }, 30_000);
  });

  it("recorta el hilo citado de una respuesta", async () => {
    const r = await normalizar(
      { Subject: "Re: Consulta de precios", "In-Reply-To": "<previo@negocio.com>" },
      "Perfecto, avanzamos.\n\nOn Mon, Nov 10, 2026 at 9:00 AM Ventas <ventas@negocio.com> wrote:\n> Te paso la cotización",
    );

    if (r.tipo !== "ACEPTADO") throw new Error("debería aceptarse");
    expect(r.correo.payload.contenido).toBe("Perfecto, avanzamos.");
  });

  it("un correo sin asunto entra igual", async () => {
    const r = await normalizar({ Subject: "" }, "Sin asunto pero con texto.");

    if (r.tipo !== "ACEPTADO") throw new Error("debería aceptarse");
    expect(r.correo.asunto).toBeNull();
    expect(r.correo.payload.contenido).toBe("Sin asunto pero con texto.");
  });

  it("un correo sin nombre visible no inventa un pushName", async () => {
    const r = await normalizar({ From: "<juan@cliente.com>" }, "Hola.");

    if (r.tipo !== "ACEPTADO") throw new Error("debería aceptarse");
    expect(r.correo.payload.pushName).toBeUndefined();
  });

  it("recorta el cuerpo muy largo y lo deja marcado", async () => {
    const r = await normalizar({}, "a".repeat(MAX_CARACTERES_CUERPO + 5_000));

    if (r.tipo !== "ACEPTADO") throw new Error("debería aceptarse");
    const contenido = r.correo.payload.contenido ?? "";
    expect(contenido.length).toBeLessThan(MAX_CARACTERES_CUERPO + 200);
    expect(contenido).toContain("recortado");
  });

  it("devuelve el motivo cuando el correo debe descartarse", async () => {
    const r = await normalizar({ "Auto-Submitted": "auto-replied" }, "Estoy de vacaciones.");

    expect(r.tipo).toBe("DESCARTADO");
    if (r.tipo !== "DESCARTADO") return;
    expect(r.motivo).toBe("AUTO_RESPUESTA");
    expect(r.messageId).toBe("abc123@cliente.com");
  });

  it("toma la raíz del hilo desde References para la agrupación por hilo", async () => {
    const r = await normalizar(
      { References: "<raiz@negocio.com> <medio@cliente.com>", "In-Reply-To": "<medio@cliente.com>" },
      "Sigo el hilo.",
    );

    if (r.tipo !== "ACEPTADO") throw new Error("debería aceptarse");
    expect(r.correo.hiloExterno).toBe("raiz@negocio.com");
  });

  it("sin References, la raíz del hilo es el propio Message-ID", async () => {
    const r = await normalizar({}, "Primer correo del hilo.");

    if (r.tipo !== "ACEPTADO") throw new Error("debería aceptarse");
    expect(r.correo.hiloExterno).toBe("abc123@cliente.com");
  });
});

describe("identificador externo del correo", () => {
  it("usa el Message-ID sin los ángulos", () => {
    expect(normalizarMessageId("<abc@x.com>")).toBe("abc@x.com");
    expect(normalizarMessageId("  <abc@x.com>  ")).toBe("abc@x.com");
    expect(normalizarMessageId(null)).toBeNull();
    expect(normalizarMessageId("")).toBeNull();
  });

  it("sin Message-ID deriva uno estable de la posición en el buzón", () => {
    const a = calcularIdExterno(null, "cc-1", BigInt(100), 42);
    const b = calcularIdExterno(null, "cc-1", BigInt(100), 42);
    const otro = calcularIdExterno(null, "cc-1", BigInt(100), 43);

    expect(a).toBe(b);
    expect(a).not.toBe(otro);
    expect(a).toHaveLength(64);
  });

  it("el mismo correo leído dos veces produce el mismo idExterno", async () => {
    const a = await normalizar({}, "Hola.");
    const b = await normalizar({}, "Hola.");

    if (a.tipo !== "ACEPTADO" || b.tipo !== "ACEPTADO") throw new Error("deberían aceptarse");
    expect(a.correo.payload.idExterno).toBe(b.correo.payload.idExterno);
  });
});
