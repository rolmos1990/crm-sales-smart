import "dotenv/config";
import { ejecutarJobsPendientes } from "../crm/pipeline/disparadores/ejecutor";
import { registrarTodosSuscriptores } from "../suscriptores/registrar";
import { reconectarSesionesWA } from "../integraciones/whatsapp-lite/reconectar";

const INTERVALO_MS = 10_000;

async function run() {
  // Conectar sockets WA para envío (Next.js maneja los entrantes).
  await reconectarSesionesWA({ soloEnvio: true });
  await registrarTodosSuscriptores();
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

    await new Promise((r) => setTimeout(r, INTERVALO_MS));
  }
}

run().catch((e) => {
  console.error("[worker:disparadores] error fatal:", e);
  process.exit(1);
});
