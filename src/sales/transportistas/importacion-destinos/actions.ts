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
    // Verifica existencia antes de crear (mismo criterio que resolverZona/
    // resolverServicio) en vez de crear-y-atrapar-P2002: un `create` que
    // choca contra el índice único deja la transacción envolvente de
    // Postgres "abortada" (current transaction is aborted, commands ignored
    // until end of transaction block) hasta un ROLLBACK/SAVEPOINT explícito
    // — un catch de JS no alcanza para recuperarla, y termina arrastrando a
    // un rollback del lote completo (ver 026-fix-importacion-destinos).
    const existente = await tx.aliasUbicacion.findFirst({
      where: { instanciaId, campo: campoPrincipal, valorNormalizado },
      select: { id: true },
    });
    if (existente) continue;
    await tx.aliasUbicacion.create({ data: { zonaEntregaUbicacionId, campo: campoPrincipal, valor, valorNormalizado, instanciaId } });
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

  // 026-fix-importacion-destinos — la plantilla espera una fila por servicio
  // (mismo destino repetido con distinto servicioNombre/tarifa), pero la
  // clasificación NUEVO/COINCIDENCIA_EXACTA sólo compara contra lo que ya
  // existía en la base *antes* de importar (clasificaciones se calculó una
  // sola vez, arriba) — nunca contra las otras filas del propio archivo. Sin
  // este mapa, la 2ª fila con el mismo destino volvía a clasificar NUEVO y
  // creaba una ZonaEntregaUbicacion duplicada. Clave = destino normalizado
  // dentro del mismo país; se reutiliza el id ya creado en esta corrida.
  const resueltosEnEsteImport = new Map<string, { zonaEntregaUbicacionId: string; zonaEntregaId: string }>();

  const CHUNK = 100;
  for (let inicio = 0; inicio < incluidas.length; inicio += CHUNK) {
    const lote = incluidas.slice(inicio, inicio + CHUNK);
    // Contadores y destinos-nuevos locales al lote — sólo se aplican a los
    // acumuladores globales si la transacción de abajo confirma. Si el lote
    // revierte, un id guardado en resueltosEnEsteImport apuntaría a una fila
    // que en realidad nunca se guardó, y un lote *posterior* con el mismo
    // destino fallaría con una FK inválida al reusarlo — por eso se fusiona
    // recién después del `await` exitoso, nunca dentro del loop.
    let creadosLote = 0;
    let actualizadosLote = 0;
    const nuevosDestinosLote = new Map<string, { zonaEntregaUbicacionId: string; zonaEntregaId: string }>();
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

          const nombreVisible = construirNombreVisible(parsed);
          const claveDestino = `${paisId}:${calcularNombreNormalizado(nombreVisible)}`;
          const yaResueltaEnEsteImport = nuevosDestinosLote.get(claveDestino) ?? resueltosEnEsteImport.get(claveDestino);

          if (candidatoElegido) {
            zonaEntregaUbicacionId = candidatoElegido.zonaEntregaUbicacionId;
            zonaEntregaId = candidatoElegido.zonaEntregaId;
            actualizadosLote++;
          } else if (yaResueltaEnEsteImport) {
            // Mismo destino que otra fila anterior de este mismo archivo
            // (típicamente otro servicio) — reutiliza la ubicación recién
            // creada en vez de duplicarla.
            zonaEntregaUbicacionId = yaResueltaEnEsteImport.zonaEntregaUbicacionId;
            zonaEntregaId = yaResueltaEnEsteImport.zonaEntregaId;
            actualizadosLote++;
          } else {
            // NUEVO, o POSIBLE_DUPLICADO resuelto como "crear nuevo".
            zonaEntregaId = await resolverZona(tx as typeof prisma, auth.sesion.instanciaId, parsed.zonaNombre);
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
            nuevosDestinosLote.set(claveDestino, { zonaEntregaUbicacionId, zonaEntregaId });
            creadosLote++;
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
      creados += creadosLote;
      actualizados += actualizadosLote;
      for (const [clave, valor] of nuevosDestinosLote) resueltosEnEsteImport.set(clave, valor);
    } catch (err) {
      // El lote completo revirtió (Postgres aborta toda la transacción ante
      // cualquier sentencia fallida) — no se suman creadosLote/actualizadosLote
      // ni se fusiona nuevosDestinosLote, así que un lote posterior con el
      // mismo destino lo vuelve a intentar como NUEVO en vez de reusar un id
      // que en realidad nunca se guardó.
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
  revalidatePath(`/sales/transportistas/${transportistaId}`);
  return { exito: true, data: { creados, actualizados } };
}
