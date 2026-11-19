import { prisma } from "@/shared/db/prisma";
import { CONFIGURACION_ANALISIS_DEFECTO, type ConfiguracionAnalisis } from "./schema";

/** Configuración de la cuenta; los valores por defecto si todavía no tiene fila (se crea de forma perezosa). */
export async function obtenerConfiguracionAnalisis(instanciaId: string): Promise<ConfiguracionAnalisis> {
  const c = await prisma.configuracionAnalisisContactos.findUnique({ where: { instanciaId } });
  if (!c) return CONFIGURACION_ANALISIS_DEFECTO;
  return {
    habilitado: c.habilitado,
    historicoPausado: c.historicoPausado,
    modoInteres: c.modoInteres,
    mesesAntiguedadInicial: c.mesesAntiguedadInicial,
    tamanoLote: c.tamanoLote,
    maxLotesSimultaneos: c.maxLotesSimultaneos,
    presupuestoDiarioCosto: c.presupuestoDiarioCosto === null ? null : Number(c.presupuestoDiarioCosto),
    presupuestoDiarioTokens: c.presupuestoDiarioTokens,
    ventanaAgrupacionSeg: c.ventanaAgrupacionSeg,
    esperaMaximaSeg: c.esperaMaximaSeg,
  };
}
