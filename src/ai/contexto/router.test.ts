import { describe, expect, it } from "vitest";
import { resolverDecisionContexto } from "./router";

const BASE = { totalMensajes: 20, tieneResumen: false, esPrimerMensajeDeContacto: false, limiteTokensCtx: 4000 };

describe("resolverDecisionContexto — presupuesto de tokens (comportamiento previo a la 031)", () => {
  it("con el límite por defecto da 13 mensajes", () => {
    expect(resolverDecisionContexto(BASE).mensajesAIncluir).toBe(13);
  });

  it("nunca baja de 3 aunque el presupuesto no alcance", () => {
    expect(resolverDecisionContexto({ ...BASE, limiteTokensCtx: 2000 }).mensajesAIncluir).toBe(3);
  });

  it("nunca pasa de 30 por más presupuesto que haya", () => {
    expect(resolverDecisionContexto({ ...BASE, limiteTokensCtx: 100_000 }).mensajesAIncluir).toBe(30);
  });

  it("con tokensReservadosExtra en 0 el resultado es idéntico al de siempre (031, SC-001)", () => {
    expect(resolverDecisionContexto({ ...BASE, tokensReservadosExtra: 0 })).toEqual(resolverDecisionContexto(BASE));
  });
});

describe("resolverDecisionContexto — override explícito (031, research D1)", () => {
  it("el override gana sobre el presupuesto", () => {
    expect(resolverDecisionContexto({ ...BASE, override: 5 }).mensajesAIncluir).toBe(5);
  });

  it("pedir 1 devuelve 1: el piso de 3 no aplica cuando el negocio eligió la cantidad", () => {
    expect(resolverDecisionContexto({ ...BASE, override: 1 }).mensajesAIncluir).toBe(1);
  });

  it("el override puede llegar al tope de 30 cuando el presupuesto lo permite", () => {
    expect(resolverDecisionContexto({ ...BASE, limiteTokensCtx: 10_000, override: 30 }).mensajesAIncluir).toBe(30);
  });

  it("el límite de tokens sigue siendo el techo: recorta un override que no entra (FR-007)", () => {
    const decision = resolverDecisionContexto({ ...BASE, limiteTokensCtx: 2600, override: 20 });

    expect(decision.mensajesAIncluir).toBe(4);
    expect(decision.recortadoPorTokens).toBe(true);
  });

  it("cuando el override entra entero, no marca recorte", () => {
    expect(resolverDecisionContexto({ ...BASE, override: 5 }).recortadoPorTokens).toBe(false);
  });
});

describe("resolverDecisionContexto — reserva extra por la ficha (031, D11)", () => {
  it("la reserva extra reduce los mensajes que entran", () => {
    const sinFicha = resolverDecisionContexto(BASE).mensajesAIncluir;
    const conFicha = resolverDecisionContexto({ ...BASE, tokensReservadosExtra: 600 }).mensajesAIncluir;

    expect(conFicha).toBeLessThan(sinFicha);
  });

  it("una reserva extra enorme no baja del piso de 3 cuando no hay override", () => {
    expect(resolverDecisionContexto({ ...BASE, tokensReservadosExtra: 10_000 }).mensajesAIncluir).toBe(3);
  });
});
