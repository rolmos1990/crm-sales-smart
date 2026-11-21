import "../shared/env/cargar-env";
import { ejecutarJobsPendientes } from "../crm/pipeline/disparadores/ejecutor";
import { cicloWorkflows } from "../workflows/motor/disparo";
import { registrarTodosSuscriptores } from "../suscriptores/registrar";
import { reconectarSesionesWA } from "../integraciones/whatsapp-lite/reconectar";
import { iniciarPollingCorreo } from "../integraciones/email/imap/polling";
import { iniciarCicloAnalisisContactos } from "../crm/contactos/analisis/motor/ciclo";
import { dependenciasMotorAnalisis } from "../crm/contactos/analisis/motor/dependencias";
import { iniciarBarridoVoz } from "../voz/barrido";

const INTERVALO_MS = 10_000;

async function run() {
  // Conectar sockets WA para envío (Next.js maneja los entrantes).
  await reconectarSesionesWA({ soloEnvio: true });
  await registrarTodosSuscriptores();

  // Lectura de buzones de correo (034). Ciclo propio, no dentro del `while` de
  // abajo: un servidor IMAP lento no debe retrasar los disparadores de
  // pipeline ni los timers de Workflows. Corre solo acá — si la app Next.js
  // también leyera, cada réplica duplicaría la lectura.
  await iniciarPollingCorreo();

  // 042 — Análisis de contactos. Ciclo propio, igual que el correo: un
  // proveedor de IA lento no debe retrasar los disparadores ni los Workflows.
  // La planificación es por la base (SKIP LOCKED), así que varias réplicas
  // del worker se reparten el trabajo sin coordinarse.
  iniciarCicloAnalisisContactos(await dependenciasMotorAnalisis());

  // 049 — Transcripción de notas de voz. Ciclo propio por el mismo motivo:
  // recoge lo que la transcripción en línea no alcanzó (salientes, timeouts y
  // fallos recuperables). Reclama con SKIP LOCKED, así que varias réplicas se
  // reparten el trabajo sin coordinarse.
  iniciarBarridoVoz();

  console.log(`[worker:disparadores] iniciando — polling cada ${INTERVALO_MS / 1000}s`);

  while (true) {
    try {
      const resultado = await ejecutarJobsPendientes();
      if (resultado.procesados > 0) {
        console.log(
          `[worker:disparadores] ${resultado.completados}/${resultado.procesados} completados` +
            (resultado.fallidos > 0 ? `, ${resultado.fallidos} fallidos` : "")
        );
      }
    } catch (err) {
      console.error("[worker:disparadores] error en ciclo:", err);
    }

    // Workflows: timers vencidos, recuperación y respaldo de eventos perdidos.
    try {
      const wf = await cicloWorkflows();
      const total = wf.vencidas + wf.recuperadas + wf.mensajes + wf.etapas;
      if (total > 0) console.log(`[worker:workflows] ${JSON.stringify(wf)}`);
    } catch (err) {
      console.error("[worker:workflows] error en ciclo:", err);
    }

    await new Promise((r) => setTimeout(r, INTERVALO_MS));
  }
}

run().catch((e) => {
  console.error("[worker:disparadores] error fatal:", e);
  process.exit(1);
});
