// Servicio central de validación — evaluado desde CUALQUIER lugar que intente
// mover un pedido a una etapa protegida (pantalla de detalle, disparadores
// automáticos, futuras integraciones/API): ver validarTransicion en
// ../motor.ts (Next.js) y ejecutarJobPedido en
// src/crm/pipeline/disparadores/ejecutor.ts (worker standalone).
//
// Deliberadamente sin `import { prisma } from "@/shared/db/prisma"` ni
// `next/cache`: este módulo también corre en el worker de disparadores
// (`tsx`, fuera de Next.js), que usa su propio PrismaClient y evita los
// alias `@/` — ver el comentario de cabecera de ese ejecutor. El cliente se
// recibe siempre inyectado.
import type { PrismaClient } from "../../../generated/prisma/client";
import { obtenerCatalogoCampos } from "./catalogo-campos";
import { resolverHechosPedido } from "./resolver-hechos";
import { construirArbolDesdeRegla, evaluarArbol } from "./evaluador";
import type { ReglaEvaluada, ResultadoEvaluacion } from "./tipos";

const ZONA_HORARIA_DEFECTO = "America/Lima";

/**
 * `ValidateOrderForState` — evalúa, por prioridad, todas las Reglas de
 * validación Publicadas y activas del estado destino. No modifica nada: solo
 * informa si el pedido puede obtener esa etapa y, si no, cuál regla falló y
 * qué condiciones quedaron pendientes.
 */
export async function validarPedidoParaEtapa(
  db: PrismaClient,
  pedidoId: string,
  etapaDestinoId: string,
  instanciaId: string
): Promise<ResultadoEvaluacion> {
  const [reglas, hechos, catalogo, configuracion] = await Promise.all([
    db.flujoVentaRegla.findMany({
      where: { etapaDestinoId, activo: true, estado: "PUBLICADA" },
      orderBy: { prioridad: "asc" },
      include: { condiciones: true },
    }),
    resolverHechosPedido(db, pedidoId, instanciaId),
    obtenerCatalogoCampos(db, instanciaId),
    db.configuracionEmpresa.findFirst({ where: { instanciaId }, select: { zonaHoraria: true } }),
  ]);

  const vacio: ResultadoEvaluacion = { esValido: true, etapaDestinoId, reglasEvaluadas: [], reglaFallida: null };
  if (!hechos || reglas.length === 0) {
    // Sin hechos (pedido no encontrado) o sin reglas activas para esta
    // etapa: nada que evaluar, no bloquea — mismo comportamiento que antes
    // de que existiera este motor.
    return hechos ? vacio : { ...vacio, esValido: false };
  }

  const zonaHoraria = configuracion?.zonaHoraria ?? ZONA_HORARIA_DEFECTO;

  const reglasEvaluadas: ReglaEvaluada[] = reglas.map((regla) => {
    const arbol = construirArbolDesdeRegla(regla);
    const { cumple, condiciones } = evaluarArbol(arbol, hechos, catalogo, zonaHoraria);
    return {
      reglaId: regla.id,
      nombre: regla.nombre,
      prioridad: regla.prioridad,
      cumple,
      mensajeFallo: regla.mensajeFallo,
      mostrarPendientes: regla.mostrarPendientes,
      condiciones,
    };
  });

  const reglaFallida = reglasEvaluadas.find((r) => !r.cumple) ?? null;

  return {
    esValido: reglaFallida === null,
    etapaDestinoId,
    reglasEvaluadas,
    reglaFallida,
  };
}
