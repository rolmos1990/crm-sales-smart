import { describe, expect, it } from "vitest";
import { simpleParser } from "mailparser";
import { extraerCabeceras } from "./cabeceras";

async function cabeceras(lineas: Record<string, string>) {
  const crudo = Object.entries(lineas).map(([k, v]) => `${k}: ${v}`).join("\r\n") + "\r\n\r\ncuerpo";
  return extraerCabeceras(await simpleParser(Buffer.from(crudo)));
}

describe("extraerCabeceras", () => {
  it("De con nombre y en minúsculas", async () => {
    const c = await cabeceras({ From: '"Juan Pérez" <JUAN@Cliente.COM>', To: "ventas@negocio.test" });
    expect(c.de).toEqual({ nombre: "Juan Pérez", direccion: "juan@cliente.com" });
  });

  it("De sin nombre", async () => {
    const c = await cabeceras({ From: "solo@cliente.test", To: "ventas@negocio.test" });
    expect(c.de).toEqual({ nombre: null, direccion: "solo@cliente.test" });
  });

  it("Para y CC con varias direcciones, asunto y fecha", async () => {
    const c = await cabeceras({
      From: "a@cliente.test",
      To: "ventas@negocio.test, Gerente <gerente@negocio.test>, compras@negocio.test",
      Cc: "jefe@cliente.test, Otro <otro@cliente.test>",
      Subject: "  Cambio de asunto  ",
      Date: "Mon, 16 Nov 2026 10:30:00 -0500",
    });
    expect(c.para.map((d) => d.direccion)).toEqual(["ventas@negocio.test", "gerente@negocio.test", "compras@negocio.test"]);
    expect(c.paraTotal).toBe(3);
    expect(c.cc).toEqual([
      { nombre: null, direccion: "jefe@cliente.test" },
      { nombre: "Otro", direccion: "otro@cliente.test" },
    ]);
    expect(c.ccTotal).toBe(2);
    expect(c.asunto).toBe("Cambio de asunto");
    expect(c.fechaEnvio).toBe("2026-11-16T15:30:00.000Z");
  });

  it("guarda hasta 50 destinatarios y el total real", async () => {
    const muchos = Array.from({ length: 60 }, (_, i) => `d${i}@negocio.test`).join(", ");
    const c = await cabeceras({ From: "a@cliente.test", To: muchos });
    expect(c.para).toHaveLength(50);
    expect(c.paraTotal).toBe(60);
  });

  it("aplana grupos de direcciones", async () => {
    const c = await cabeceras({ From: "a@cliente.test", To: "Equipo: uno@negocio.test, dos@negocio.test;" });
    expect(c.para.map((d) => d.direccion)).toEqual(["uno@negocio.test", "dos@negocio.test"]);
  });

  it("fecha inválida o ausente → null; sin CC → lista vacía", async () => {
    const c = await cabeceras({ From: "a@cliente.test", To: "b@negocio.test", Date: "no es una fecha" });
    expect(c.fechaEnvio).toBeNull();
    expect(c.cc).toEqual([]);
    expect(c.ccTotal).toBe(0);
  });
});
