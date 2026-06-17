import { workerMensajes } from "@/shared/workers/worker-mensajes";
import { reconectarSesionesWA } from "@/integraciones/whatsapp-lite/reconectar";
import { registrarHandlersPedidos } from "@/sales/pedidos/handlers";

// Módulo de efecto lateral: se ejecuta una sola vez al cargar (guards en globalThis).
// Importar desde el root layout garantiza que el worker y las sesiones WA
// arrancan en el primer request a cualquier página, sin depender del SSE.
workerMensajes.iniciar();
reconectarSesionesWA();
registrarHandlersPedidos();
