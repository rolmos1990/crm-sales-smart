import type { SeparadorCSV } from "../types";

const CANDIDATOS: SeparadorCSV[] = [";", ",", "|", "\t"];

export function detectarSeparador(textoCSV: string): SeparadorCSV {
  const lineas = textoCSV
    .split("\n")
    .map((l) => l.replace(/\r$/, ""))
    .filter((l) => l.trim().length > 0)
    .slice(0, 5);

  if (lineas.length === 0) return ",";

  let mejorSeparador: SeparadorCSV = ",";
  let mejorPuntaje = -1;

  for (const sep of CANDIDATOS) {
    const conteos = lineas.map((l) => {
      let n = 0;
      for (const ch of l) if (ch === sep) n++;
      return n;
    });

    const max = Math.max(...conteos);
    if (max === 0) continue;

    const media = conteos.reduce((a, b) => a + b, 0) / conteos.length;
    const varianza =
      conteos.reduce((s, c) => s + (c - media) ** 2, 0) / conteos.length;

    const puntaje = media * 10 - varianza;

    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejorSeparador = sep;
    }
  }

  return mejorSeparador;
}

export function etiquetaSeparador(sep: SeparadorCSV): string {
  switch (sep) {
    case ";":
      return "Punto y coma (;)";
    case ",":
      return "Coma (,)";
    case "|":
      return "Pipe (|)";
    case "\t":
      return "Tabulación";
  }
}
