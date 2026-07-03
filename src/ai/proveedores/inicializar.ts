// Registra todos los proveedores disponibles al arrancar.
// Importar este archivo una sola vez en el entry point del bounded context.
import { registrarProveedor } from "./registro";
import { crearAnthropicProvider } from "./anthropic";
import { crearDeepSeekProvider } from "./deepseek";
import { crearNvidiaProvider } from "./nvidia";

registrarProveedor("ANTHROPIC", (apiKey, modelo) => crearAnthropicProvider(apiKey, modelo));
registrarProveedor("DEEPSEEK", (apiKey, modelo) => crearDeepSeekProvider(apiKey, modelo));
registrarProveedor("NVIDIA", (apiKey, modelo) => crearNvidiaProvider(apiKey, modelo));
