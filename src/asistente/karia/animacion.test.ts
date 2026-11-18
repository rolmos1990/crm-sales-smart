import { describe, expect, it } from "vitest";
import {
  DURACION_EXITO_MS,
  SECUENCIA_PESTANEO,
  TOTAL_FRAMES,
  duracionSecuencia,
  frameEn,
  intervaloParpadeo,
  posicionFrame,
  resolverAnimacion,
  type KariaEmotion,
  type KariaState,
} from "./animacion";

const ESTADOS: KariaState[] = ["idle", "thinking", "success"];
const EMOCIONES: KariaEmotion[] = ["neutral", "happy", "calm"];
const COMBINACIONES = ESTADOS.flatMap((state) => EMOCIONES.map((emotion) => ({ state, emotion })));

describe("resolverAnimacion", () => {
  it("solo usa frames que existen en el sprite", () => {
    const secuencias = [SECUENCIA_PESTANEO, ...COMBINACIONES.map((c) => resolverAnimacion(c).base)];
    for (const { frames } of secuencias) {
      for (const f of frames) {
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThan(TOTAL_FRAMES);
      }
    }
    for (const c of COMBINACIONES) {
      const { frameReducido } = resolverAnimacion(c);
      expect(frameReducido).toBeGreaterThanOrEqual(0);
      expect(frameReducido).toBeLessThan(TOTAL_FRAMES);
    }
  });

  it("success se reproduce una vez, rebota y dura menos de 2 s", () => {
    for (const emotion of EMOCIONES) {
      const r = resolverAnimacion({ state: "success", emotion });
      expect(r.base.bucle).toBe(false);
      expect(r.efecto).toBe("rebote");
      expect(duracionSecuencia(r.base)).toBeLessThan(2000);
      expect(DURACION_EXITO_MS).toBeLessThan(2000);
    }
  });

  it("thinking balancea y muestra los tres puntos", () => {
    const r = resolverAnimacion({ state: "thinking", emotion: "neutral" });
    expect(r.efecto).toBe("balanceo");
    expect(r.puntos).toBe(true);
    expect(r.base.bucle).toBe(true);
  });

  it("solo admite pestañeo en idle + neutral", () => {
    for (const c of COMBINACIONES) {
      const esperado = c.state === "idle" && c.emotion === "neutral";
      expect(resolverAnimacion(c).admitePestaneo).toBe(esperado);
    }
  });

  it("ignora la emoción en thinking y success", () => {
    for (const state of ["thinking", "success"] as const) {
      const base = resolverAnimacion({ state, emotion: "neutral" });
      for (const emotion of EMOCIONES) {
        expect(resolverAnimacion({ state, emotion })).toEqual(base);
      }
    }
  });
});

describe("intervaloParpadeo", () => {
  it("queda entre 3 y 6 segundos", () => {
    expect(intervaloParpadeo(0)).toBe(3000);
    expect(intervaloParpadeo(0.999)).toBeLessThan(6000);
    expect(intervaloParpadeo(0.5)).toBeGreaterThanOrEqual(3000);
  });

  it("el pestañeo completo es corto y no se repite", () => {
    expect(SECUENCIA_PESTANEO.bucle).toBe(false);
    expect(duracionSecuencia(SECUENCIA_PESTANEO)).toBeLessThan(600);
  });
});

describe("frameEn", () => {
  const secuencia = { frames: [3, 4, 5], msPorFrame: 100, bucle: true };

  it("avanza un frame por intervalo y da la vuelta en bucle", () => {
    expect(frameEn(secuencia, 0)).toBe(3);
    expect(frameEn(secuencia, 150)).toBe(4);
    expect(frameEn(secuencia, 300)).toBe(3);
  });

  it("se queda en el último frame si no es bucle", () => {
    expect(frameEn({ ...secuencia, bucle: false }, 10_000)).toBe(5);
  });
});

describe("posicionFrame", () => {
  it("mapea el primer y último frame a los extremos", () => {
    expect(posicionFrame(0)).toBe("0% 0%");
    expect(posicionFrame(TOTAL_FRAMES - 1)).toBe("100% 0%");
  });
});
