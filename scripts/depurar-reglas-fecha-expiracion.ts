/**
 * 038-cuenta-como-venta — paso 5 de la migración.
 *
 * Quita `general.fechaExpiracion` de las Reglas de validación ANTES de borrar
 * la columna `Pedido.fechaExpiracion`. Ese orden no es negociable.
 *
 * El motivo está en src/sales/flujo-venta/reglas/evaluador.ts:
 *
 *     const campo = camposPorKey.get(nodo.fieldKey);
 *     const valorActual = campo ? campo.resolver(hechos) : undefined;
 *
 * Al sacar el campo del catálogo, una regla que lo use resuelve `undefined`,
 * su condición deja de cumplirse y la regla pasa a BLOQUEAR el avance de los
 * pedidos a esa etapa. Sin error y sin aviso: solo pedidos que no avanzan.
 *
 * Una regla que quede sin condiciones pasa a BORRADOR en vez de borrarse:
 * deja de evaluarse —ese es el gobierno que ya existe en
 * `EstadoFlujoVentaRegla`— pero sigue visible para que la cuenta la rearme.
 *
 * Idempotente: correrlo dos veces no cambia nada la segunda vez.
 *
 * Uso:
 *   npx tsx scripts/depurar-reglas-fecha-expiracion.ts [--dry-run]
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { ConditionTree, GroupNode, ConditionNode } from "../src/sales/flujo-venta/reglas/tipos";

export const CAMPO_ELIMINADO = "general.fechaExpiracion";
/** La tabla legada `FlujoVentaReglaCondicion` guarda la clave sin prefijo. */
export const CAMPOS_LEGADOS = [CAMPO_ELIMINADO, "fechaExpiracion"];

type Nodo = ConditionNode | GroupNode;

function esCondicionDelCampo(nodo: Nodo, fieldKey: string): boolean {
  return nodo.type === "condition" && nodo.fieldKey === fieldKey;
}

/**
 * Poda del árbol tipado. Recorre los dos niveles de anidamiento que permite
 * `ArbolCondicionesSchema` (raíz + grupos hijos, sin más profundidad).
 *
 * Devuelve `arbol: null` cuando la raíz queda sin hijos: esa regla debe pasar
 * a BORRADOR, no quedar con un árbol vacío que el evaluador no sabría leer y
 * que además viola el propio esquema (`children` exige al menos un elemento).
 */
export function podarCampo(
  arbol: ConditionTree | null | undefined,
  fieldKey: string = CAMPO_ELIMINADO,
): { arbol: ConditionTree | null; quitados: number } {
  if (!arbol || arbol.type !== "group" || !Array.isArray(arbol.children)) {
    return { arbol: arbol ?? null, quitados: 0 };
  }

  let quitados = 0;
  const hijos: Nodo[] = [];

  for (const hijo of arbol.children as Nodo[]) {
    if (esCondicionDelCampo(hijo, fieldKey)) {
      quitados++;
      continue;
    }

    if (hijo.type === "group" && Array.isArray(hijo.children)) {
      const nietos = (hijo.children as Nodo[]).filter((n) => {
        if (esCondicionDelCampo(n, fieldKey)) { quitados++; return false; }
        return true;
      });
      // Un grupo que se queda sin condiciones se cae entero, por el mismo
      // motivo que la raíz: `children` no puede quedar vacío.
      if (nietos.length > 0) hijos.push({ ...hijo, children: nietos } as GroupNode);
      continue;
    }

    hijos.push(hijo);
  }

  if (hijos.length === 0) return { arbol: null, quitados };
  return { arbol: { ...arbol, children: hijos } as ConditionTree, quitados };
}

// Subconjunto mínimo de Prisma Client que el script necesita, para poder
// inyectar un doble en los tests (mismo patrón que los demás backfills).
// `any` a propósito: las firmas reales son mucho más específicas y por
// contravarianza TS rechazaría la asignación con `unknown`.
/* eslint-disable @typescript-eslint/no-explicit-any */
interface PrismaLike {
  flujoVentaReglaCondicion: {
    findMany: (args: any) => Promise<{ id: string; reglaId: string; campo: string }[]>;
    deleteMany: (args: any) => Promise<unknown>;
  };
  flujoVentaRegla: {
    findMany: (args: any) => Promise<{
      id: string;
      nombre: string;
      arbolCondiciones: unknown;
      etapaDestino: { flujoVenta: { instanciaId: string | null } | null } | null;
    }[]>;
    update: (args: any) => Promise<unknown>;
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface ResumenDepuracion {
  condicionesLegadas: number;
  reglasDepuradas: number;
  reglasABorrador: number;
}

export async function depurarReglas(
  prisma: PrismaLike,
  opciones: { dryRun?: boolean } = {},
): Promise<ResumenDepuracion> {
  const { dryRun = false } = opciones;

  // 5a — tabla legada (condiciones planas AND).
  const legadas = await prisma.flujoVentaReglaCondicion.findMany({
    where: { campo: { in: CAMPOS_LEGADOS } },
    select: { id: true, reglaId: true, campo: true },
  });
  for (const c of legadas) {
    console.log(`[legada] condición ${c.id} (campo "${c.campo}") de la regla ${c.reglaId}`);
  }
  if (!dryRun && legadas.length > 0) {
    await prisma.flujoVentaReglaCondicion.deleteMany({
      where: { id: { in: legadas.map((c) => c.id) } },
    });
  }

  // 5b/5c — árbol tipado. Se filtra por el texto del JSON y recién después se
  // poda de verdad: el `contains` no distingue en qué nodo está la clave.
  const candidatas = await prisma.flujoVentaRegla.findMany({
    where: { arbolCondiciones: { string_contains: CAMPO_ELIMINADO } },
    select: {
      id: true,
      nombre: true,
      arbolCondiciones: true,
      etapaDestino: { select: { flujoVenta: { select: { instanciaId: true } } } },
    },
  });

  let reglasDepuradas = 0;
  let reglasABorrador = 0;

  for (const regla of candidatas) {
    const { arbol, quitados } = podarCampo(regla.arbolCondiciones as ConditionTree | null);
    if (quitados === 0) continue;

    reglasDepuradas++;
    const quedaVacia = arbol === null;
    if (quedaVacia) reglasABorrador++;

    const instanciaId = regla.etapaDestino?.flujoVenta?.instanciaId ?? "(sin instancia)";
    console.log(
      `[árbol] regla ${regla.id} "${regla.nombre}" (instancia ${instanciaId}): ` +
      `${quitados} condición(es) quitada(s)` +
      (quedaVacia ? " → pasa a BORRADOR, quedó sin condiciones" : ""),
    );

    if (dryRun) continue;

    await prisma.flujoVentaRegla.update({
      where: { id: regla.id },
      data: quedaVacia
        ? { arbolCondiciones: null, estado: "BORRADOR" }
        : { arbolCondiciones: arbol },
    });
  }

  console.log(
    `\nResumen: ${legadas.length} condición(es) legada(s), ` +
    `${reglasDepuradas} regla(s) con árbol depurado, ` +
    `${reglasABorrador} pasada(s) a BORRADOR.`,
  );
  if (reglasDepuradas > 0 || legadas.length > 0) {
    console.log("Revisar esas reglas con la cuenta antes de dar la migración por cerrada.");
  }

  return { condicionesLegadas: legadas.length, reglasDepuradas, reglasABorrador };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(
    `Depuración de Reglas de validación sobre "${CAMPO_ELIMINADO}"` +
    (dryRun ? " [dry-run: no se escribe nada]" : "") + "\n",
  );

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  try {
    await depurarReglas(prisma as unknown as PrismaLike, { dryRun });
  } finally {
    await prisma.$disconnect();
  }
}

// Solo corre al ejecutarse directamente (tsx scripts/...), no al importarse
// desde el test — así `podarCampo` y `depurarReglas` se prueban con un prisma
// inyectado, sin tocar ninguna base.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Error depurando reglas:", err);
    process.exitCode = 1;
  });
}
