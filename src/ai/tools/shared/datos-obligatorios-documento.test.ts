import { describe, it, expect } from "vitest";
import {
  describirFaltantesDocumento,
  faltantesDocumentoIA,
  nombreClienteUsable,
} from "./datos-obligatorios-documento";

describe("nombreClienteUsable", () => {
  it("rechaza el placeholder con el que se crea un contacto sin pushName", () => {
    expect(nombreClienteUsable("")).toBe(false);
    expect(nombreClienteUsable("   ")).toBe(false);
    expect(nombreClienteUsable(null)).toBe(false);
    expect(nombreClienteUsable(undefined)).toBe(false);
  });

  it("rechaza un teléfono usado como nombre, en sus formatos habituales", () => {
    expect(nombreClienteUsable("50761234567")).toBe(false);
    expect(nombreClienteUsable("+507 6123-4567")).toBe(false);
    expect(nombreClienteUsable("(507) 6123 4567")).toBe(false);
  });

  it("acepta un nombre real", () => {
    expect(nombreClienteUsable("Ramón")).toBe(true);
    expect(nombreClienteUsable("Ana María Pérez")).toBe(true);
  });

  it("acepta un nombre que contiene dígitos pero no es solo dígitos", () => {
    expect(nombreClienteUsable("Tienda 24/7")).toBe(true);
  });
});

describe("faltantesDocumentoIA", () => {
  const completo = {
    nombreContacto: "Ramón Olmos",
    metodoEntrega: "COURIER_EXTERNO",
    hayDestino: true,
    camposTransportista: [],
  };

  it("no reporta nada cuando está todo", () => {
    expect(faltantesDocumentoIA(completo)).toEqual([]);
  });

  it("reporta el nombre cuando el contacto es un placeholder", () => {
    expect(faltantesDocumentoIA({ ...completo, nombreContacto: "" })).toEqual(["nombreCliente"]);
  });

  it("acepta el nombre del destinatario cuando el contacto no lo tiene", () => {
    expect(
      faltantesDocumentoIA({ ...completo, nombreContacto: "", nombreDestinatario: "Ana Pérez" }),
    ).toEqual([]);
  });

  it("reporta el método de entrega y corta ahí — sin método no se puede saber el resto", () => {
    expect(faltantesDocumentoIA({ ...completo, metodoEntrega: undefined, hayDestino: false })).toEqual([
      "metodoEntrega",
    ]);
  });

  it("este es el caso que antes creaba el documento en silencio: llamada sin bloque entrega", () => {
    expect(
      faltantesDocumentoIA({ nombreContacto: "", metodoEntrega: undefined, hayDestino: false }),
    ).toEqual(["nombreCliente", "metodoEntrega"]);
  });

  it("exige destino cuando el método usa transportista", () => {
    expect(faltantesDocumentoIA({ ...completo, hayDestino: false })).toEqual(["destinoEnvio"]);
  });

  it("no exige destino en retiro, digital ni instalación", () => {
    for (const metodo of ["RETIRO_TIENDA", "DIGITAL", "INSTALACION_SERVICIO"]) {
      expect(faltantesDocumentoIA({ ...completo, metodoEntrega: metodo, hayDestino: false })).toEqual([]);
    }
  });

  it("ignora los campos del transportista cuando el método no lo usa", () => {
    expect(
      faltantesDocumentoIA({
        ...completo,
        metodoEntrega: "RETIRO_TIENDA",
        hayDestino: false,
        camposTransportista: ["direccionEntrega", "identificacion"],
      }),
    ).toEqual([]);
  });

  it("arrastra lo que exige el transportista ya resuelto", () => {
    expect(
      faltantesDocumentoIA({ ...completo, camposTransportista: ["direccionEntrega", "identificacion"] }),
    ).toEqual(["direccionEntrega", "identificacion"]);
  });

  it("mantiene un orden estable de lo general a lo específico", () => {
    expect(
      faltantesDocumentoIA({
        nombreContacto: null,
        metodoEntrega: "COURIER_EXTERNO",
        hayDestino: false,
        camposTransportista: ["identificacion"],
      }),
    ).toEqual(["nombreCliente", "destinoEnvio", "identificacion"]);
  });
});

describe("describirFaltantesDocumento", () => {
  it("devuelve cadena vacía sin faltantes, para usarla como condición", () => {
    expect(describirFaltantesDocumento([])).toBe("");
  });

  it("nombra un único faltante sin lista", () => {
    expect(describirFaltantesDocumento(["nombreCliente"])).toContain("falta confirmar nombre del cliente.");
  });

  it("usa 'e' antes de identificación", () => {
    const texto = describirFaltantesDocumento(["direccionEntrega", "identificacion"]);
    expect(texto).toContain("dirección de entrega e identificación");
  });

  it("usa 'y' cuando el último no empieza con i", () => {
    const texto = describirFaltantesDocumento(["nombreCliente", "destinoEnvio"]);
    expect(texto).toContain("nombre del cliente y destino del envío");
  });

  it("le dice al agente qué hacer y que no invente", () => {
    const texto = describirFaltantesDocumento(["nombreCliente"]);
    expect(texto).toMatch(/Pedíselo al cliente/);
    expect(texto).toMatch(/No lo inventes/);
  });
});
