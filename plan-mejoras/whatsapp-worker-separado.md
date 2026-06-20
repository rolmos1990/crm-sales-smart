# Mejora: Separar WhatsApp (Baileys) a proceso independiente

## Problema actual

Baileys corre dentro del proceso de Next.js, iniciado en `src/lib/inicializar-servidor.ts`:

```ts
reconectarSesionesWA();
void new SSERelaySuscriptor().iniciar();
```

Esto significa:
- Cada número de WhatsApp conectado consume 200–400 MB del mismo proceso que sirve las páginas
- Si Baileys crashea o consume RAM en exceso, afecta la respuesta de la app web
- No se puede reiniciar el worker de WA sin reiniciar toda la aplicación

## Solución propuesta

Extraer el worker de WhatsApp + RabbitMQ consumers a un proceso Node.js independiente (`wa-worker.ts`). Next.js solo publica mensajes a la cola — no mantiene sockets de Baileys.

```
[Next.js process]  →  publish  →  RabbitMQ  →  [wa-worker process]
     ~400 MB                                          ↕ Baileys WebSockets
                                                   200-400 MB por número WA
```

## Beneficios

- El proceso de Next.js queda limpio (~400 MB fijos, no crece con números de WA)
- Se puede reiniciar el worker de WA sin afectar la app
- Escalable independientemente: si se necesitan más workers, se agregan sin tocar Next.js
- Monitoreo separado por proceso (CPU, RAM, uptime)

## Archivos involucrados

| Archivo | Rol actual | Cambio necesario |
|---------|-----------|-----------------|
| `src/lib/inicializar-servidor.ts` | Arranca Baileys + SSE relay en Next.js | Quitar `reconectarSesionesWA()`, dejar solo SSE relay |
| `src/integraciones/whatsapp-lite/reconectar.ts` | Reconexión de sesiones al arrancar | Mover al worker |
| `src/integraciones/whatsapp-lite/sesion-manager.ts` | Map en memoria de sesiones activas | Queda en el worker (no en Next.js) |
| `src/suscriptores/mensajes/enviar-mensaje.suscriptor.ts` | Consume `ENVIAR_MENSAJE` de RabbitMQ | Mover al worker |
| `src/suscriptores/mensajes/procesar-entrante.suscriptor.ts` | Consume `PROCESAR_ENTRANTE` | Mover al worker |
| `src/suscriptores/mensajes/marcar-leido.suscriptor.ts` | Consume `MARCAR_LEIDO` | Mover al worker |
| `wa-worker.ts` (nuevo) | — | Entry point del proceso independiente |

## Arquitectura del worker

```ts
// wa-worker.ts (nuevo archivo en raíz del proyecto)
import { reconectarSesionesWA } from "@/integraciones/whatsapp-lite/reconectar";
import { EnviarMensajeSuscriptor } from "@/suscriptores/mensajes/enviar-mensaje.suscriptor";
import { ProcesarEntranteSuscriptor } from "@/suscriptores/mensajes/procesar-entrante.suscriptor";
import { MarcarLeidoSuscriptor } from "@/suscriptores/mensajes/marcar-leido.suscriptor";

async function main() {
  console.log("[wa-worker] Iniciando...");

  // Reconectar sesiones de WA guardadas en disco
  await reconectarSesionesWA();

  // Iniciar consumers de RabbitMQ relacionados a mensajería
  await new EnviarMensajeSuscriptor().iniciar();
  await new ProcesarEntranteSuscriptor().iniciar();
  await new MarcarLeidoSuscriptor().iniciar();

  console.log("[wa-worker] Listo.");
}

main().catch((e) => {
  console.error("[wa-worker] Error fatal:", e);
  process.exit(1);
});
```

## Cómo arrancarlo en producción

```bash
# Script package.json
"worker:wa": "tsx wa-worker.ts"

# Con PM2 (recomendado en producción)
pm2 start wa-worker.ts --name vento-wa-worker --interpreter tsx
pm2 start npm --name vento-app -- run start
```

## Configuración PM2 sugerida (`ecosystem.config.js`)

```js
module.exports = {
  apps: [
    {
      name: "vento-app",
      script: "npm",
      args: "run start",
      env: { NODE_ENV: "production" },
      max_memory_restart: "1G",
    },
    {
      name: "vento-wa-worker",
      script: "tsx",
      args: "wa-worker.ts",
      env: { NODE_ENV: "production" },
      max_memory_restart: "3G",  // permite crecer con múltiples números WA
    },
  ],
};
```

## Consideración: SSE Relay

El `SSERelaySuscriptor` se queda en el proceso de Next.js porque es el que envía los eventos al browser. Solo los workers de mensajería WA se mueven al proceso separado.

## Cuándo implementar

- [ ] Cuando el servidor supere el 60% de RAM con números de WA conectados
- [ ] Cuando se necesite reiniciar el worker de WA sin interrumpir la app
- [ ] Antes de agregar más de 8 números de WA simultáneos en producción

## Relación con escalar a WhatsApp Business API oficial

Si en el futuro se migra a Meta Cloud API (360dialog, Twilio), este worker desaparece completamente — los mensajes llegarían por webhook HTTP directamente a Next.js y no habría sockets persistentes que aislar.
