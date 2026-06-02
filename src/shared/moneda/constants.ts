export const MONEDAS = [
  { valor: "PAB", etiqueta: "PAB — Balboa Panameño" },
  { valor: "USD", etiqueta: "USD — Dólar Americano" },
  { valor: "PEN", etiqueta: "PEN — Sol Peruano" },
  { valor: "COP", etiqueta: "COP — Peso Colombiano" },
  { valor: "MXN", etiqueta: "MXN — Peso Mexicano" },
  { valor: "ARS", etiqueta: "ARS — Peso Argentino" },
  { valor: "CLP", etiqueta: "CLP — Peso Chileno" },
  { valor: "EUR", etiqueta: "EUR — Euro" },
] as const;

export const MONEDA_DEFAULT = "PEN";

export type CodigoMoneda = (typeof MONEDAS)[number]["valor"];
