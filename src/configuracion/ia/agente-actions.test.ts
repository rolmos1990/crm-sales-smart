import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { AgenteIAConfigSchema } from "./agente-schema";

const sesionMock = {
  usuarioId: "usuario-1",
  nombre: "Admin",
  email: "admin@test.com",
  instanciaId: "instancia-1",
  usuarioInstanciaId: "ui-1",
  rol: "ADMIN" as const,
};

vi.mock("@/shared/auth/sesion", () => ({
  requireSesion: () => Promise.resolve(sesionMock),
}));

vi.mock("@/shared/auth/permisos", () => ({
  verificarAcceso: () => ({ permitido: true }),
}));

const agenteFindFirst = vi.fn();
const agenteUpdate = vi.fn();
const versionCreate = vi.fn();
const versionUpdate = vi.fn();
const versionFindFirst = vi.fn();

vi.mock("@/shared/db/prisma", () => {
  const tx = {
    agenteIAConfigVersion: {
      findFirst: (...a: unknown[]) => versionFindFirst(...a),
      update: (...a: unknown[]) => versionUpdate(...a),
      create: (...a: unknown[]) => versionCreate(...a),
    },
    agenteIAConfig: { update: (...a: unknown[]) => agenteUpdate(...a) },
  };
  return {
    prisma: {
      ...tx,
      agenteIAConfig: {
        findFirst: (...a: unknown[]) => agenteFindFirst(...a),
        update: (...a: unknown[]) => agenteUpdate(...a),
      },
      $transaction: (cb: (t: typeof tx) => unknown) => cb(tx),
    },
  };
});

const obtenerBorradorActivo = vi.fn();
const obtenerVersionAgenteIA = vi.fn();
vi.mock("./agente-queries", () => ({
  obtenerBorradorActivo: (...a: unknown[]) => obtenerBorradorActivo(...a),
  obtenerVersionAgenteIA: (...a: unknown[]) => obtenerVersionAgenteIA(...a),
  listarVersionesAgenteIA: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { guardarBorradorAgenteIA, publicarVersionAgenteIA, restaurarVersionAgenteIA } = await import("./agente-actions");

const baseAgente = { memoriaHabilitada: true, limiteTokensCtx: 4000 };

const respuestaPrecio = {
  id: "r1",
  intencion: "PRECIO" as const,
  cuandoAplica: "el cliente pregunta el precio sin nombrar producto",
  formato: "¡Hola {nombreCliente}! Nuestros precios: … ¿Cuál te interesa?",
  activa: true,
};

describe("028-respuestas-guia-catalogo-ia — versionado del agente", () => {
  beforeEach(() => {
    for (const m of [agenteFindFirst, agenteUpdate, versionCreate, versionUpdate, versionFindFirst, obtenerBorradorActivo, obtenerVersionAgenteIA]) {
      m.mockReset();
    }
    agenteFindFirst.mockResolvedValue({ id: "agente-1" });
    versionCreate.mockResolvedValue({ id: "version-1" });
    versionUpdate.mockResolvedValue({ id: "version-1" });
    versionFindFirst.mockResolvedValue({ numero: 3 });
  });

  it("el borrador guarda respuestasGuia y la configuración de catálogo tal cual", async () => {
    obtenerBorradorActivo.mockResolvedValue(null);

    const r = await guardarBorradorAgenteIA("agente-1", {
      ...baseAgente,
      respuestasGuia: [respuestaPrecio],
      catalogoEnContexto: false,
      limiteCatalogoContexto: 12,
    });

    expect(r.exito).toBe(true);
    const contenido = versionCreate.mock.calls[0][0].data.contenido;
    expect(contenido.respuestasGuia).toEqual([respuestaPrecio]);
    expect(contenido.catalogoEnContexto).toBe(false);
    expect(contenido.limiteCatalogoContexto).toBe(12);
  });

  it("publicar aplica las respuestas guía a la fila viva del agente", async () => {
    obtenerBorradorActivo.mockResolvedValue({
      id: "borrador-1",
      contenido: { ...baseAgente, respuestasGuia: [respuestaPrecio], catalogoEnContexto: true, limiteCatalogoContexto: 30 },
    });

    const r = await publicarVersionAgenteIA("agente-1");

    expect(r.exito).toBe(true);
    const data = agenteUpdate.mock.calls[0][0].data;
    expect(data.respuestasGuia).toEqual([respuestaPrecio]);
    expect(data.catalogoEnContexto).toBe(true);
    expect(data.limiteCatalogoContexto).toBe(30);
  });

  it("restaurar una versión anterior a 028 deja sin respuestas guía y con el catálogo activo", async () => {
    obtenerVersionAgenteIA.mockResolvedValue({
      id: "v-vieja",
      agenteIAConfigId: "agente-1",
      estado: "PUBLICADA",
      contenido: { ...baseAgente },
    });

    const r = await restaurarVersionAgenteIA("v-vieja");

    expect(r.exito).toBe(true);
    const data = agenteUpdate.mock.calls[0][0].data;
    expect(data.respuestasGuia).toBe(Prisma.JsonNull);
    expect(data.catalogoEnContexto).toBe(true);
    expect(data.limiteCatalogoContexto).toBe(30);
  });
});

describe("028-respuestas-guia-catalogo-ia — validación del servidor", () => {
  it("rechaza más de 15 respuestas guía", () => {
    const muchas = Array.from({ length: 16 }, (_, i) => ({ ...respuestaPrecio, id: `r${i}` }));
    expect(AgenteIAConfigSchema.safeParse({ ...baseAgente, respuestasGuia: muchas }).success).toBe(false);
  });

  it("rechaza un formato de más de 1000 caracteres", () => {
    const larga = { ...respuestaPrecio, formato: "x".repeat(1001) };
    expect(AgenteIAConfigSchema.safeParse({ ...baseAgente, respuestasGuia: [larga] }).success).toBe(false);
  });

  it("rechaza ids duplicados", () => {
    expect(
      AgenteIAConfigSchema.safeParse({ ...baseAgente, respuestasGuia: [respuestaPrecio, { ...respuestaPrecio }] }).success,
    ).toBe(false);
  });

  it("rechaza un límite de catálogo fuera de 1-100", () => {
    expect(AgenteIAConfigSchema.safeParse({ ...baseAgente, limiteCatalogoContexto: 0 }).success).toBe(false);
    expect(AgenteIAConfigSchema.safeParse({ ...baseAgente, limiteCatalogoContexto: 101 }).success).toBe(false);
  });

  it("acepta un agente sin los campos nuevos (retrocompatible)", () => {
    expect(AgenteIAConfigSchema.safeParse(baseAgente).success).toBe(true);
  });
});
