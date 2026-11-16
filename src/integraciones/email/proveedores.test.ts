import { describe, expect, it } from "vitest";
import { PROVEEDORES, detectarProveedor, obtenerProveedor } from "./proveedores";

describe("detección del proveedor desde la dirección", () => {
  it.each([
    ["ventas@gmail.com", "gmail"],
    ["Ventas@GMAIL.com", "gmail"],
    ["x@googlemail.com", "gmail"],
    ["ventas@outlook.com", "outlook"],
    ["x@hotmail.com", "outlook"],
    ["x@live.com", "outlook"],
  ])("%s → %s", (direccion, esperado) => {
    expect(detectarProveedor(direccion)).toBe(esperado);
  });

  it("un dominio propio cae en 'otro', que es lo correcto", () => {
    expect(detectarProveedor("ventas@minegocio.com")).toBe("otro");
  });

  it("una dirección incompleta no rompe", () => {
    expect(detectarProveedor("")).toBe("otro");
    expect(detectarProveedor("ventas")).toBe("otro");
    expect(detectarProveedor("ventas@")).toBe("otro");
  });
});

describe("presets de conexión", () => {
  it("Gmail trae IMAP y SMTP sobre SSL/TLS", () => {
    const gmail = obtenerProveedor("gmail");

    expect(gmail.entrada).toEqual({ servidor: "imap.gmail.com", puerto: 993, seguridad: "SSL_TLS" });
    expect(gmail.salida).toEqual({ servidor: "smtp.gmail.com", puerto: 465, seguridad: "SSL_TLS" });
  });

  it("Outlook usa STARTTLS en el puerto 587 para la salida", () => {
    const outlook = obtenerProveedor("outlook");

    expect(outlook.salida).toEqual({
      servidor: "smtp.office365.com",
      puerto: 587,
      seguridad: "STARTTLS",
    });
  });

  it("'otro' no trae ajustes: los carga el negocio", () => {
    const otro = obtenerProveedor("otro");

    expect(otro.entrada).toBeUndefined();
    expect(otro.salida).toBeUndefined();
  });

  it("los proveedores con preset avisan qué contraseña hace falta", () => {
    // Sin este aviso, el negocio prueba con su contraseña normal, falla, y
    // concluye que Karia no funciona.
    for (const p of PROVEEDORES.filter((x) => x.entrada)) {
      expect(p.aviso).toBeTruthy();
    }
  });

  it("una clave desconocida cae en 'otro' en vez de romper", () => {
    expect(obtenerProveedor("inexistente" as never).clave).toBe("otro");
  });
});
