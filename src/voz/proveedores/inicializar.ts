import { registrarProveedorVoz } from "./registro";
import { crearElevenLabsProvider } from "./elevenlabs";
import { crearOpenAIVozProvider } from "./openai";

/**
 * 049 — Registro de los adaptadores de voz. Side-effect de import.
 *
 * Se importa una sola vez, desde el punto de entrada del módulo
 * (`src/voz/transcribir.ts`). Lo que se registre acá tiene que estar también
 * en `PROVEEDORES_VOZ_IMPLEMENTADOS`; `inicializar.test.ts` vigila que no se
 * desincronicen.
 */
registrarProveedorVoz("ELEVENLABS", (apiKey, modelo, baseUrl) =>
  crearElevenLabsProvider(apiKey, modelo, baseUrl),
);

registrarProveedorVoz("OPENAI", (apiKey, modelo, baseUrl) =>
  crearOpenAIVozProvider(apiKey, modelo, baseUrl),
);
