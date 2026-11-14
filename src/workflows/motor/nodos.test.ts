import { describe, expect, it } from "vitest";
import { elegirOpcion, salidaTurnoIA } from "./nodos";

const opciones = [
  { id: "a", etiqueta: "Consultar productos", sinonimos: ["catálogo", "productos"] },
  { id: "b", etiqueta: "Consultar un pedido", sinonimos: [] },
  { id: "c", etiqueta: "Hablar con un asesor", sinonimos: ["asesor", "humano"] },
];

describe("elegirOpcion — respuesta al nodo Menú", () => {
  it("acepta el número de la opción", () => {
    expect(elegirOpcion("2", opciones)?.id).toBe("b");
    expect(elegirOpcion(" 3 ", opciones)?.id).toBe("c");
  });

  it("acepta el texto exacto sin importar mayúsculas, tildes ni puntuación", () => {
    expect(elegirOpcion("consultar UN pedido!", opciones)?.id).toBe("b");
  });

  it("acepta sinónimos", () => {
    expect(elegirOpcion("Catalogo", opciones)?.id).toBe("a");
    expect(elegirOpcion("humano", opciones)?.id).toBe("c");
  });

  it("rechaza números fuera de rango y texto que no coincide", () => {
    expect(elegirOpcion("4", opciones)).toBeNull();
    expect(elegirOpcion("0", opciones)).toBeNull();
    expect(elegirOpcion("quiero 2 cosas", opciones)).toBeNull();
  });
});

// Qué salida toma el nodo "Atención IA" según cómo terminó el turno. Lo que
// motivó fijar esto con tests: un cliente escribió "Me confirma?", el gate de
// autonomía (016) marcó la categoría como HumanOnly, el turno devolvió
// NO_GENERADO y el nodo se quedó esperando — el cliente no recibió nada y la
// rama humana del Workflow nunca se disparó.
describe("salidaTurnoIA — a dónde sigue el flujo después de un turno de la IA", () => {
  const continua = { modo: "CONTINUA", maxInteracciones: 10 } as Parameters<typeof salidaTurnoIA>[0];
  const unica = { modo: "RESPUESTA_UNICA", maxInteracciones: 10 } as Parameters<typeof salidaTurnoIA>[0];
  const turno = (p: Partial<Parameters<typeof salidaTurnoIA>[1]>) =>
    ({ accion: "ENVIADO", herramientasEjecutadas: [], ...p }) as Parameters<typeof salidaTurnoIA>[1];

  it("NO_GENERADO sale por “Pidió humano”, no deja el flujo esperando", () => {
    expect(salidaTurnoIA(continua, turno({ accion: "NO_GENERADO" }), 1)).toBe("transferencia");
  });

  it("NO_GENERADO también sale por “Pidió humano” en modo respuesta única", () => {
    // Antes caía en "respondido", que es mentira: no se envió nada.
    expect(salidaTurnoIA(unica, turno({ accion: "NO_GENERADO" }), 1)).toBe("transferencia");
  });

  it("PENDIENTE_REVISION sigue esperando: el borrador ya quedó en la bandeja y lo manda una persona", () => {
    expect(salidaTurnoIA(continua, turno({ accion: "PENDIENTE_REVISION" }), 1)).toBeNull();
  });

  it("un envío normal en atención continua sigue esperando al cliente", () => {
    expect(salidaTurnoIA(continua, turno({}), 1)).toBeNull();
  });

  it("la herramienta de transferencia gana sobre todo lo demás", () => {
    expect(salidaTurnoIA(continua, turno({ accion: "ERROR", motivoTransferencia: "cliente molesto" }), 1)).toBe("transferencia");
  });

  it("un error del proveedor sale por “Error”", () => {
    expect(salidaTurnoIA(continua, turno({ accion: "ERROR" }), 1)).toBe("error");
  });

  it("en modo respuesta única, un envío normal cierra el nodo", () => {
    expect(salidaTurnoIA(unica, turno({}), 1)).toBe("respondido");
  });

  it("al llegar al máximo de mensajes sale por “Límite alcanzado”", () => {
    expect(salidaTurnoIA(continua, turno({}), 10)).toBe("limite");
  });

  it("la finalización explícita del agente manda sobre el límite", () => {
    const r = turno({ finalizacion: { resultado: "COMPLETADO", resumen: null } });
    expect(salidaTurnoIA(continua, r, 10)).toBe("completado");
  });
});
