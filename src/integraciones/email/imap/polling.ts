// Ciclo de lectura de buzones. Corre SOLO en el worker.
//
// Si la app Next.js leyera buzones, cada réplica de la app duplicaría la
// lectura. El worker ya es donde viven los procesos con estado (sockets de
// WhatsApp, disparadores de pipeline, timers de Workflows), así que es su
// lugar natural. Ver research.md R14.
//
// Ciclo propio y no dentro del `while` de disparadores.ts a propósito: un
// servidor IMAP lento no debe retrasar los disparadores de pipeline ni los
// timers de Workflows.
import { createHash } from "node:crypto";
import { prisma } from "@/shared/db/prisma";
import { publicadorEventos } from "@/shared/rabbitmq";
import { TIPOS_COMANDO } from "@/shared/eventos/registro";
import {
  CANAL_EMAIL,
  descifrarConexion,
  leerConfiguracionBuzon,
  type ConfiguracionBuzonAlmacenada,
} from "../configuracion";
import { ErrorCorreo, leerCorreosNuevos, obtenerPosicionActual } from "./cliente";
import { mensajeErrorCorreo, traducirErrorCorreo, type CodigoErrorCorreo } from "../errores";
import { normalizarCorreo } from "../mensaje/normalizar";
import {
  anclarMarca,
  obtenerMarca,
  registrarLecturaFallida,
  registrarLecturaOk,
  resolverPuntoDePartida,
} from "./marca-lectura";

/** El correo no es un canal de tiempo real: SC-003 pide menos de 2 minutos. */
export const INTERVALO_MS = 60_000;

/** Tope de correos por buzón y por ciclo, para que una casilla con mil mensajes
 *  sin leer no monopolice el worker. El resto entra en los ciclos siguientes. */
export const TOPE_POR_CICLO = 25;

/**
 * Lock de aplicación de PostgreSQL por buzón.
 *
 * Es la única defensa contra el escenario que sí duplica correos de verdad:
 * dos réplicas del worker leyendo la misma casilla a la vez. `pg_try_advisory_lock`
 * no espera: si otra réplica lo tiene, esta salta el buzón y lo toma en el
 * ciclo siguiente.
 */
function claveLock(cuentaCanalId: string): bigint {
  const hash = createHash("sha256").update(`buzon:${cuentaCanalId}`).digest();
  // pg_try_advisory_lock toma un bigint CON SIGNO: se reinterpretan los 64
  // bits en vez de recortarlos, así dos buzones distintos no colisionan.
  return BigInt.asIntN(64, hash.readBigUInt64BE(0));
}

async function tomarLock(clave: bigint): Promise<boolean> {
  const filas = await prisma.$queryRaw<{ tomado: boolean }[]>`
    SELECT pg_try_advisory_lock(${clave}::bigint) AS "tomado"
  `;
  return filas[0]?.tomado === true;
}

async function soltarLock(clave: bigint): Promise<void> {
  await prisma.$queryRaw`SELECT pg_advisory_unlock(${clave}::bigint)`;
}

interface BuzonActivo {
  id: string;
  instanciaId: string;
  identificador: string;
  configuracion: ConfiguracionBuzonAlmacenada;
}

async function obtenerBuzonesActivos(): Promise<BuzonActivo[]> {
  const cuentas = await prisma.cuentaCanal.findMany({
    where: { canal: CANAL_EMAIL, activa: true },
    select: { id: true, instanciaId: true, identificador: true, configuracion: true },
  });

  return cuentas.flatMap((c) => {
    const configuracion = leerConfiguracionBuzon(c.configuracion);
    if (!configuracion) {
      console.warn(`[correo] buzón ${c.id} sin configuración válida — se omite`);
      return [];
    }
    return [{ id: c.id, instanciaId: c.instanciaId, identificador: c.identificador, configuracion }];
  });
}

export interface ResultadoLectura {
  correos: number;
  descartados: number;
}

/**
 * Lee un buzón: toma el lock, trae los correos nuevos, los encola y recién
 * entonces avanza la marca.
 *
 * El orden importa y no es negociable: si la marca avanzara antes de encolar,
 * un corte a mitad de camino perdería correos sin dejar rastro.
 */
export async function leerBuzon(buzon: BuzonActivo): Promise<ResultadoLectura> {
  const clave = claveLock(buzon.id);
  if (!(await tomarLock(clave))) {
    return { correos: 0, descartados: 0 };
  }

  try {
    const conexion = descifrarConexion(buzon.configuracion.entrada);
    const marca = await obtenerMarca(buzon.id);

    // Posición actual de la casilla: también resuelve el uidValidity con el
    // que se compara la marca guardada.
    const posicion = await obtenerPosicionActual(conexion);
    const { desdeUid, reanclar } = resolverPuntoDePartida(marca, posicion.uidValidity);

    if (reanclar) {
      // Primera lectura del buzón, o el servidor renumeró la casilla: se ancla
      // a la posición actual y no se importa nada hacia atrás (FR-023).
      await anclarMarca(buzon.id, buzon.instanciaId, posicion);
      if (marca?.uidValidity && marca.uidValidity !== posicion.uidValidity) {
        console.warn(
          `[correo] buzón ${buzon.id}: el servidor renumeró la casilla (uidValidity ${marca.uidValidity} → ${posicion.uidValidity}); se re-ancló sin reimportar`,
        );
      }
      return { correos: 0, descartados: 0 };
    }

    const lectura = await leerCorreosNuevos(conexion, desdeUid, TOPE_POR_CICLO);
    if (lectura.correos.length === 0) {
      await registrarLecturaOk(buzon.id, {
        uidValidity: lectura.uidValidity,
        ultimoUid: desdeUid ?? BigInt(0),
        correos: 0,
      });
      return { correos: 0, descartados: 0 };
    }

    let encolados = 0;
    let descartados = 0;
    let ultimoUidProcesado = desdeUid ?? BigInt(0);

    for (const crudo of lectura.correos) {
      const resultado = await normalizarCorreo(crudo.fuente, {
        cuentaCanalId: buzon.id,
        instanciaId: buzon.instanciaId,
        direccionBuzon: buzon.identificador,
        uid: crudo.uid,
        uidValidity: lectura.uidValidity,
      });

      if (resultado.tipo === "DESCARTADO") {
        // Se loguea el motivo y el Message-ID, nunca el cuerpo del correo.
        console.log(
          `[correo] descartado por ${resultado.motivo} — buzón ${buzon.id}, messageId ${resultado.messageId ?? "sin-id"}`,
        );
        descartados += 1;
      } else {
        await publicadorEventos.publicar(
          TIPOS_COMANDO.PROCESAR_ENTRANTE,
          buzon.instanciaId,
          resultado.correo.payload,
        );
        encolados += 1;
      }

      // Un correo descartado también está procesado: la marca avanza igual,
      // o se volvería a leer en cada ciclo para volver a descartarlo.
      ultimoUidProcesado = BigInt(crudo.uid);
    }

    await registrarLecturaOk(buzon.id, {
      uidValidity: lectura.uidValidity,
      ultimoUid: ultimoUidProcesado,
      correos: encolados,
    });

    if (encolados > 0 || descartados > 0) {
      console.log(
        `[correo] buzón ${buzon.id}: ${encolados} encolado(s), ${descartados} descartado(s)` +
          (lectura.hayMas ? " — quedan más para el próximo ciclo" : ""),
      );
    }

    return { correos: encolados, descartados };
  } finally {
    await soltarLock(clave).catch(() => undefined);
  }
}

export interface ResultadoCiclo {
  buzones: number;
  correos: number;
  fallidos: number;
}

/**
 * Un ciclo completo sobre todos los buzones activos de todas las instancias.
 *
 * El fallo de un buzón no interrumpe el ciclo ni afecta a los demás (FR-012):
 * queda registrado en su estado y el resto sigue leyéndose.
 */
export async function ejecutarCicloCorreo(): Promise<ResultadoCiclo> {
  const buzones = await obtenerBuzonesActivos();
  let correos = 0;
  let fallidos = 0;

  for (const buzon of buzones) {
    try {
      const resultado = await leerBuzon(buzon);
      correos += resultado.correos;
    } catch (err) {
      fallidos += 1;
      const codigo: CodigoErrorCorreo =
        err instanceof ErrorCorreo ? err.codigo : traducirErrorCorreo(err);
      console.error(`[correo] fallo al leer el buzón ${buzon.id}: ${codigo}`);
      await registrarLecturaFallida(buzon.id, {
        codigo,
        mensaje: mensajeErrorCorreo(codigo),
      }).catch(() => undefined);
    }
  }

  return { buzones: buzones.length, correos, fallidos };
}

let cicloIniciado = false;

/** Arranca el ciclo. Se llama una sola vez, al iniciar el worker. */
export async function iniciarPollingCorreo(opciones?: { intervaloMs?: number }): Promise<void> {
  if (cicloIniciado) return;
  cicloIniciado = true;

  const intervalo = opciones?.intervaloMs ?? INTERVALO_MS;
  console.log(`[correo] lector de buzones iniciado — ciclo cada ${intervalo / 1000}s`);

  void (async () => {
    for (;;) {
      try {
        const r = await ejecutarCicloCorreo();
        if (r.correos > 0 || r.fallidos > 0) {
          console.log(`[correo] ciclo: ${JSON.stringify(r)}`);
        }
      } catch (err) {
        console.error("[correo] error en el ciclo de lectura:", err);
      }
      await new Promise((resolver) => setTimeout(resolver, intervalo));
    }
  })();
}
