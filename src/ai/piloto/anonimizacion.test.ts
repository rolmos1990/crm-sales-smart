import { describe, expect, it } from "vitest";
import { anonimizarContenido } from "./anonimizacion";

const contacto = {
  nombre: "Juan",
  apellido: "Pérez",
  email: "juan.perez@example.com",
  telefonoPrincipal: "+51 999 888 777",
  telefonoSecundario: null,
};

describe("anonimizarContenido (014, Historia 1)", () => {
  it("sustituye nombre, apellido, email y teléfono conocidos por marcadores fijos", () => {
    const resultado = anonimizarContenido(
      [
        { rol: "user", texto: "Hola, soy Juan Pérez, mi correo es juan.perez@example.com" },
        { rol: "user", texto: "Mi número es +51 999 888 777, ¿me pueden llamar?" },
      ],
      contacto,
    );
    expect(resultado.mensajes[0].texto).toBe("Hola, soy [NOMBRE] [NOMBRE], mi correo es [EMAIL]");
    expect(resultado.mensajes[1].texto).toBe("Mi número es [TELÉFONO], ¿me pueden llamar?");
  });

  it("deja el resto del texto intacto", () => {
    const resultado = anonimizarContenido(
      [{ rol: "assistant", texto: "Claro, tenemos el producto X disponible en 3 colores." }],
      contacto,
    );
    expect(resultado.mensajes[0].texto).toBe("Claro, tenemos el producto X disponible en 3 colores.");
  });

  it("no falla con campos de contacto nulos (email/teléfono ausentes)", () => {
    const resultado = anonimizarContenido(
      [{ rol: "user", texto: "Hola, quiero info del producto." }],
      { nombre: "Ana", apellido: "Gómez", email: null, telefonoPrincipal: null, telefonoSecundario: null },
    );
    expect(resultado.mensajes[0].texto).toBe("Hola, quiero info del producto.");
  });

  it("es case-insensitive para nombre/apellido", () => {
    const resultado = anonimizarContenido([{ rol: "user", texto: "soy juan PÉREZ" }], contacto);
    expect(resultado.mensajes[0].texto).toBe("soy [NOMBRE] [NOMBRE]");
  });
});
