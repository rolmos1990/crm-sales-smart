// Reglas de bloqueo progresivo por intentos fallidos de login.
// Nivel 1: 10 min, Nivel 2: 30 min, Nivel 3+: 1 día.
export const INTENTOS_MAXIMOS = 5;

const DURACIONES_BLOQUEO_MS = [10 * 60 * 1000, 30 * 60 * 1000, 24 * 60 * 60 * 1000];

export type EstadoBloqueo = {
  intentosFallidos: number;
  nivelBloqueo: number;
  bloqueadoHasta: Date | null;
};

export function estaBloqueado(estado: Pick<EstadoBloqueo, "bloqueadoHasta">): boolean {
  return !!estado.bloqueadoHasta && estado.bloqueadoHasta > new Date();
}

// Calcula el nuevo estado de bloqueo tras un intento fallido de login.
export function registrarIntentoFallido(estado: EstadoBloqueo): EstadoBloqueo {
  // Si el bloqueo anterior ya expiró, reiniciamos el contador de intentos
  // pero conservamos el nivel para que el próximo bloqueo escale.
  const intentosPrevios =
    estado.bloqueadoHasta && estado.bloqueadoHasta <= new Date() ? 0 : estado.intentosFallidos;

  const intentosFallidos = intentosPrevios + 1;

  if (intentosFallidos < INTENTOS_MAXIMOS) {
    return { intentosFallidos, nivelBloqueo: estado.nivelBloqueo, bloqueadoHasta: null };
  }

  const nivelBloqueo = Math.min(estado.nivelBloqueo + 1, DURACIONES_BLOQUEO_MS.length);
  const duracionMs = DURACIONES_BLOQUEO_MS[nivelBloqueo - 1];

  return {
    intentosFallidos: 0,
    nivelBloqueo,
    bloqueadoHasta: new Date(Date.now() + duracionMs),
  };
}

export function limpiarBloqueo(): EstadoBloqueo {
  return { intentosFallidos: 0, nivelBloqueo: 0, bloqueadoHasta: null };
}
