import { reconectarSesionesWA } from "@/integraciones/whatsapp-lite/reconectar";
import { SSERelaySuscriptor } from "@/suscriptores/sse/sse-relay.suscriptor";

// Módulo de efecto lateral: se ejecuta una sola vez al cargar (guards en globalThis).
// Importar desde el root layout garantiza que el relay SSE y las sesiones WA
// arrancan en el primer request a cualquier página, sin depender del SSE.
reconectarSesionesWA();
void new SSERelaySuscriptor().iniciar();
