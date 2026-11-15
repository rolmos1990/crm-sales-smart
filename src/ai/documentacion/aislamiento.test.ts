import { describe, expect, it } from "vitest";
import {
  atributosArchivo,
  filtroTenant,
  nombreArchivoOpenAI,
  verificarResultados,
  type FragmentoDocumental,
} from "./aislamiento";

// 033 — Estos tests son la red de seguridad de la feature.
//
// Entre comercios el aislamiento es físico (un vector store por instancia),
// así que esto es defensa en profundidad. Pero dentro de una misma cuenta
// conviven los documentos de todos sus agentes en el mismo índice, y lo único
// que impide que se crucen es lo que se prueba acá. Si alguien afloja el
// filtro, la identidad o la verificación y ninguno de estos tests se pone en
// rojo, el test está mal escrito y hay que arreglarlo antes de tocar el código.

// cuid de Prisma: sin guiones bajos, que es lo que hace inequívoco al prefijo.
const INSTANCIA = "clz1a2b3c0000abcdef";
const AGENTE = "clz9z8y7x0000ghijkl";
const DOCUMENTO = "clz5m4n3b0000mnopqr";
const ID = { instanciaId: INSTANCIA, agenteId: AGENTE, documentoId: DOCUMENTO };

const fragmento = (attrs: FragmentoDocumental["attributes"]): FragmentoDocumental => ({
  attributes: attrs,
  filename: "x",
});

describe("nombreArchivoOpenAI", () => {
  it("lleva la identidad completa como prefijo, en orden", () => {
    const nombre = nombreArchivoOpenAI(ID, "politica-envios.pdf");
    expect(nombre).toBe(`${INSTANCIA}_${AGENTE}_${DOCUMENTO}_politica-envios.pdf`);
  });

  it("es estable: dos llamadas con los mismos datos dan lo mismo", () => {
    expect(nombreArchivoOpenAI(ID, "a.pdf")).toBe(nombreArchivoOpenAI(ID, "a.pdf"));
  });

  it("sanea espacios y acentos sin perder el prefijo", () => {
    const nombre = nombreArchivoOpenAI(ID, "Política de Envíos 2026.pdf");
    expect(nombre.startsWith(`${INSTANCIA}_${AGENTE}_${DOCUMENTO}_`)).toBe(true);
    expect(nombre).toContain("Politica-de-Envios-2026.pdf");
  });

  it("no deja que el nombre original inyecte separadores que rompan el prefijo", () => {
    // Si el guion bajo sobreviviera en la parte libre, leer la identidad desde
    // el dashboard de OpenAI dejaría de ser confiable.
    const nombre = nombreArchivoOpenAI(ID, "otra_instancia_falsa.pdf");
    expect(nombre.split("_").slice(0, 3)).toEqual([INSTANCIA, AGENTE, DOCUMENTO]);
    expect(nombre.split("_")).toHaveLength(4);
  });

  it("un nombre que queda vacío al sanear no produce un prefijo colgado", () => {
    const nombre = nombreArchivoOpenAI(ID, "___");
    expect(nombre).toBe(`${INSTANCIA}_${AGENTE}_${DOCUMENTO}_documento`);
  });
});

describe("atributosArchivo", () => {
  it("expone las tres claves de identidad", () => {
    expect(atributosArchivo(ID)).toEqual({
      instanciaId: INSTANCIA,
      agenteId: AGENTE,
      documentoId: DOCUMENTO,
    });
  });
});

describe("filtroTenant", () => {
  it("arma el AND con los dos eq de identidad", () => {
    expect(filtroTenant(INSTANCIA, AGENTE)).toEqual({
      type: "and",
      filters: [
        { type: "eq", key: "instanciaId", value: INSTANCIA },
        { type: "eq", key: "agenteId", value: AGENTE },
      ],
    });
  });

  it("rompe antes que producir un filtro que no filtra", () => {
    // Un id vacío en un índice compartido daría un filtro inútil: preferimos
    // que explote acá a que devuelva documentación de otro comercio.
    expect(() => filtroTenant("", AGENTE)).toThrow();
    expect(() => filtroTenant(INSTANCIA, "")).toThrow();
  });
});

describe("verificarResultados — la última línea de defensa", () => {
  it("acepta fragmentos del tenant correcto", () => {
    const fragmentos = [fragmento(atributosArchivo(ID)), fragmento(atributosArchivo(ID))];
    expect(verificarResultados(fragmentos, INSTANCIA, AGENTE)).toEqual({ ok: true });
  });

  it("acepta una respuesta sin fragmentos", () => {
    expect(verificarResultados([], INSTANCIA, AGENTE)).toEqual({ ok: true });
  });

  it("rechaza un fragmento de OTRA instancia", () => {
    const ajeno = fragmento({ ...atributosArchivo(ID), instanciaId: "clzOTRA0000000000000" });
    const resultado = verificarResultados([ajeno], INSTANCIA, AGENTE);

    expect(resultado.ok).toBe(false);
  });

  it("rechaza un fragmento de otro agente de la MISMA instancia", () => {
    const ajeno = fragmento({ ...atributosArchivo(ID), agenteId: "clzOTROAGENTE0000000" });
    expect(verificarResultados([ajeno], INSTANCIA, AGENTE).ok).toBe(false);
  });

  it("rechaza el lote entero si UN solo fragmento es ajeno", () => {
    // Descartar solo el ajeno no alcanza: el modelo que sintetizó la respuesta
    // ya lo leyó, así que el texto devuelto puede estar contaminado.
    const fragmentos = [
      fragmento(atributosArchivo(ID)),
      fragmento({ ...atributosArchivo(ID), instanciaId: "clzOTRA0000000000000" }),
      fragmento(atributosArchivo(ID)),
    ];
    expect(verificarResultados(fragmentos, INSTANCIA, AGENTE).ok).toBe(false);
  });

  it("FAIL-CLOSED: rechaza un fragmento SIN atributos", () => {
    // Un archivo indexado sin identidad no puede colarse por omisión. Es el
    // caso que haría inútil a todo el resto del mecanismo.
    expect(verificarResultados([{ filename: "x" }], INSTANCIA, AGENTE).ok).toBe(false);
    expect(verificarResultados([fragmento(null)], INSTANCIA, AGENTE).ok).toBe(false);
  });

  it("FAIL-CLOSED: rechaza atributos incompletos", () => {
    expect(verificarResultados([fragmento({ instanciaId: INSTANCIA })], INSTANCIA, AGENTE).ok).toBe(false);
    expect(verificarResultados([fragmento({ agenteId: AGENTE })], INSTANCIA, AGENTE).ok).toBe(false);
  });

  it("el motivo no filtra el contenido del fragmento ajeno a los logs", () => {
    const ajeno: FragmentoDocumental = {
      attributes: { instanciaId: "clzOTRA0000000000000", agenteId: "clzOTROAGENTE0000000", documentoId: "d" },
      filename: "clzOTRA0000000000000_clzOTROAGENTE0000000_d_secreto-de-la-competencia.pdf",
    };
    const resultado = verificarResultados([ajeno], INSTANCIA, AGENTE);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      // El motivo termina en los logs: filtrar datos del otro comercio ahí
      // sería el mismo problema, solo que en otro lado.
      expect(resultado.motivo).not.toContain("secreto-de-la-competencia");
    }
  });
});
