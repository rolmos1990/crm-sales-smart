import amqplib from "amqplib";
import { EXCHANGE, DLX, QUEUES, RK } from "./exchanges";

const RABBITMQ_URL = process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672";

// Tiempos de backoff exponencial para reconexión (ms)
const BACKOFF = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];

type ConexionState = {
  connection: Awaited<ReturnType<typeof amqplib.connect>> | null;
  channel: amqplib.Channel | null;
  conectando: boolean;
  intentos: number;
};

const g = globalThis as unknown as { _rmqState?: ConexionState };

function obtenerEstado(): ConexionState {
  if (!g._rmqState) {
    g._rmqState = { connection: null, channel: null, conectando: false, intentos: 0 };
  }
  return g._rmqState;
}

async function configurarTopologia(ch: amqplib.Channel): Promise<void> {
  // Exchange principal (topic) y dead-letter exchange (direct)
  await ch.assertExchange(EXCHANGE, "topic", { durable: true });
  await ch.assertExchange(DLX, "direct", { durable: true });

  // Dead letter queue
  await ch.assertQueue(QUEUES.MUERTOS, { durable: true });
  await ch.bindQueue(QUEUES.MUERTOS, DLX, "#");

  const queueOpts = {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": DLX,
      "x-message-ttl": 86_400_000, // 24h
    },
  };

  // SSE relay (Next.js): eventos de conversaciones y mensajes
  await ch.assertQueue(QUEUES.SSE, queueOpts);
  await ch.bindQueue(QUEUES.SSE, EXCHANGE, "evento.conversacion.*");
  await ch.bindQueue(QUEUES.SSE, EXCHANGE, "evento.mensaje.*");
  await ch.bindQueue(QUEUES.SSE, EXCHANGE, "evento.reaccion.*");

  // Historial de pedidos
  await ch.assertQueue(QUEUES.PEDIDO_HISTORIAL, queueOpts);
  await ch.bindQueue(QUEUES.PEDIDO_HISTORIAL, EXCHANGE, "evento.pedido.*");

  // Comandos de mensajería
  await ch.assertQueue(QUEUES.MENSAJE_ENVIAR, queueOpts);
  await ch.bindQueue(QUEUES.MENSAJE_ENVIAR, EXCHANGE, RK.COMANDO_MENSAJE_ENVIAR);

  await ch.assertQueue(QUEUES.MENSAJE_ENTRANTE, queueOpts);
  await ch.bindQueue(QUEUES.MENSAJE_ENTRANTE, EXCHANGE, RK.COMANDO_MENSAJE_ENTRANTE);

  await ch.assertQueue(QUEUES.MENSAJE_LEIDO, queueOpts);
  await ch.bindQueue(QUEUES.MENSAJE_LEIDO, EXCHANGE, RK.COMANDO_MENSAJE_LEIDO);

  // Comandos de email
  await ch.assertQueue(QUEUES.EMAIL_ENVIAR, queueOpts);
  await ch.bindQueue(QUEUES.EMAIL_ENVIAR, EXCHANGE, RK.COMANDO_EMAIL_ENVIAR);

  // Comandos de sistema
  await ch.assertQueue(QUEUES.SISTEMA_INICIALIZAR, queueOpts);
  await ch.bindQueue(QUEUES.SISTEMA_INICIALIZAR, EXCHANGE, RK.COMANDO_SISTEMA_INICIALIZAR);

  // IA: generación de respuesta
  await ch.assertQueue(QUEUES.AI_RESPUESTA, queueOpts);
  await ch.bindQueue(QUEUES.AI_RESPUESTA, EXCHANGE, RK.COMANDO_AI_GENERAR_RESPUESTA);

  // IA: resumen de conversación
  await ch.assertQueue(QUEUES.AI_RESUMEN, queueOpts);
  await ch.bindQueue(QUEUES.AI_RESUMEN, EXCHANGE, RK.COMANDO_AI_RESUMIR);

  // IA: orquestación — escucha MensajeRecibido con su propia cola para no bloquear SSE
  await ch.assertQueue(QUEUES.AI_ORQUESTAR, queueOpts);
  await ch.bindQueue(QUEUES.AI_ORQUESTAR, EXCHANGE, RK.EVENTO_MENSAJE_RECIBIDO);
}

async function conectar(): Promise<amqplib.Channel> {
  const state = obtenerEstado();

  if (state.channel) return state.channel;
  if (state.conectando) {
    // Esperar a que termine el intento de conexión en curso
    await new Promise<void>((resolve) => {
      const id = setInterval(() => {
        if (!state.conectando) { clearInterval(id); resolve(); }
      }, 100);
    });
    if (state.channel) return state.channel;
    return conectar();
  }

  state.conectando = true;

  // Reintentar indefinidamente con backoff — el proceso no debe morir si RabbitMQ
  // aún no está disponible al arrancar (ej: docker tarda unos segundos)
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const conn = await amqplib.connect(RABBITMQ_URL);
      const ch = await conn.createChannel();

      await configurarTopologia(ch);

      conn.on("error", () => { state.connection = null; state.channel = null; });
      conn.on("close", () => {
        state.connection = null;
        state.channel = null;
        programarReconexion();
      });

      state.connection = conn;
      state.channel = ch;
      state.intentos = 0;
      state.conectando = false;
      console.log("[RabbitMQ] Conectado");
      return ch;
    } catch (err) {
      state.channel = null;
      state.connection = null;
      const delay = BACKOFF[Math.min(state.intentos, BACKOFF.length - 1)];
      state.intentos++;
      console.warn(
        `[RabbitMQ] No disponible (${RABBITMQ_URL}). Reintentando en ${delay / 1000}s (intento ${state.intentos})...`
      );
      await new Promise<void>((r) => setTimeout(r, delay));
    }
  }
}

function programarReconexion(): void {
  const state = obtenerEstado();
  const delay = BACKOFF[Math.min(state.intentos, BACKOFF.length - 1)];
  state.intentos++;
  console.warn(`[RabbitMQ] Desconectado. Reconectando en ${delay / 1000}s (intento ${state.intentos})`);
  setTimeout(() => {
    conectar().catch(() => {/* la reconexión se reintenta desde el while interno */});
  }, delay);
}

export async function obtenerCanal(): Promise<amqplib.Channel> {
  return conectar();
}
