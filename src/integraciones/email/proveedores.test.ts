import { describe, expect, it } from "vitest";
import {
  PROVEEDORES,
  avisoPuertoSeguridad,
  detectarProveedor,
  obtenerProveedor,
} from "./proveedores";

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
  it("Gmail usa IMAP implícito y SMTP por el puerto de envío estándar", () => {
    const gmail = obtenerProveedor("gmail");

    expect(gmail.entrada).toEqual({ servidor: "imap.gmail.com", puerto: 993, seguridad: "SSL_TLS" });
    // 587/STARTTLS y no 465: el 465 lo bloquean muchos proveedores de hosting
    // y el síntoma es un timeout que parece un problema de Karia.
    expect(gmail.salida).toEqual({ servidor: "smtp.gmail.com", puerto: 587, seguridad: "STARTTLS" });
  });

  it("ningún preset de salida usa el 465, que es el que más se bloquea", () => {
    for (const p of PROVEEDORES.filter((x) => x.salida)) {
      expect(p.salida?.puerto).not.toBe(465);
    }
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

describe("aviso de puerto y seguridad incompatibles", () => {
  it("587 con SSL/TLS avisa: es el caso que produce 'wrong version number'", () => {
    const aviso = avisoPuertoSeguridad(587, "SSL_TLS");

    expect(aviso).toBeTruthy();
    expect(aviso).toContain("STARTTLS");
  });

  it("465 con STARTTLS avisa: es el caso que se queda esperando", () => {
    expect(avisoPuertoSeguridad(465, "STARTTLS")).toContain("SSL/TLS");
  });

  it("993 con STARTTLS avisa", () => {
    expect(avisoPuertoSeguridad(993, "STARTTLS")).toBeTruthy();
  });

  it.each([
    [465, "SSL_TLS"],
    [993, "SSL_TLS"],
    [587, "STARTTLS"],
    [143, "STARTTLS"],
    [25, "NINGUNA"],
  ] as const)("%i con %s es correcto y no avisa", (puerto, seguridad) => {
    expect(avisoPuertoSeguridad(puerto, seguridad)).toBeNull();
  });

  it("un puerto propio no conocido no avisa nada", () => {
    // Un servidor interno puede usar el puerto que quiera: inventar una regla
    // ahí sería estorbar con una advertencia falsa.
    expect(avisoPuertoSeguridad(2525, "STARTTLS")).toBeNull();
    expect(avisoPuertoSeguridad(9999, "SSL_TLS")).toBeNull();
  });
});
