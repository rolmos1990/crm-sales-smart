import { describe, expect, it } from "vitest";
import { requiereAtencionHumana, cuentaParaAtencionHumana } from "./atencion-humana";

// Una conversación "requiere atención humana" por dos vías distintas que
// significan lo mismo para quien atiende: acá no avanza nada sin una persona.
describe("requiereAtencionHumana", () => {
  it("cuando un humano la tomó o la IA se la transfirió", () => {
    expect(requiereAtencionHumana({ modoAtencion: "HUMANO", pendientesIA: 0 })).toBe(true);
  });

  it("cuando la IA dejó un borrador esperando aprobación", () => {
    expect(requiereAtencionHumana({ modoAtencion: "AUTOMATICO", pendientesIA: 1 })).toBe(true);
  });

  it("atendida por la IA y sin borradores pendientes: no requiere a nadie", () => {
    expect(requiereAtencionHumana({ modoAtencion: "AUTOMATICO", pendientesIA: 0 })).toBe(false);
  });

  it("la atiende un Workflow sin nada pendiente: tampoco", () => {
    expect(requiereAtencionHumana({ modoAtencion: "WORKFLOW", pendientesIA: 0 })).toBe(false);
  });

  it("un Workflow con un borrador pendiente sí la requiere", () => {
    expect(requiereAtencionHumana({ modoAtencion: "WORKFLOW", pendientesIA: 2 })).toBe(true);
  });

  it("tolera los campos ausentes (conversaciones de queries que no los traen)", () => {
    expect(requiereAtencionHumana({})).toBe(false);
  });
});

describe("cuentaParaAtencionHumana — qué entra al filtro y al conteo", () => {
  it("una conversación abierta que la tomó un humano sí cuenta", () => {
    expect(cuentaParaAtencionHumana({ estado: "ABIERTA", modoAtencion: "HUMANO", pendientesIA: 0 })).toBe(true);
  });

  it("una que quedó esperando al cliente con un borrador pendiente también", () => {
    expect(cuentaParaAtencionHumana({ estado: "EN_ESPERA", modoAtencion: "AUTOMATICO", pendientesIA: 1 })).toBe(true);
  });

  it("cerrada no cuenta aunque la hubiera tomado un humano: ya no hay nada que atender", () => {
    expect(cuentaParaAtencionHumana({ estado: "CERRADA", modoAtencion: "HUMANO", pendientesIA: 3 })).toBe(false);
  });

  it("archivada tampoco", () => {
    expect(cuentaParaAtencionHumana({ estado: "ARCHIVADA", modoAtencion: "HUMANO", pendientesIA: 1 })).toBe(false);
  });
});
