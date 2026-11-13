import { describe, expect, it } from "vitest";
import { filtrarProvincia, PUNTAJE } from "./filtro-provincia";

// Combobox arma las keywords así: [etiqueta, subtitulo?, ...busqueda].
const claves = (nombre: string, ...lugares: string[]) => [
  nombre,
  lugares.length ? `Cubre ${lugares.slice(0, 3).join(", ")}` : undefined,
  ...lugares,
].filter((v): v is string => !!v);

const COCLE = claves("Coclé Province (CL)", "Penonomé", "Aguadulce", "El Valle de Antón");
const CHIRIQUI = claves("Chiriquí Province (CH)", "Boquete", "David", "Volcán", "Puerto Armuelles");
const BOCAS = claves("Bocas del Toro Province (BT)", "Changuinola", "Almirante", "Isla Colón");
const PANAMA = claves("Panamá Province (PA)", "Ciudad de Panamá", "Albrook", "Tumba Muerto");

const puntaje = (busqueda: string, keywords: string[]) => filtrarProvincia("id", busqueda, keywords);

describe("filtrarProvincia", () => {
  it('"Coclé" muestra Coclé y oculta las que solo comparten letras sueltas', () => {
    // El caso reportado: con el difuso de cmdk aparecían también estas tres.
    expect(puntaje("Coclé", COCLE)).toBe(PUNTAJE.POR_NOMBRE);
    expect(puntaje("Coclé", CHIRIQUI)).toBe(PUNTAJE.OCULTA);
    expect(puntaje("Coclé", BOCAS)).toBe(PUNTAJE.OCULTA);
    expect(puntaje("Coclé", PANAMA)).toBe(PUNTAJE.OCULTA);
  });

  it("sin tilde encuentra igual", () => {
    expect(puntaje("cocle", COCLE)).toBe(PUNTAJE.POR_NOMBRE);
  });

  it('"Boquete" sigue llevando a Chiriquí — la mejora que no hay que perder', () => {
    expect(puntaje("Boquete", CHIRIQUI)).toBe(PUNTAJE.POR_LUGAR);
    expect(puntaje("Boquete", COCLE)).toBe(PUNTAJE.OCULTA);
  });

  it('"Changuinola" lleva a Bocas del Toro y a ninguna otra', () => {
    expect(puntaje("Changuinola", BOCAS)).toBe(PUNTAJE.POR_LUGAR);
    for (const otras of [COCLE, CHIRIQUI, PANAMA]) {
      expect(puntaje("Changuinola", otras)).toBe(PUNTAJE.OCULTA);
    }
  });

  it("el nombre de la provincia pesa más que un lugar — se ordena primero", () => {
    const porNombre = puntaje("Panamá", PANAMA);
    // "Ciudad de Panamá" es un distrito de Panamá: coincide por lugar.
    const porLugar = puntaje("Ciudad de Panamá", PANAMA);
    expect(porNombre).toBeGreaterThan(porLugar);
    expect(porLugar).toBeGreaterThan(PUNTAJE.OCULTA);
  });

  it("coincide por fragmento, no solo por la palabra completa", () => {
    expect(puntaje("Volc", CHIRIQUI)).toBe(PUNTAJE.POR_LUGAR);
    expect(puntaje("Chiri", CHIRIQUI)).toBe(PUNTAJE.POR_NOMBRE);
  });

  it("también por el código de la provincia, que viaja en la etiqueta", () => {
    expect(puntaje("CH", CHIRIQUI)).toBe(PUNTAJE.POR_NOMBRE);
  });

  it("sin búsqueda no oculta nada: cmdk pide puntaje para ordenar la lista entera", () => {
    expect(puntaje("", COCLE)).toBeGreaterThan(PUNTAJE.OCULTA);
    expect(puntaje("   ", COCLE)).toBeGreaterThan(PUNTAJE.OCULTA);
  });

  it("una provincia sin lugares cargados se encuentra igual por su nombre", () => {
    const sinCobertura = claves("Darién Province (DA)");
    expect(puntaje("Darién", sinCobertura)).toBe(PUNTAJE.POR_NOMBRE);
    expect(puntaje("Boquete", sinCobertura)).toBe(PUNTAJE.OCULTA);
  });

  it("sin keywords no muestra la opción en vez de romper", () => {
    expect(puntaje("Coclé", [])).toBe(PUNTAJE.OCULTA);
    expect(filtrarProvincia("id", "Coclé", undefined)).toBe(PUNTAJE.OCULTA);
  });

  it("algo que no está en ningún lado no devuelve nada", () => {
    for (const p of [COCLE, CHIRIQUI, BOCAS, PANAMA]) {
      expect(puntaje("Tokio", p)).toBe(PUNTAJE.OCULTA);
    }
  });
});
