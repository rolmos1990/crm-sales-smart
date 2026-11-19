/**
 * 042-contactos-analisis-ia — simulador de carga del motor (research D17, quickstart §4).
 *
 * Crea cuentas y contactos SINTÉTICOS (slug `sim042-<corrida>-…`), levanta N
 * procesos worker que corren el ciclo real del motor contra PostgreSQL con un
 * ejecutor de IA SIMULADO (latencia y tasa de error configurables), y al final
 * verifica: justicia entre cuentas, dobles tomas, trabajo perdido y espera p95.
 *
 * Seguridad:
 * - Solo toca sus cuentas: el turno se toma con `soloInstancias` y el ciclo
 *   corre sin reconciliación ni retención (que recorren todas las cuentas).
 * - No llama a ningún proveedor de IA real.
 * - Exige `--confirmar`: escribe decenas de miles de filas. Usar SOLO contra
 *   una base de desarrollo.
 *
 * Uso:
 *   npx tsx scripts/042-simular-carga-analisis.ts --confirmar \
 *     --cuentas 1000 --contactos 50 --grandes 3:10000 \
 *     --latencia-ms 800 --error-pct 5 --workers 2 [--matar-worker-en 30] [--concurrencia 3] [--max-seg 900]
 *   npx tsx scripts/042-simular-carga-analisis.ts --limpiar --confirmar
 */
import "dotenv/config";
import { spawn, type ChildProcess } from "node:child_process";
import * as readline from "node:readline";
import { fileURLToPath } from "node:url";

const PREFIJO = "sim042-";

function arg(nombre: string, porDefecto?: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  if (i < 0) return porDefecto;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : "true";
}
const num = (nombre: string, porDefecto: number) => Number(arg(nombre, String(porDefecto)));

// ── Métricas puras (probadas en scripts/042-simular-carga-analisis.test.ts) ──

/** SC-007: ¿todas las cuentas recibieron su primer turno antes de que alguna recibiera el segundo? */
export function primerosTurnosAntesQueSegundos(orden: string[], cuentasConTrabajo: number): boolean {
  const vistas = new Set<string>();
  for (const id of orden) {
    if (vistas.has(id)) return vistas.size >= cuentasConTrabajo;
    vistas.add(id);
  }
  return vistas.size >= cuentasConTrabajo;
}

export function percentil(valores: number[], p: number): number | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  return ordenados[Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1)];
}

// ── Modo worker (proceso hijo) ───────────────────────────────────────────────

async function modoWorker(): Promise<void> {
  const { prisma } = await import("../src/shared/db/prisma");
  const { vueltaCiclo } = await import("../src/crm/contactos/analisis/motor/ciclo");
  const { tomarTurnoCuenta } = await import("../src/crm/contactos/analisis/cola");
  const { INTERVALO_BASE_MS } = await import("../src/crm/contactos/analisis/motor/planificador");
  type Ejecutor = import("../src/crm/contactos/analisis/types").EjecutorIA;

  const corrida = arg("corrida")!;
  const latencia = num("latencia-ms", 800);
  const errorPct = num("error-pct", 0);
  const maxSeg = num("max-seg", 900);
  const cuentas = (await prisma.instancia.findMany({ where: { slug: { startsWith: `${PREFIJO}${corrida}-` } }, select: { id: true } })).map((c) => c.id);

  const ejecutorSimulado: Ejecutor = async (entrada) => {
    await new Promise((r) => setTimeout(r, latencia * (0.7 + Math.random() * 0.6)));
    if (Math.random() * 100 < errorPct) throw Object.assign(new Error("Error simulado del proveedor"), { status: 500 });
    return {
      resultados: new Map(
        entrada.contactos.map((c) => [
          c.contactoId,
          {
            intencion: "MEDIA" as const,
            intencionComercial: null,
            urgencia: "BAJA" as const,
            recuperacion: "NO_APLICA" as const,
            ajustePuntaje: 5,
            senales: ["Señal simulada"],
            objeciones: [],
            motivos: [],
            accionSugerida: "DAR_SEGUIMIENTO" as const,
            sugerirNoContactar: false,
            motivoNoContactar: null,
            productosConsultados: [],
            presupuestoConocido: null,
            ocasionActual: null,
            fechaRequerida: null,
          },
        ]),
      ),
      invalidos: [],
      omitidos: [],
      loteInvalido: false,
      tokensEntrada: 400 * entrada.contactos.length,
      tokensSalida: 100 * entrada.contactos.length,
      tokensCacheados: 0,
      costoEstimado: null,
      usoIAId: null,
      proveedorIAId: null,
      proveedor: "SIMULADO",
      modelo: "simulado",
      promptVersion: "simulado",
    };
  };

  const inicio = Date.now();
  let vacias = 0;
  while (Date.now() - inicio < maxSeg * 1000) {
    const turnos = await vueltaCiclo({
      sinTareasPeriodicas: true,
      dependencias: { ejecutorIA: ejecutorSimulado, disponibilidadIA: async () => ({ disponible: true }) },
      elegirTurno: async (prioridad, pausado) => {
        const t = await tomarTurnoCuenta({ prioridad, historicoPausadoGlobal: pausado, intervaloBaseMs: INTERVALO_BASE_MS, soloInstancias: cuentas });
        return t ? { instanciaId: t.instanciaId, prioridad, tamanoLote: t.tamanoLote } : null;
      },
    });
    for (const t of turnos) process.stdout.write(`${JSON.stringify({ tipo: "turno", instanciaId: t.instanciaId, prioridad: t.prioridad, t: Date.now() })}\n`);
    const pendientes = await prisma.contactoAnalisisCola.count({ where: { instanciaId: { in: cuentas }, estado: { in: ["PENDIENTE", "EN_PROCESO"] } } });
    vacias = pendientes === 0 ? vacias + 1 : 0;
    if (vacias >= 3) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  await prisma.$disconnect();
}

// ── Modo coordinador ─────────────────────────────────────────────────────────

async function sembrar(corrida: string): Promise<string[]> {
  const { prisma } = await import("../src/shared/db/prisma");
  const nCuentas = num("cuentas", 20);
  const nContactos = num("contactos", 50);
  const [nGrandes, contactosGrandes] = (arg("grandes", "0:0") ?? "0:0").split(":").map(Number);

  const definiciones = [
    ...Array.from({ length: nGrandes }, (_, i) => ({ slug: `${PREFIJO}${corrida}-g${i}`, contactos: contactosGrandes })),
    ...Array.from({ length: nCuentas }, (_, i) => ({ slug: `${PREFIJO}${corrida}-c${i}`, contactos: nContactos })),
  ];
  const instancias = await prisma.instancia.createManyAndReturn({
    data: definiciones.map((d) => ({ nombre: `Simulación 042 ${d.slug}`, slug: d.slug })),
    select: { id: true, slug: true },
  });
  const porSlug = new Map(instancias.map((i) => [i.slug, i.id]));
  await prisma.configuracionIA.createMany({ data: instancias.map((i) => ({ instanciaId: i.id, habilitado: true })), skipDuplicates: true });
  await prisma.configuracionAnalisisContactos.createMany({ data: instancias.map((i) => ({ instanciaId: i.id })), skipDuplicates: true });

  for (const d of definiciones) {
    const instanciaId = porSlug.get(d.slug)!;
    for (let desde = 0; desde < d.contactos; desde += 5000) {
      const cantidad = Math.min(5000, d.contactos - desde);
      const contactos = await prisma.contacto.createManyAndReturn({
        data: Array.from({ length: cantidad }, (_, k) => ({ nombre: "Sim", apellido: `${desde + k}`, instanciaId, ultimaInteraccionEn: new Date() })),
        select: { id: true },
      });
      const conversaciones = await prisma.conversacion.createManyAndReturn({
        data: contactos.map((c) => ({ contactoId: c.id, instanciaId })),
        select: { id: true },
      });
      await prisma.mensajeConversacion.createMany({
        data: conversaciones.map((c) => ({ conversacionId: c.id, remitente: "CONTACTO" as const, contenido: "Hola, ¿tienen disponibilidad?" })),
      });
      await prisma.$executeRaw`
        INSERT INTO "ContactoAnalisisCola" ("id", "contactoId", "instanciaId", "estado", "prioridad", "tipo", "motivo", "primerMarcadoEn", "elegibleDesde", "actualizadoEn")
        SELECT 'cq' || replace(gen_random_uuid()::text, '-', ''), c."id", c."instanciaId", 'PENDIENTE', 'P1', 'INCREMENTAL', 'MENSAJE', now(), now(), now()
        FROM "Contacto" c WHERE c."instanciaId" = ${instanciaId}
        ON CONFLICT ("contactoId") DO NOTHING`;
    }
  }
  console.log(`[sim] ${instancias.length} cuentas y ${definiciones.reduce((s, d) => s + d.contactos, 0)} contactos sembrados`);
  return instancias.map((i) => i.id);
}

async function limpiar(corrida?: string): Promise<void> {
  const { prisma } = await import("../src/shared/db/prisma");
  const r = await prisma.instancia.deleteMany({ where: { slug: { startsWith: corrida ? `${PREFIJO}${corrida}-` : PREFIJO } } });
  console.log(`[sim] ${r.count} cuentas sintéticas eliminadas`);
}

async function informar(cuentas: string[], orden: string[]): Promise<void> {
  const { prisma } = await import("../src/shared/db/prisma");
  const [dobles, perdidos, ejecuciones] = await Promise.all([
    prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(*)::bigint AS n FROM (
        SELECT "contactoId" FROM "EjecucionAnalisisContactosItem"
        WHERE "instanciaId" = ANY(${cuentas}) AND "estado" = 'EXITOSO'
        GROUP BY "contactoId" HAVING COUNT(*) > 1
      ) x`,
    prisma.contactoAnalisisCola.count({ where: { instanciaId: { in: cuentas }, estado: { not: "AL_DIA" } } }),
    prisma.ejecucionAnalisisContactos.findMany({ where: { instanciaId: { in: cuentas } }, select: { esperaColaMs: true, prioridad: true, estado: true } }),
  ]);
  const esperas = ejecuciones.filter((e) => e.prioridad === "P1" && e.esperaColaMs !== null).map((e) => e.esperaColaMs!);
  const informe = {
    cuentas: cuentas.length,
    turnos: orden.length,
    primerosTurnosAntesQueSegundos: primerosTurnosAntesQueSegundos(orden, cuentas.length),
    doblesTomas: Number(dobles[0]?.n ?? 0),
    contactosSinTerminar: perdidos,
    atencionesFallidas: ejecuciones.filter((e) => e.estado === "FALLIDA" || e.estado === "ABANDONADA").length,
    esperaP1p95Ms: percentil(esperas, 95),
  };
  console.log("[sim] Informe:", JSON.stringify(informe, null, 2));
}

async function coordinador(): Promise<void> {
  if (arg("confirmar") !== "true") {
    console.error("[sim] Escribe decenas de miles de filas. Usalo SOLO contra una base de desarrollo y agregá --confirmar.");
    process.exit(1);
  }
  if (arg("limpiar") === "true") return limpiar(arg("corrida"));

  const corrida = Date.now().toString(36);
  const cuentas = await sembrar(corrida);
  const orden: string[] = [];
  const hijos: ChildProcess[] = [];
  const nWorkers = num("workers", 2);
  const reenviar = ["latencia-ms", "error-pct", "max-seg"].flatMap((k) => (arg(k) ? [`--${k}`, arg(k)!] : []));
  const env = { ...process.env, ANALISIS_CONTACTOS_CONCURRENCIA: String(num("concurrencia", 3)) };

  await Promise.all(
    Array.from({ length: nWorkers }, (_, i) =>
      new Promise<void>((resolver) => {
        const hijo = spawn("npx", ["tsx", fileURLToPath(import.meta.url), "--modo", "worker", "--corrida", corrida, ...reenviar], { env, shell: true });
        hijos.push(hijo);
        readline.createInterface({ input: hijo.stdout! }).on("line", (l) => {
          try {
            const m = JSON.parse(l) as { tipo: string; instanciaId: string };
            if (m.tipo === "turno") orden.push(m.instanciaId);
          } catch {
            /* log del motor */
          }
        });
        hijo.stderr?.on("data", (d) => process.stderr.write(`[worker ${i}] ${d}`));
        hijo.on("exit", () => resolver());
      }),
    ).concat(
      arg("matar-worker-en")
        ? [new Promise<void>((r) => setTimeout(() => {
            console.log("[sim] Matando el worker 0 a mitad de la corrida (SC-012)…");
            hijos[0]?.kill("SIGKILL");
            r();
          }, num("matar-worker-en", 30) * 1000))]
        : [],
    ),
  );

  await informar(cuentas, orden);
  if (arg("conservar") !== "true") await limpiar(corrida);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (arg("modo") === "worker" ? modoWorker() : coordinador())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
