"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { buscarUbicacionesCoincidentes, type UbicacionCoincidente, type ConfianzaMatch } from "@/shared/entregas/resolver-costo-envio";
import { construirNombreVisible, calcularNombreNormalizado } from "../zonas/normalizar";
import { normalizarUbicacion } from "@/shared/entregas/normalizar-ubicacion";
import { RevisarImportacionDestinosSchema, ConfirmarImportacionDestinosSchema, FilaDestinoImportSchema } from "./schema";
import type { ResultadoAccion } from "../types";
import type { EstadoFilaImportDestino, FilaRevisionDestino, ResumenRevisionDestinos } from "./types";

// 024-alias-ubicaciones-transportistas (FR-012) — clasifica una fila según
// los candidatos geográficos encontrados (research.md §7):
//   - 0 candidatos                       -> NUEVO
//   - 1 candidato EXACTA                 -> COINCIDENCIA_EXACTA
//   - 2+ candidatos EXACTA (excepcional) -> ALIAS_AMBIGUO
//   - 1 candidato ALIAS/PROBABLE         -> POSIBLE_DUPLICADO
//   - 2+ candidatos sin EXACTA único     -> ALIAS_AMBIGUO
function clasificarCandidatos(candidatos: UbicacionCoincidente[]): EstadoFilaImportDestino {
  if (candidatos.length === 0) return "NUEVO";
  const exactos = candidatos.filter((c) => c.confianza === "EXACTA");
  if (exactos.length === 1) return "COINCIDENCIA_EXACTA";
  if (exactos.length >= 2) return "ALIAS_AMBIGUO";
  if (candidatos.length === 1) return "POSIBLE_DUPLICADO";
  return "ALIAS_AMBIGUO";
}

async function clasificarFila(
  instanciaId: string,
  paisId: string,
  fila: Record<string, string>,
): Promise<{ estado: EstadoFilaImportDestino; candidatos: UbicacionCoincidente[]; motivo?: string }> {
  const parsed = FilaDestinoImportSchema.safeParse(fila);
  if (!parsed.success) {
    return { estado: "INCOMPLETA", candidatos: [], motivo: parsed.error.issues[0]?.message ?? "Fila incompleta" };
  }

  const candidatos = await buscarUbicacionesCoincidentes({
    instanciaId,
    paisId,
    estadoProvincia: parsed.data.provinciaEstado,
    distritoCiudad: parsed.data.distritoCiudad || null,
    corregimiento: parsed.data.corregimiento || null,
    sectorOCodigoPostal: parsed.data.sectorOCodigoPostal || null,
  });

  return { estado: clasificarCandidatos(candidatos), candidatos };
}

export async function revisarImportacionDestinosAction(
  datos: unknown,
): Promise<ResultadoAccion<{ filas: FilaRevisionDestino[]; resumen: ResumenRevisionDestinos }>> {
  const validado = RevisarImportacionDestinosSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Datos inválidos" };

  const auth = await requirePermisoAction("transportistas", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const transportista = await prisma.transportista.findFirst({
    where: { id: validado.data.transportistaId, instanciaId: auth.sesion.instanciaId },
    select: { id: true },
  });
  if (!transportista) return { exito: false, error: "Transportista no encontrado" };

  const filas: FilaRevisionDestino[] = [];
  for (let i = 0; i < validado.data.filas.length; i++) {
    const { estado, candidatos, motivo } = await clasificarFila(auth.sesion.instanciaId, validado.data.paisId, validado.data.filas[i]);
    filas.push({
      fila: i + 1,
      datos: validado.data.filas[i] as FilaRevisionDestino["datos"],
      estado,
      candidatos: candidatos.map((c) => ({
        zonaEntregaUbicacionId: c.zonaEntregaUbicacionId,
        zonaEntregaId: c.zonaEntregaId,
        nombreVisible: c.nombreVisible ?? "",
      })),
      motivo,
    });
  }

  const resumen: ResumenRevisionDestinos = {
    nuevos: filas.filter((f) => f.estado === "NUEVO").length,
    coincidenciaExacta: filas.filter((f) => f.estado === "COINCIDENCIA_EXACTA").length,
    posiblesDuplicados: filas.filter((f) => f.estado === "POSIBLE_DUPLICADO").length,
    aliasAmbiguos: filas.filter((f) => f.estado === "ALIAS_AMBIGUO").length,
    incompletas: filas.filter((f) => f.estado === "INCOMPLETA").length,
  };

  return { exito: true, data: { filas, resumen } };
}

async function resolverServicio(tx: typeof prisma, transportistaId: string, nombre: string): Promise<string> {
  const existente = await tx.servicioTransportista.findFirst({
    where: { transportistaId, nombre: { equals: nombre, mode: "insensitive" } },
    select: { id: true },
  });
  if (existente) return existente.id;
  const creado = await tx.servicioTransportista.create({ data: { transportistaId, nombre } });
  return creado.id;
}

async function resolverZona(tx: typeof prisma, instanciaId: string, nombre: string): Promise<string> {
  const existente = await tx.zonaEntrega.findFirst({
    where: { instanciaId, nombre: { equals: nombre, mode: "insensitive" } },
    select: { id: true },
  });
  if (existente) return existente.id;
  const creada = await tx.zonaEntrega.create({ data: { instanciaId, nombre } });
  return creada.id;
}

async function crearAliasesDeFila(
  tx: typeof prisma,
  instanciaId: string,
  zonaEntregaUbicacionId: string,
  campoPrincipal: "PROVINCIA_ESTADO" | "DISTRITO_CIUDAD" | "CORREGIMIENTO" | "SECTOR_O_CODIGO_POSTAL",
  aliasTexto: string,
): Promise<void> {
  const alias = aliasTexto
    .split(";")
    .map((a) => a.trim())
    .filter(Boolean);

  for (const valor of alias) {
    const valorNormalizado = normalizarUbicacion(valor);
    // Silenciosamente omite duplicados (ya cubierto/validado en la revisión;
    // un P2002 acá significa que ya existe con ese mismo valor — no es un
    // error de importación, es un no-op esperado).
    await tx.aliasUbicacion
      .create({ data: { zonaEntregaUbicacionId, campo: campoPrincipal, valor, valorNormalizado, instanciaId } })
      .catch(() => undefined);
  }
}

export async function confirmarImportacionDestinosAction(datos: unknown): Promise<ResultadoAccion<{ creados: number; actualizados: number }>> {
  const validado = ConfirmarImportacionDestinosSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Datos inválidos" };

  const auth = await requirePermisoAction("transportistas", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const { transportistaId, paisId, filas, decisiones, archivoNombre, archivoTipo, archivoPeso } = validado.data;
  if (filas.length !== decisiones.length) return { exito: false, error: "Datos inconsistentes entre filas y decisiones" };

  const transportista = await prisma.transportista.findFirst({
    where: { id: transportistaId, instanciaId: auth.sesion.instanciaId },
    select: { id: true },
  });
  if (!transportista) return { exito: false, error: "Transportista no encontrado" };

  // Re-clasificar server-side — nunca confiar en el estado que mandó el
  // cliente (FR-013): una fila ALIAS_AMBIGUO/INCOMPLETA no puede confirmarse
  // aunque el payload diga incluir: true.
  const clasificaciones = await Promise.all(filas.map((f) => clasificarFila(auth.sesion.instanciaId, paisId, f)));

  const incluidas: number[] = [];
  for (let i = 0; i < filas.length; i++) {
    const decision = decisiones[i];
    if (!decision.incluir) continue;
    const { estado } = clasificaciones[i];
    if (estado === "ALIAS_AMBIGUO" || estado === "INCOMPLETA") {
      return { exito: false, error: `La fila ${i + 1} tiene un alias ambiguo o está incompleta — resuélvela antes de confirmar` };
    }
    incluidas.push(i);
  }

  const historial = await prisma.historialImportacion.create({
    data: {
      instanciaId: auth.sesion.instanciaId,
      usuarioId: auth.sesion.usuarioId,
      entidad: "DESTINO_TRANSPORTISTA",
      archivoNombre,
      archivoTipo,
      archivoPeso,
      totalRegistros: filas.length,
      registrosExitosos: 0,
      registrosConError: 0,
      errores: [],
      estado: "EN_PROCESO",
    },
  });

  let creados = 0;
  let actualizados = 0;
  const erroresImport: { fila: number; mensaje: string }[] = [];

  const CHUNK = 100;
  for (let inicio = 0; inicio < incluidas.length; inicio += CHUNK) {
    const lote = incluidas.slice(inicio, inicio + CHUNK);
    try {
      await prisma.$transaction(async (tx) => {
        for (const idx of lote) {
          const filaRaw = filas[idx];
          const decision = decisiones[idx];
          const parsed = FilaDestinoImportSchema.parse(filaRaw); // ya validado en clasificarFila
          const { estado, candidatos } = clasificaciones[idx];

          let zonaEntregaUbicacionId: string;
          let zonaEntregaId: string;

          const usarExistenteId = decision.incluir ? decision.usarExistenteId : undefined;
          const candidatoElegido = usarExistenteId
            ? candidatos.find((c) => c.zonaEntregaUbicacionId === usarExistenteId)
            : estado === "COINCIDENCIA_EXACTA"
              ? candidatos[0]
              : undefined;

          if (candidatoElegido) {
            zonaEntregaUbicacionId = candidatoElegido.zonaEntregaUbicacionId;
            zonaEntregaId = candidatoElegido.zonaEntregaId;
            actualizados++;
          } else {
            // NUEVO, o POSIBLE_DUPLICADO resuelto como "crear nuevo".
            zonaEntregaId = await resolverZona(tx as typeof prisma, auth.sesion.instanciaId, parsed.zonaNombre);
            const nombreVisible = construirNombreVisible(parsed);
            const nueva = await (tx as typeof prisma).zonaEntregaUbicacion.create({
              data: {
                zonaEntregaId,
                paisId,
                provinciaEstado: parsed.provinciaEstado,
                distritoCiudad: parsed.distritoCiudad || null,
                corregimiento: parsed.corregimiento || null,
                sectorOCodigoPostal: parsed.sectorOCodigoPostal || null,
                nombreVisible,
                nombreNormalizado: calcularNombreNormalizado(nombreVisible),
              },
            });
            zonaEntregaUbicacionId = nueva.id;
            creados++;
          }

          if (parsed.alias) {
            await crearAliasesDeFila(tx as typeof prisma, auth.sesion.instanciaId, zonaEntregaUbicacionId, "PROVINCIA_ESTADO", parsed.alias);
          }

          const servicioTransportistaId = await resolverServicio(tx as typeof prisma, transportistaId, parsed.servicioNombre);

          await (tx as typeof prisma).tarifaTransportistaZona.upsert({
            where: { transportistaId_zonaEntregaId_servicioTransportistaId: { transportistaId, zonaEntregaId, servicioTransportistaId } },
            create: {
              transportistaId,
              zonaEntregaId,
              servicioTransportistaId,
              instanciaId: auth.sesion.instanciaId,
              costoInterno: parsed.costoInterno,
              precioCliente: parsed.precioCliente,
              tiempoMinimoDias: parsed.tiempoMinimoDias ?? null,
              tiempoMaximoDias: parsed.tiempoMaximoDias ?? null,
            },
            update: {
              costoInterno: parsed.costoInterno,
              precioCliente: parsed.precioCliente,
              tiempoMinimoDias: parsed.tiempoMinimoDias ?? null,
              tiempoMaximoDias: parsed.tiempoMaximoDias ?? null,
            },
          });
        }
      });
    } catch (err) {
      for (const idx of lote) erroresImport.push({ fila: idx + 1, mensaje: err instanceof Error ? err.message : "Error desconocido" });
    }
  }

  await prisma.historialImportacion.update({
    where: { id: historial.id },
    data: {
      registrosExitosos: creados + actualizados,
      registrosConError: erroresImport.length,
      errores: erroresImport,
      estado: erroresImport.length === 0 ? "COMPLETADO" : "COMPLETADO_CON_ERRORES",
    },
  });

  revalidatePath("/sales/transportistas");
  return { exito: true, data: { creados, actualizados } };
}
