/**
 * Tablas de animación de la mascota de Karia. Puro a propósito (sin React ni
 * DOM): es la única fuente de verdad de qué frames del sprite se muestran en
 * cada combinación, y por eso se testea en `animacion.test.ts`.
 *
 * Índices 0–15 por filas de la cuadrícula original (ver
 * specs/038-asistente-karia-flotante/research.md, Decisión 5). La cuadrícula
 * no trae frames de "pensando": se compone con ojos entrecerrados/cerrados más
 * balanceo y tres puntos.
 */

export type KariaState = "idle" | "thinking" | "success";
export type KariaEmotion = "neutral" | "happy" | "calm";

export type SecuenciaFrames = {
  frames: readonly number[];
  msPorFrame: number;
  bucle: boolean;
};

export type EfectoKaria = "ninguno" | "balanceo" | "rebote";

export type AnimacionResuelta = {
  base: SecuenciaFrames;
  efecto: EfectoKaria;
  puntos: boolean;
  admitePestaneo: boolean;
  /** Frame fijo cuando el usuario pide reducir movimiento. */
  frameReducido: number;
};

export const TOTAL_FRAMES = 16;
export const DURACION_EXITO_MS = 900;

const FRAME_FELIZ = 6;
const FRAME_OJOS_CERRADOS = 8;

const REPOSO: SecuenciaFrames = {
  frames: [0, 1, 2, 3, 12, 13, 14, 15, 14, 13, 12, 3, 2, 1],
  msPorFrame: 350,
  bucle: true,
};

const TRANQUILA: SecuenciaFrames = { frames: [7, 8, 9, 8], msPorFrame: 600, bucle: true };

const FELIZ: SecuenciaFrames = { frames: [FRAME_FELIZ], msPorFrame: 1000, bucle: true };

const PENSANDO: SecuenciaFrames = { frames: [5, 7, 8, 7], msPorFrame: 400, bucle: true };

const EXITO: SecuenciaFrames = { frames: [FRAME_FELIZ], msPorFrame: DURACION_EXITO_MS, bucle: false };

export const SECUENCIA_PESTANEO: SecuenciaFrames = {
  frames: [4, 5, 7, 9, 10, 11],
  msPorFrame: 70,
  bucle: false,
};

export function resolverAnimacion({
  state,
  emotion,
}: {
  state: KariaState;
  emotion: KariaEmotion;
}): AnimacionResuelta {
  if (state === "thinking") {
    return {
      base: PENSANDO,
      efecto: "balanceo",
      puntos: true,
      admitePestaneo: false,
      frameReducido: FRAME_OJOS_CERRADOS,
    };
  }
  if (state === "success") {
    return { base: EXITO, efecto: "rebote", puntos: false, admitePestaneo: false, frameReducido: FRAME_FELIZ };
  }
  if (emotion === "happy") {
    return { base: FELIZ, efecto: "ninguno", puntos: false, admitePestaneo: false, frameReducido: FRAME_FELIZ };
  }
  if (emotion === "calm") {
    return {
      base: TRANQUILA,
      efecto: "ninguno",
      puntos: false,
      admitePestaneo: false,
      frameReducido: FRAME_OJOS_CERRADOS,
    };
  }
  // Pestañear solo tiene sentido con los ojos abiertos.
  return { base: REPOSO, efecto: "ninguno", puntos: false, admitePestaneo: true, frameReducido: 0 };
}

export function duracionSecuencia(secuencia: SecuenciaFrames) {
  return secuencia.frames.length * secuencia.msPorFrame;
}

/** Intervalo aleatorio entre pestañeos, en [3000, 6000) ms. */
export function intervaloParpadeo(aleatorio: number = Math.random()) {
  return 3000 + aleatorio * 3000;
}

/**
 * `background-position` del frame `indice` con `background-size: 1600% 100%`:
 * en porcentajes el desplazamiento es `(contenedor − imagen) · p`, así que el
 * frame i cae en `i / 15`, independiente del tamaño en pantalla.
 */
export function posicionFrame(indice: number) {
  return `${(indice / (TOTAL_FRAMES - 1)) * 100}% 0%`;
}

/** Frame que corresponde a `transcurrido` ms dentro de una secuencia. */
export function frameEn(secuencia: SecuenciaFrames, transcurrido: number) {
  const paso = Math.floor(Math.max(0, transcurrido) / secuencia.msPorFrame);
  const total = secuencia.frames.length;
  const indice = secuencia.bucle ? paso % total : Math.min(paso, total - 1);
  return secuencia.frames[indice];
}
