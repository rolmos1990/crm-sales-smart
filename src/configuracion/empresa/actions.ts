"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { obtenerConfiguracionEmpresa } from "./queries";
import { ConfiguracionEmpresaSchema, ConfiguracionGeograficaSchema } from "./schema";
import type { ResultadoAccion, ConfigEmpresa } from "./types";

// 019-cobertura-geografica-envios — entrypoint client-callable liviano
// (Combobox/formularios client no pueden llamar queries.ts directo) para
// decidir si un formulario debe pedir país o asumir el de la instancia
// (FR-011/FR-012).
export async function obtenerModoGeograficoAction(): Promise<{ modoGeografico: "UN_SOLO_PAIS" | "MULTIPAIS"; paisOperacionId: string | null }> {
  const sesion = await requireSesion();
  const config = await obtenerConfiguracionEmpresa(sesion.instanciaId);
  return {
    modoGeografico: config?.modoGeografico ?? "MULTIPAIS",
    paisOperacionId: config?.paisOperacionId ?? null,
  };
}

export async function guardarConfiguracionEmpresa(
  instanciaId: string,
  datos: unknown
): Promise<ResultadoAccion<ConfigEmpresa>> {
  const sesion = await requireSesion();
  const acceso = verificarAcceso(sesion, "configuracion", "modificar");
  if (!acceso.permitido) return { exito: false, error: acceso.error! };

  const validado = ConfiguracionEmpresaSchema.safeParse(datos);
  if (!validado.success) {
    return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };
  }

  const d = validado.data;
  const campos = {
    nombreComercial: d.nombreComercial || null,
    razonSocial: d.razonSocial || null,
    ruc: d.ruc || null,
    tipoNegocio: d.tipoNegocio || null,
    industria: d.industria || null,
    correoPrincipal: d.correoPrincipal || null,
    telefonoPrincipal: d.telefonoPrincipal || null,
    whatsappPrincipal: d.whatsappPrincipal || null,
    sitioWeb: d.sitioWeb || null,
    pais: d.pais || null,
    provincia: d.provincia || null,
    ciudad: d.ciudad || null,
    direccion: d.direccion || null,
    zonaHoraria: d.zonaHoraria,
    monedaPrincipal: d.monedaPrincipal,
    idiomaPrincipal: d.idiomaPrincipal,
    formatoFecha: d.formatoFecha,
    formatoHora: d.formatoHora,
  };

  try {
    const config = await prisma.configuracionEmpresa.upsert({
      where: { instanciaId },
      create: { instanciaId, ...campos },
      update: campos,
    });

    revalidatePath("/configuracion");
    return { exito: true, datos: config as ConfigEmpresa };
  } catch {
    return { exito: false, error: "Error al guardar la configuración" };
  }
}

// 019-cobertura-geografica-envios — FR-010
export async function guardarConfiguracionGeografica(datos: unknown): Promise<ResultadoAccion<ConfigEmpresa>> {
  const sesion = await requireSesion();
  const acceso = verificarAcceso(sesion, "configuracion", "modificar");
  if (!acceso.permitido) return { exito: false, error: acceso.error! };

  const validado = ConfiguracionGeograficaSchema.safeParse(datos);
  if (!validado.success) {
    return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };
  }

  const campos = {
    modoGeografico: validado.data.modoGeografico,
    paisOperacionId: validado.data.modoGeografico === "UN_SOLO_PAIS" ? validado.data.paisOperacionId : null,
  };

  try {
    const config = await prisma.configuracionEmpresa.upsert({
      where: { instanciaId: sesion.instanciaId },
      create: { instanciaId: sesion.instanciaId, ...campos },
      update: campos,
    });

    revalidatePath("/configuracion");
    return { exito: true, datos: config as ConfigEmpresa };
  } catch {
    return { exito: false, error: "Error al guardar la configuración geográfica" };
  }
}
