import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { expiracionNueva, firmarToken, verificarToken, VIDA_TOKEN_SEGUNDOS, vistaHabilitada } from "./token";

const SECRETO = "secreto-de-prueba-de-al-menos-32-bytes!!";
const AHORA = Date.UTC(2026, 10, 16, 12, 0, 0);

function base(extra: Partial<Parameters<typeof firmarToken>[0]> = {}) {
  return {
    tipo: "vista" as const,
    mensajeId: "msg_1",
    instanciaId: "inst_A",
    imagenes: false,
    exp: expiracionNueva(AHORA),
    ...extra,
  };
}

describe("token de la vista aislada de correos", () => {
  const original = process.env.CORREO_VISTA_SECRETO;
  beforeEach(() => {
    process.env.CORREO_VISTA_SECRETO = SECRETO;
  });
  afterEach(() => {
    process.env.CORREO_VISTA_SECRETO = original;
  });

  it("un token válido se verifica y devuelve su payload", () => {
    const token = firmarToken(base())!;
    expect(verificarToken(token, "vista", AHORA)).toMatchObject({
      tipo: "vista",
      mensajeId: "msg_1",
      instanciaId: "inst_A",
      imagenes: false,
    });
  });

  it("alterar un carácter de la firma lo invalida", () => {
    const token = firmarToken(base())!;
    const ultimo = token.at(-1) === "A" ? "B" : "A";
    expect(verificarToken(token.slice(0, -1) + ultimo, "vista", AHORA)).toBeNull();
  });

  it("cambiar el payload conservando la firma original lo invalida", () => {
    const token = firmarToken(base())!;
    const [, firma] = token.split(".");
    const otro = firmarToken(base({ instanciaId: "inst_B" }))!.split(".")[0];
    expect(verificarToken(`${otro}.${firma}`, "vista", AHORA)).toBeNull();
  });

  it("un token vencido no sirve", () => {
    const token = firmarToken(base())!;
    const despues = AHORA + (VIDA_TOKEN_SEGUNDOS + 1) * 1000;
    expect(verificarToken(token, "vista", despues)).toBeNull();
  });

  it("un token con vida mayor a 15 minutos no se acepta", () => {
    const token = firmarToken(base({ exp: Math.floor(AHORA / 1000) + VIDA_TOKEN_SEGUNDOS + 60 }))!;
    expect(verificarToken(token, "vista", AHORA)).toBeNull();
  });

  it("un token de vista no sirve como token de cid ni de imagen", () => {
    const token = firmarToken(base())!;
    expect(verificarToken(token, "cid", AHORA)).toBeNull();
    expect(verificarToken(token, "imagen", AHORA)).toBeNull();
  });

  it("un token firmado con otro secreto no se acepta", () => {
    process.env.CORREO_VISTA_SECRETO = "otro-secreto-distinto-de-32-bytes-o-mas!!";
    const ajeno = firmarToken(base({ instanciaId: "inst_B" }))!;
    process.env.CORREO_VISTA_SECRETO = SECRETO;
    expect(verificarToken(ajeno, "vista", AHORA)).toBeNull();
  });

  it("sin secreto falla cerrado: no firma ni verifica", () => {
    const token = firmarToken(base())!;
    delete process.env.CORREO_VISTA_SECRETO;
    expect(vistaHabilitada()).toBe(false);
    expect(firmarToken(base())).toBeNull();
    expect(verificarToken(token, "vista", AHORA)).toBeNull();
  });

  it("un secreto de menos de 32 bytes equivale a no tener secreto", () => {
    process.env.CORREO_VISTA_SECRETO = "corto";
    expect(firmarToken(base())).toBeNull();
  });

  it("basura, vacío o formatos raros devuelven null sin lanzar", () => {
    for (const t of ["", "abc", "a.b.c", ".", "x".repeat(5000), null, undefined]) {
      expect(verificarToken(t, "vista", AHORA)).toBeNull();
    }
  });
});
