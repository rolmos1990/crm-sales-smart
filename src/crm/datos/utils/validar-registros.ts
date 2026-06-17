import type {
  MapeoColumna,
  DefinicionCampo,
  ResultadoValidacion,
  ErrorFila,
} from "../types";

export function validarRegistros(
  filas: Record<string, string>[],
  mapeos: MapeoColumna[],
  camposDestino: DefinicionCampo[],
): ResultadoValidacion {
  const mapeoActivos = mapeos.filter(
    (m) => (m.accion === "mapear" || m.accion === "crear") && m.campoDestino,
  );

  const erroresTotal: ErrorFila[] = [];
  const filasValidas: Record<string, unknown>[] = [];
  const filasConError: Record<string, string>[] = [];

  filas.forEach((fila, idx) => {
    const erroresFila: ErrorFila[] = [];
    const filaTransformada: Record<string, unknown> = {};

    for (const mapeo of mapeoActivos) {
      const clave = mapeo.campoDestino!;
      const valorRaw = fila[mapeo.columnaArchivo] ?? "";
      const def = camposDestino.find((c) => c.clave === clave);

      if (def?.requerido && (!valorRaw || valorRaw.trim() === "")) {
        erroresFila.push({
          fila: idx + 2,
          campo: clave,
          mensaje: `El campo "${def.etiqueta}" es requerido`,
          valor: valorRaw,
        });
        continue;
      }

      if (!valorRaw || valorRaw.trim() === "") {
        filaTransformada[clave] = null;
        continue;
      }

      switch (def?.tipo) {
        case "email": {
          const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRe.test(valorRaw.trim())) {
            erroresFila.push({
              fila: idx + 2,
              campo: clave,
              mensaje: "Email inválido",
              valor: valorRaw,
            });
          } else {
            filaTransformada[clave] = valorRaw.trim().toLowerCase();
          }
          break;
        }
        case "numero": {
          const n = Number(valorRaw.replace(",", "."));
          if (isNaN(n)) {
            erroresFila.push({
              fila: idx + 2,
              campo: clave,
              mensaje: "Debe ser un número válido",
              valor: valorRaw,
            });
          } else {
            filaTransformada[clave] = n;
          }
          break;
        }
        case "fecha": {
          const d = new Date(valorRaw);
          if (isNaN(d.getTime())) {
            erroresFila.push({
              fila: idx + 2,
              campo: clave,
              mensaje: "Fecha inválida (use YYYY-MM-DD o DD/MM/YYYY)",
              valor: valorRaw,
            });
          } else {
            filaTransformada[clave] = d.toISOString();
          }
          break;
        }
        case "enum": {
          const validos = def.valoresEnum ?? [];
          const valorNorm = valorRaw.trim().toUpperCase();
          if (validos.length > 0 && !validos.includes(valorNorm)) {
            erroresFila.push({
              fila: idx + 2,
              campo: clave,
              mensaje: `Valor inválido. Opciones: ${validos.join(", ")}`,
              valor: valorRaw,
            });
          } else {
            filaTransformada[clave] = valorNorm;
          }
          break;
        }
        default:
          filaTransformada[clave] = valorRaw.trim();
      }
    }

    if (erroresFila.length > 0) {
      erroresTotal.push(...erroresFila);
      filasConError.push(fila as Record<string, string>);
    } else {
      filasValidas.push(filaTransformada);
    }
  });

  return {
    total: filas.length,
    validos: filasValidas.length,
    conError: filasConError.length,
    errores: erroresTotal,
    filasValidas,
    filasConError,
  };
}
