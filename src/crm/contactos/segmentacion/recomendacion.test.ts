import { describe, expect, it } from "vitest";

import { calcularRecomendacion, type DatosRecomendacion } from "./recomendacion";

// 041 — FR-031: la primera recomendación que aplique, en orden fijo.

const base: DatosRecomendacion = {
  noContactar: false,
  esperandoRespuesta: false,
  seguimiento: "AL_DIA",
  esCliente: false,
  esInteresado: false,
  interes: "MEDIO",
};

describe("calcularRecomendacion", () => {
  const casos: Array<[string, Partial<DatosRecomendacion>, string]> = [
    ["No contactar gana a todo, incluso a un mensaje sin responder", { noContactar: true, esperandoRespuesta: true, seguimiento: "PENDIENTE" }, "NO_CONTACTAR"],
    ["Mensaje sin responder", { esperandoRespuesta: true, seguimiento: "PENDIENTE", interes: "ALTO" }, "RESPONDER"],
    ["Por recuperar", { seguimiento: "POR_RECUPERAR", esInteresado: true }, "RETOMAR_CONVERSACION"],
    ["Pendiente con interés Alto", { seguimiento: "PENDIENTE", interes: "ALTO", esInteresado: true }, "CONTACTAR_HOY"],
    ["Pendiente con interés Medio", { seguimiento: "PENDIENTE", esInteresado: true }, "DAR_SEGUIMIENTO"],
    ["Cliente inactivo sin interés actual", { seguimiento: "INACTIVO", esCliente: true, interes: "BAJO" }, "OFRECER_NOVEDADES"],
    ["Cliente inactivo pero interesado no es recompra", { seguimiento: "INACTIVO", esCliente: true, esInteresado: true }, "SIN_URGENCIA"],
    ["Lead sin evaluar", { interes: "SIN_EVALUAR" }, "EVALUAR"],
    ["Lead inactivo sin evaluar sigue siendo Evaluar", { interes: "SIN_EVALUAR", seguimiento: "INACTIVO" }, "EVALUAR"],
    ["Cliente al día", { esCliente: true }, "SIN_URGENCIA"],
  ];

  it.each(casos)("%s", (_n, cambios, esperado) => {
    expect(calcularRecomendacion({ ...base, ...cambios })).toBe(esperado);
  });
});
