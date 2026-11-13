import { describe, expect, it } from "vitest";
import {
  camposRequeridosFaltantes,
  describirCamposFaltantes,
  requisitosDeCondiciones,
} from "./requisitos-transportista";

const AMBOS = { requiereDireccionCompleta: true, requiereIdentificacion: true };
const SOLO_DIRECCION = { requiereDireccionCompleta: true, requiereIdentificacion: false };
const NINGUNO = { requiereDireccionCompleta: false, requiereIdentificacion: false };

describe("camposRequeridosFaltantes", () => {
  it("no exige nada cuando el transportista no exige nada", () => {
    expect(camposRequeridosFaltantes(NINGUNO, {})).toEqual([]);
    expect(camposRequeridosFaltantes(NINGUNO, { direccionEntrega: null })).toEqual([]);
  });

  it("pide solo lo que el transportista marca", () => {
    expect(camposRequeridosFaltantes(SOLO_DIRECCION, {})).toEqual(["direccionEntrega"]);
    expect(camposRequeridosFaltantes({ requiereDireccionCompleta: false, requiereIdentificacion: true }, {})).toEqual([
      "identificacion",
    ]);
  });

  it("con el dato cargado deja de faltar", () => {
    expect(camposRequeridosFaltantes(AMBOS, { direccionEntrega: "Calle 50, casa 3", identificacion: "8-888-8888" })).toEqual([]);
  });

  it("un campo en blanco cuenta como vacío: espacios no alcanzan", () => {
    expect(camposRequeridosFaltantes(SOLO_DIRECCION, { direccionEntrega: "   " })).toEqual(["direccionEntrega"]);
    expect(camposRequeridosFaltantes(SOLO_DIRECCION, { direccionEntrega: "" })).toEqual(["direccionEntrega"]);
  });

  it("orden estable: dirección antes que identificación", () => {
    expect(camposRequeridosFaltantes(AMBOS, {})).toEqual(["direccionEntrega", "identificacion"]);
  });

  it("sin datos de entrega (documento sin fila) faltan todos los exigidos", () => {
    expect(camposRequeridosFaltantes(AMBOS, null)).toEqual(["direccionEntrega", "identificacion"]);
    expect(camposRequeridosFaltantes(AMBOS, undefined)).toEqual(["direccionEntrega", "identificacion"]);
  });
});

describe("requisitosDeCondiciones", () => {
  // El schema tiene requiereDireccionCompleta @default(true), pero un
  // transportista sin fila de condiciones no debe empezar a exigir dirección
  // de golpe: hasta que alguien configure sus condiciones, no exige nada.
  it("un transportista sin condiciones configuradas no exige nada", () => {
    expect(requisitosDeCondiciones(null)).toEqual(NINGUNO);
    expect(requisitosDeCondiciones(undefined)).toEqual(NINGUNO);
    expect(camposRequeridosFaltantes(null, {})).toEqual([]);
  });

  it("respeta lo configurado, incluido el false explícito", () => {
    // UnoExpress en producción: courier que no necesita dirección.
    expect(requisitosDeCondiciones({ requiereDireccionCompleta: false })).toEqual(NINGUNO);
    expect(requisitosDeCondiciones(AMBOS)).toEqual(AMBOS);
  });
});

describe("describirCamposFaltantes", () => {
  it("cadena vacía cuando no falta nada, para usarla como condición", () => {
    expect(describirCamposFaltantes([], "ServiEntrega")).toBe("");
  });

  it("nombra al transportista y el campo", () => {
    expect(describirCamposFaltantes(["direccionEntrega"], "ServiEntrega")).toBe(
      "ServiEntrega requiere dirección de entrega",
    );
  });

  it('une con "e" porque la palabra siguiente empieza con i', () => {
    expect(describirCamposFaltantes(["direccionEntrega", "identificacion"], "ServiEntrega")).toBe(
      "ServiEntrega requiere dirección de entrega e identificación",
    );
  });

  it("sin nombre de transportista sigue siendo una frase legible", () => {
    expect(describirCamposFaltantes(["identificacion"], null)).toBe(
      "El transportista elegido requiere identificación",
    );
    expect(describirCamposFaltantes(["identificacion"], "  ")).toBe(
      "El transportista elegido requiere identificación",
    );
  });
});
