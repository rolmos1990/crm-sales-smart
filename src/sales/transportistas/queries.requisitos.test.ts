import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// obtenerTransportistas es el único punto por el que los transportistas llegan
// a los cinco formularios que muestran los campos exigidos: /cotizaciones/nueva,
// /cotizaciones/[id]/editar, el Sheet de edición, el panel del Workspace de
// oportunidad y la sección de entrega del pedido.
//
// Si alguien le saca `condiciones` del include, los campos "Dirección de
// entrega" e "Identificación" dejan de aparecer en los cinco a la vez, en
// silencio: requisitosDeCondiciones recibe undefined y devuelve "no exige
// nada". Sin este test, el síntoma sería "configuré Requiere identificación y
// no pasa nada".
describe("obtenerTransportistas — requisitos del transportista", () => {
  const fuente = readFileSync(new URL("./queries.ts", import.meta.url), "utf8");

  it("incluye las condiciones que deciden qué campos pide el formulario", () => {
    const [cuerpo] = fuente.split("export async function obtenerTransportista(");
    expect(cuerpo).toContain("requiereDireccionCompleta: true");
    expect(cuerpo).toContain("requiereIdentificacion: true");
  });
});
