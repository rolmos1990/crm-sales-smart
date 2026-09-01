import { describe, expect, it } from "vitest";
import { decidirAutonomia } from "./gate";
import type { AutonomiaIntencionConfigItem, ClasificacionIntencion } from "./tipos";
import type { CategoriaIntencionAutonomia, NivelAutonomia } from "@/generated/prisma/enums";
import type { PerfilCliente } from "@/ai/perfil-cliente/tipos";

function mapaConfig(filas: Array<Pick<AutonomiaIntencionConfigItem, "categoria" | "nivel"> & { condicionesConfianza?: AutonomiaIntencionConfigItem["condicionesConfianza"] }>) {
  const mapa = new Map<CategoriaIntencionAutonomia, AutonomiaIntencionConfigItem>();
  for (const fila of filas) {
    mapa.set(fila.categoria, { categoria: fila.categoria, nivel: fila.nivel, condicionesConfianza: fila.condicionesConfianza ?? null });
  }
  return mapa;
}

function clasificacion(categoria: CategoriaIntencionAutonomia, confianza = 0.9): ClasificacionIntencion {
  return { categorias: [{ categoria, confianza }] };
}

describe("decidirAutonomia (016, Historia 2)", () => {
  it("configsPorCategoria === null → siempre ENVIAR sin importar la clasificación (FR-004)", () => {
    const resultado = decidirAutonomia(null, clasificacion("RECLAMO"));
    expect(resultado.accion).toBe("ENVIAR");
  });

  it("clasificacion === null (fallo del clasificador) → siempre ENVIAR (FR-010)", () => {
    const configs = mapaConfig([{ categoria: "RECLAMO", nivel: "HUMAN_ONLY" }]);
    const resultado = decidirAutonomia(configs, null);
    expect(resultado.accion).toBe("ENVIAR");
  });

  it("HUMAN_ONLY → NO_GENERAR", () => {
    const configs = mapaConfig([{ categoria: "RECLAMO", nivel: "HUMAN_ONLY" }]);
    const resultado = decidirAutonomia(configs, clasificacion("RECLAMO"));
    expect(resultado.accion).toBe("NO_GENERAR");
    expect(resultado.categoriaAplicada).toBe("RECLAMO");
  });

  it("SUGGESTION_ONLY → PENDIENTE", () => {
    const configs = mapaConfig([{ categoria: "CONSULTA_PRECIO", nivel: "SUGGESTION_ONLY" }]);
    const resultado = decidirAutonomia(configs, clasificacion("CONSULTA_PRECIO"));
    expect(resultado.accion).toBe("PENDIENTE");
  });

  it("AUTO_REPLY_SAFE_INTENTS → ENVIAR", () => {
    const configs = mapaConfig([{ categoria: "SALUDO", nivel: "AUTO_REPLY_SAFE_INTENTS" }]);
    const resultado = decidirAutonomia(configs, clasificacion("SALUDO"));
    expect(resultado.accion).toBe("ENVIAR");
  });

  it("CONDITIONAL_AUTOMATION con condiciones cumplidas → ENVIAR", () => {
    const configs = mapaConfig([
      { categoria: "RECOMENDACION", nivel: "CONDITIONAL_AUTOMATION", condicionesConfianza: { confianzaMinimaClasificacion: 0.8 } },
    ]);
    const resultado = decidirAutonomia(configs, clasificacion("RECOMENDACION", 0.9));
    expect(resultado.accion).toBe("ENVIAR");
  });

  it("CONDITIONAL_AUTOMATION con confianza insuficiente → PENDIENTE", () => {
    const configs = mapaConfig([
      { categoria: "RECOMENDACION", nivel: "CONDITIONAL_AUTOMATION", condicionesConfianza: { confianzaMinimaClasificacion: 0.8 } },
    ]);
    const resultado = decidirAutonomia(configs, clasificacion("RECOMENDACION", 0.5));
    expect(resultado.accion).toBe("PENDIENTE");
  });

  it("CONDITIONAL_AUTOMATION sin condiciones definidas → PENDIENTE (Edge Case)", () => {
    const configs = mapaConfig([{ categoria: "RECOMENDACION", nivel: "CONDITIONAL_AUTOMATION" }]);
    const resultado = decidirAutonomia(configs, clasificacion("RECOMENDACION", 0.99));
    expect(resultado.accion).toBe("PENDIENTE");
  });

  it("CONDITIONAL_AUTOMATION con requiereAusenciaSenalClienteMolestoEnPerfil y perfil no disponible → PENDIENTE", () => {
    const configs = mapaConfig([
      { categoria: "RECOMENDACION", nivel: "CONDITIONAL_AUTOMATION", condicionesConfianza: { requiereAusenciaSenalClienteMolestoEnPerfil: true } },
    ]);
    const resultado = decidirAutonomia(configs, clasificacion("RECOMENDACION"), null);
    expect(resultado.accion).toBe("PENDIENTE");
  });

  it("CONDITIONAL_AUTOMATION con requiereAusenciaSenalClienteMolestoEnPerfil y perfil sin incidencias → ENVIAR", () => {
    const configs = mapaConfig([
      { categoria: "RECOMENDACION", nivel: "CONDITIONAL_AUTOMATION", condicionesConfianza: { requiereAusenciaSenalClienteMolestoEnPerfil: true } },
    ]);
    const perfil = {
      datosObjetivos: { incidenciasActivas: 0 },
      datosInterpretados: { intencionComercialActual: "EXPLORANDO" },
    } as unknown as PerfilCliente;
    const resultado = decidirAutonomia(configs, clasificacion("RECOMENDACION"), perfil);
    expect(resultado.accion).toBe("ENVIAR");
  });

  it("doble categoría candidata: se aplica el nivel más severo (research.md Decisión 5)", () => {
    const configs = mapaConfig([
      { categoria: "SALUDO", nivel: "AUTO_REPLY_SAFE_INTENTS" },
      { categoria: "RECLAMO", nivel: "HUMAN_ONLY" },
    ]);
    const dobleClasificacion: ClasificacionIntencion = {
      categorias: [
        { categoria: "SALUDO", confianza: 0.9 },
        { categoria: "RECLAMO", confianza: 0.8 },
      ],
    };
    const resultado = decidirAutonomia(configs, dobleClasificacion);
    expect(resultado.accion).toBe("NO_GENERAR");
    expect(resultado.categoriaAplicada).toBe("RECLAMO");
  });

  it("categoría detectada sin fila propia se trata como segura por defecto → ENVIAR", () => {
    const configs = mapaConfig([{ categoria: "RECLAMO", nivel: "HUMAN_ONLY" }]);
    const resultado = decidirAutonomia(configs, clasificacion("SALUDO"));
    expect(resultado.accion).toBe("ENVIAR");
  });
});
