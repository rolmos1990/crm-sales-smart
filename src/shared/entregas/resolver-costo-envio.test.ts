import { describe, expect, it } from "vitest";
import { decidirCoincidenciaCosto, type CandidatoCosto } from "./resolver-costo-envio";

function candidato(costo: number, extra: Partial<CandidatoCosto> = {}): CandidatoCosto {
  return { fuente: "transportista", costo, ...extra };
}

describe("decidirCoincidenciaCosto (019, Historia 3 — research.md Decisión 5)", () => {
  it("Caso 1: ubicación no reconocida y sin candidatos → SIN_COINCIDENCIA_CLARA", () => {
    const resultado = decidirCoincidenciaCosto({
      candidatosCubiertos: [],
      hayNegativaExplicita: false,
      hayZonaPendienteEvaluacion: false,
      ubicacionReconocida: false,
    });
    expect(resultado.estado).toBe("SIN_COINCIDENCIA_CLARA");
  });

  it("Caso 2: zona en modo SOLO_ZONAS_EVALUADAS no listada → SIN_COINCIDENCIA_CLARA (nunca 'no cubierto')", () => {
    const resultado = decidirCoincidenciaCosto({
      candidatosCubiertos: [],
      hayNegativaExplicita: false,
      hayZonaPendienteEvaluacion: true,
      ubicacionReconocida: true,
    });
    expect(resultado.estado).toBe("SIN_COINCIDENCIA_CLARA");
  });

  it("excepción explícita sin ningún otro candidato → CLARA, cubierto:false (negativa clara, no ambigua)", () => {
    const resultado = decidirCoincidenciaCosto({
      candidatosCubiertos: [],
      hayNegativaExplicita: true,
      hayZonaPendienteEvaluacion: false,
      ubicacionReconocida: true,
    });
    expect(resultado).toEqual({ estado: "CLARA", cubierto: false, motivo: expect.any(String) });
  });

  it("ubicación reconocida pero sin ningún candidato ni excepción ni pendiente → SIN_COINCIDENCIA_CLARA", () => {
    const resultado = decidirCoincidenciaCosto({
      candidatosCubiertos: [],
      hayNegativaExplicita: false,
      hayZonaPendienteEvaluacion: false,
      ubicacionReconocida: true,
    });
    expect(resultado.estado).toBe("SIN_COINCIDENCIA_CLARA");
  });

  it("un único candidato → CLARA, cubierto:true con su costo exacto", () => {
    const resultado = decidirCoincidenciaCosto({
      candidatosCubiertos: [candidato(25, { diasMin: 1, diasMax: 3, metodoEntrega: "COURIER_EXTERNO" })],
      hayNegativaExplicita: false,
      hayZonaPendienteEvaluacion: false,
      ubicacionReconocida: true,
    });
    expect(resultado).toEqual({
      estado: "CLARA",
      cubierto: true,
      costo: 25,
      diasMin: 1,
      diasMax: 3,
      metodosQueCubren: ["COURIER_EXTERNO"],
    });
  });

  it("Caso 3: dos candidatos con costos distintos, sin transportista/método para desambiguar → SIN_COINCIDENCIA_CLARA", () => {
    const resultado = decidirCoincidenciaCosto({
      candidatosCubiertos: [candidato(25), candidato(40)],
      hayNegativaExplicita: false,
      hayZonaPendienteEvaluacion: false,
      ubicacionReconocida: true,
    });
    expect(resultado.estado).toBe("SIN_COINCIDENCIA_CLARA");
  });

  it("dos candidatos con el mismo costo → CLARA (no hay ambigüedad real en el número)", () => {
    const resultado = decidirCoincidenciaCosto({
      candidatosCubiertos: [
        candidato(30, { fuente: "transportista", metodoEntrega: "COURIER_EXTERNO" }),
        candidato(30, { fuente: "delivery", metodoEntrega: "MENSAJERO_PROPIO" }),
      ],
      hayNegativaExplicita: false,
      hayZonaPendienteEvaluacion: false,
      ubicacionReconocida: true,
    });
    expect(resultado).toEqual({
      estado: "CLARA",
      cubierto: true,
      costo: 30,
      diasMin: null,
      diasMax: null,
      metodosQueCubren: ["COURIER_EXTERNO", "MENSAJERO_PROPIO"],
    });
  });

  it("agrega diasMin/diasMax como el rango más amplio entre candidatos", () => {
    const resultado = decidirCoincidenciaCosto({
      candidatosCubiertos: [
        candidato(15, { diasMin: 2, diasMax: 4 }),
        candidato(15, { diasMin: 1, diasMax: 6 }),
      ],
      hayNegativaExplicita: false,
      hayZonaPendienteEvaluacion: false,
      ubicacionReconocida: true,
    });
    expect(resultado).toMatchObject({ estado: "CLARA", cubierto: true, costo: 15, diasMin: 1, diasMax: 6 });
  });
});
