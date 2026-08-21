/**
 * Helpers de datos para los tests E2E. Permiten que cada test asegure la data
 * que necesita en el momento en que corre, en vez de depender de un seed
 * global compartido.
 *
 * Implementación: este módulo NO importa Prisma directamente. Lo hace un
 * proceso hijo (tests/helpers/db-worker.ts) lanzado con `tsx`, con el que se
 * habla por stdin/stdout en JSON. Razón: el cliente generado de Prisma usa
 * `import.meta.url` (ESM puro) y Playwright transpila los .spec.ts a
 * CommonJS vía babel — eso rompe con "Cannot use 'import.meta' outside a
 * module" sin importar si el import es estático o dinámico. Aislar Prisma en
 * un proceso `tsx` aparte evita el problema por completo.
 */
import { spawn, type ChildProcess } from "node:child_process";
import * as readline from "node:readline";
import * as path from "node:path";

export type TipoActividad = "LLAMADA" | "EMAIL" | "REUNION" | "TAREA" | "NOTA" | "WHATSAPP";

interface RegistroBase {
  id: string;
}

interface RegistroActividad extends RegistroBase {
  titulo: string;
  tipo: TipoActividad;
  completada: boolean;
}

interface RegistroOportunidad extends RegistroBase {
  titulo: string;
}

let proceso: ChildProcess | null = null;
let lineas: readline.Interface | null = null;
let siguienteId = 1;
const pendientes = new Map<number, { resolve: (valor: unknown) => void; reject: (error: Error) => void }>();

function obtenerWorker(): ChildProcess {
  if (proceso) return proceso;

  const ext = process.platform === "win32" ? ".cmd" : "";
  const tsxBin = path.join(__dirname, "..", "..", "node_modules", ".bin", `tsx${ext}`);
  const workerScript = path.join(__dirname, "db-worker.ts");

  const child = spawn(tsxBin, [workerScript], {
    cwd: path.join(__dirname, "..", ".."),
    stdio: ["pipe", "pipe", "inherit"],
    shell: process.platform === "win32",
  });
  proceso = child;

  lineas = readline.createInterface({ input: child.stdout! });
  lineas.on("line", (line) => {
    if (!line.trim()) return;

    let mensaje: { id: number; ok: boolean; result?: unknown; error?: string };
    try {
      mensaje = JSON.parse(line);
    } catch {
      return;
    }

    const pendiente = pendientes.get(mensaje.id);
    if (!pendiente) return;
    pendientes.delete(mensaje.id);

    if (mensaje.ok) pendiente.resolve(mensaje.result);
    else pendiente.reject(new Error(mensaje.error ?? "Error desconocido en db-worker"));
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      for (const { reject } of pendientes.values()) {
        reject(new Error(`db-worker terminó con código ${code}`));
      }
      pendientes.clear();
    }
  });

  return child;
}

function llamar<T>(op: string, args: unknown[]): Promise<T> {
  const child = obtenerWorker();
  const id = siguienteId++;

  return new Promise<T>((resolve, reject) => {
    pendientes.set(id, { resolve: resolve as (valor: unknown) => void, reject });
    child.stdin!.write(`${JSON.stringify({ id, op, args })}\n`);
  });
}

export async function desconectarPrismaTest() {
  if (!proceso) return;
  lineas?.close();
  proceso.kill("SIGTERM");
  proceso = null;
}

export function obtenerInstanciaPruebas() {
  return llamar<RegistroBase>("obtenerInstanciaPruebas", []);
}

export function obtenerUsuarioOwner(instanciaId: string) {
  return llamar<RegistroBase>("obtenerUsuarioOwner", [instanciaId]);
}

export function crearActividad(overrides: {
  instanciaId: string;
  usuarioId: string;
  titulo?: string;
  tipo?: TipoActividad;
  completada?: boolean;
  contactoId?: string | null;
  oportunidadId?: string | null;
  fecha?: Date;
}) {
  return llamar<RegistroActividad>("crearActividad", [{ ...overrides, fecha: overrides.fecha?.toISOString() }]);
}

export function crearContacto(overrides: { instanciaId: string; usuarioId: string; empresaId?: string | null }) {
  return llamar<RegistroBase>("crearContacto", [overrides]);
}

export function crearEmpresa(overrides: { instanciaId: string; usuarioId: string }) {
  return llamar<RegistroBase>("crearEmpresa", [overrides]);
}

export function crearOportunidad(overrides: {
  instanciaId: string;
  usuarioId: string;
  titulo?: string;
  empresaId?: string | null;
  pipelineId?: string | null;
  stageId?: string | null;
}) {
  return llamar<RegistroOportunidad>("crearOportunidad", [overrides]);
}

export function asegurarAlMenosUnContacto(instanciaId: string, usuarioId: string) {
  return llamar<RegistroBase>("asegurarAlMenosUnContacto", [instanciaId, usuarioId]);
}

export function asegurarAlMenosUnaOportunidad(instanciaId: string, usuarioId: string) {
  return llamar<RegistroOportunidad>("asegurarAlMenosUnaOportunidad", [instanciaId, usuarioId]);
}

export function asegurarOportunidadEnPipeline(instanciaId: string, usuarioId: string) {
  return llamar<{ pipelineId: string; stageId: string; oportunidad: RegistroOportunidad }>(
    "asegurarOportunidadEnPipeline",
    [instanciaId, usuarioId],
  );
}

export function asegurarSegundoPipeline(instanciaId: string) {
  return llamar<{ ok: true }>("asegurarSegundoPipeline", [instanciaId]);
}

export function asegurarFlujoConEtapas(instanciaId: string) {
  return llamar<{
    flujoVentaId: string;
    etapas: { id: string; nombre: string; esInicial: boolean; esFinal: boolean }[];
  }>("asegurarFlujoConEtapas", [instanciaId]);
}

export function crearEtapaConPedido(instanciaId: string, usuarioId: string) {
  return llamar<{ etapaId: string; etapaNombre: string; pedidoId: string }>(
    "crearEtapaConPedido",
    [instanciaId, usuarioId],
  );
}

export function crearPedidoEnEtapaFinal(instanciaId: string, usuarioId: string) {
  return llamar<{ pedidoId: string; etapaNombre: string }>(
    "crearPedidoEnEtapaFinal",
    [instanciaId, usuarioId],
  );
}

export function crearPedidoConEntregaEditable(instanciaId: string, usuarioId: string) {
  return llamar<{ pedidoId: string }>("crearPedidoConEntregaEditable", [instanciaId, usuarioId]);
}

export function crearPedidoConReglaBloqueante(instanciaId: string, usuarioId: string) {
  return llamar<{
    pedidoId: string;
    etapaOrigenNombre: string;
    etapaBloqueadaNombre: string;
    mensajeFallo: string;
  }>("crearPedidoConReglaBloqueante", [instanciaId, usuarioId]);
}

export function vaciarActividades(instanciaId: string) {
  return llamar<{ ok: true }>("vaciarActividades", [instanciaId]);
}

// ─── Instagram (CuentaCanal) ───────────────────────────────────────────────

export function crearCuentaCanalInstagram(overrides: {
  instanciaId: string;
  identificador: string;
  nombre?: string;
  activa?: boolean;
  proveedorAuth?: "MetaFacebook" | "Instagram";
  configuracion?: Record<string, unknown>;
}) {
  return llamar<RegistroBase>("crearCuentaCanalInstagram", [overrides]);
}

export function contarCuentasCanalInstagram(instanciaId: string, identificador: string) {
  return llamar<number>("contarCuentasCanalInstagram", [instanciaId, identificador]);
}

export function eliminarCuentaCanal(id: string) {
  return llamar<{ ok: true }>("eliminarCuentaCanal", [id]);
}

export function contarMensajesPorIdExterno(idExterno: string) {
  return llamar<number>("contarMensajesPorIdExterno", [idExterno]);
}

export function eliminarMensajesPorIdExterno(idExterno: string) {
  return llamar<{ ok: true }>("eliminarMensajesPorIdExterno", [idExterno]);
}

export function vaciarOportunidades(instanciaId: string) {
  return llamar<{ ok: true }>("vaciarOportunidades", [instanciaId]);
}
