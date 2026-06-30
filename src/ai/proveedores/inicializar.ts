// Registra todos los proveedores disponibles al arrancar.
// Importar este archivo una sola vez en el entry point del bounded context.
import { registrarProveedor } from "./registro";
import { crearAnthropicProvider } from "./anthropic";

registrarProveedor("ANTHROPIC", (apiKey, modelo) => crearAnthropicProvider(apiKey, modelo));
