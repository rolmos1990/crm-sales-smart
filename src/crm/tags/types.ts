export interface Tag {
  id: string;
  nombre: string;
  color: string | null;
  activo: boolean;
  creadoEn: Date;
  instanciaId: string | null;
}

export interface ResultadoAccion<T = undefined> {
  exito: boolean;
  error?: string;
  datos?: T;
}

export const COLORES_TAG = [
  { valor: "#a3e635", etiqueta: "Lima" },
  { valor: "#34d399", etiqueta: "Esmeralda" },
  { valor: "#22d3ee", etiqueta: "Cian" },
  { valor: "#60a5fa", etiqueta: "Azul" },
  { valor: "#a78bfa", etiqueta: "Violeta" },
  { valor: "#f472b6", etiqueta: "Rosa" },
  { valor: "#fb923c", etiqueta: "Naranja" },
  { valor: "#f87171", etiqueta: "Rojo" },
  { valor: "#fbbf24", etiqueta: "Ámbar" },
  { valor: "#a8a29e", etiqueta: "Piedra" },
] as const;
