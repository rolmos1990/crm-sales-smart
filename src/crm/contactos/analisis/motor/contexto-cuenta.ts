import type { ModoAplicacionInteres } from "@/generated/prisma/enums";
import { prisma } from "@/shared/db/prisma";
import { obtenerZonaNegocio } from "@/shared/fechas/negocio";
import { obtenerEtapasFlujoActivo } from "@/sales/flujo-venta/queries";
import type { EtapaParaKpis } from "@/sales/pedidos/condicion-venta";
import { obtenerUmbralesSeguimiento } from "@/crm/contactos/queries";
import type { UmbralesSeguimiento } from "@/crm/contactos/segmentacion/cortes";
import { obtenerCriterioVigente, type CriterioVigente } from "../criterio/queries";

/** Todo lo que el ejecutor necesita de la cuenta, cargado una vez por lote. */
export interface ContextoCuenta {
  instanciaId: string;
  zonaNegocio: string;
  idioma: string;
  umbralesSeguimiento: UmbralesSeguimiento;
  etapas: EtapaParaKpis[];
  criterio: CriterioVigente;
  analisisHabilitado: boolean;
  iaCuentaHabilitada: boolean;
  modoInteres: ModoAplicacionInteres;
  mesesAntiguedadInicial: number;
  tamanoLote: number;
}

export async function cargarContextoCuenta(instanciaId: string): Promise<ContextoCuenta> {
  const [zonaNegocio, umbralesSeguimiento, etapas, criterio, config, empresa, configIA] = await Promise.all([
    obtenerZonaNegocio(instanciaId),
    obtenerUmbralesSeguimiento(instanciaId),
    obtenerEtapasFlujoActivo(instanciaId),
    obtenerCriterioVigente(instanciaId),
    prisma.configuracionAnalisisContactos.findUnique({
      where: { instanciaId },
      select: { habilitado: true, modoInteres: true, mesesAntiguedadInicial: true, tamanoLote: true },
    }),
    prisma.configuracionEmpresa.findUnique({ where: { instanciaId }, select: { idiomaPrincipal: true } }),
    prisma.configuracionIA.findUnique({ where: { instanciaId }, select: { habilitado: true } }),
  ]);
  return {
    instanciaId,
    zonaNegocio,
    idioma: empresa?.idiomaPrincipal ?? "es",
    umbralesSeguimiento,
    etapas,
    criterio,
    analisisHabilitado: config?.habilitado ?? true,
    iaCuentaHabilitada: configIA?.habilitado ?? false,
    modoInteres: config?.modoInteres ?? "SOLO_SUGERIR",
    mesesAntiguedadInicial: config?.mesesAntiguedadInicial ?? 12,
    tamanoLote: config?.tamanoLote ?? 20,
  };
}
