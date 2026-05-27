"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { ConfiguracionEmpresaSchema } from "./schema";
import type { ResultadoAccion, ConfigEmpresa } from "./types";

export async function guardarConfiguracionEmpresa(
  instanciaId: string,
  datos: unknown
): Promise<ResultadoAccion<ConfigEmpresa>> {
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
